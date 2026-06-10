use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use std::sync::Arc;

use super::{ensure_space_vfs, get_space, parse_uuid, validate_node_name, vfs_err};
use crate::handlers::AppCtx;
use crate::db::entities::DocNodeListItem;
use crate::db::repos::attachment_repo::AttachmentRepo;
use crate::db::repos::base_record_repo::BaseRecordRepo;
use crate::db::repos::comment_repo::DocNodeCommentRepo;
use crate::db::repos::node_meta_repo::{DocNodeMetaRepo, UpsertDocNodeMetaInput};
use crate::db::repos::version_repo::DocNodeVersionRepo;
use crate::db::repos::view_ctx_repo::DocNodeViewCtxRepo;
use crate::services::docs_service::DocsService;
use crate::services::path_utils;
use crate::error::AppError;
use crate::handlers::{ApiResponse, ok, ok_empty};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeInput {
    pub space_id: Option<String>,
    pub parent_rel_path: Option<String>,
    pub r#type: String,
    pub title: String,
    pub content: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeQuery {
    pub rel_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNodeInput {
    pub content: Option<serde_json::Value>,
    pub title: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub icon: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub cover_image: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveNodeQuery {
    pub from: String,
    pub to: String,
}

fn item_from_meta(space_id: uuid::Uuid, rel_path: String, is_dir: bool) -> DocNodeListItem {
    DocNodeListItem {
        rel_path: rel_path.clone(),
        space_id: space_id.to_string(),
        parent_id: path_utils::parent_of(&rel_path),
        r#type: path_utils::type_for_path(&rel_path, is_dir).to_string(),
        title: path_utils::title_for_path(&rel_path, is_dir),
        icon: None,
        tags: None,
        is_favorite: false,
        is_pinned: false,
        is_archived: false,
        word_count: 0,
        sort_order: 0,
        last_opened_at: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    }
}

async fn rename_related(
    ctx: &AppCtx,
    space_id: uuid::Uuid,
    old_rel: &str,
    new_rel: &str,
    is_dir: bool,
) -> Result<(), AppError> {
    if is_dir {
        DocNodeMetaRepo::rename_path_prefix(&ctx.db, space_id, old_rel, new_rel).await?;
        DocNodeVersionRepo::rename_path_prefix(&ctx.db, space_id, old_rel, new_rel).await?;
        DocNodeCommentRepo::rename_path_prefix(&ctx.db, space_id, old_rel, new_rel).await?;
        AttachmentRepo::rename_path_prefix(&ctx.db, space_id, old_rel, new_rel).await?;
        DocNodeViewCtxRepo::rename_path_prefix(&ctx.db, space_id, old_rel, new_rel).await?;
        BaseRecordRepo::rename_path_prefix(&ctx.db, space_id, old_rel, new_rel).await?;
    } else {
        DocNodeMetaRepo::rename_path(&ctx.db, space_id, old_rel, new_rel).await?;
        DocNodeVersionRepo::rename_path(&ctx.db, space_id, old_rel, new_rel).await?;
        DocNodeCommentRepo::rename_path(&ctx.db, space_id, old_rel, new_rel).await?;
        AttachmentRepo::rename_path(&ctx.db, space_id, old_rel, new_rel).await?;
        DocNodeViewCtxRepo::rename_path(&ctx.db, space_id, old_rel, new_rel).await?;
        BaseRecordRepo::rename_path(&ctx.db, space_id, old_rel, new_rel).await?;
    }
    Ok(())
}

pub async fn create_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Json(input): Json<CreateNodeInput>,
) -> Result<Json<ApiResponse<DocNodeListItem>>, AppError> {
    let space_id = parse_uuid(input.space_id.as_deref().unwrap_or(&id))?;
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    validate_node_name(&input.title)?;
    let parent = input.parent_rel_path.as_deref().unwrap_or("");
    path_utils::validate_relative_path(parent)?;
    let rel_path = match path_utils::extension_for_type(&input.r#type) {
        Some(ext) => {
            if parent.is_empty() {
                format!("{}{}", input.title, ext)
            } else {
                format!("{}/{}{}", parent, input.title, ext)
            }
        }
        None => {
            if parent.is_empty() {
                input.title.clone()
            } else {
                format!("{}/{}", parent, input.title)
            }
        }
    };
    let target = path_utils::vfs_path(&root_path, &rel_path);
    if vfs.stat(&target).await.is_ok() {
        return Err(AppError::BadRequest("node already exists".into()));
    }
    if input.r#type == "folder" {
        vfs.mkdir(&target).await.map_err(vfs_err)?;
    } else {
        let data = path_utils::default_content_for_type(&input.r#type, &input.title, input.content);
        vfs.put(&target, data).await.map_err(vfs_err)?;
    }
    DocNodeMetaRepo::upsert(&ctx.db, space_id, &rel_path, UpsertDocNodeMetaInput::default()).await?;
    Ok(ok(item_from_meta(space_id, rel_path, input.r#type == "folder")))
}

pub async fn get_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let space_id = parse_uuid(&id)?;
    path_utils::validate_relative_path(&q.rel_path)?;
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let path = path_utils::vfs_path(&root_path, &q.rel_path);
    let info = vfs.stat(&path).await.map_err(vfs_err)?;
    DocNodeMetaRepo::update_last_opened(&ctx.db, space_id, &q.rel_path).await?;
    let node_type = path_utils::type_for_path(&q.rel_path, info.is_dir);
    let content = if info.is_dir {
        serde_json::Value::Null
    } else {
        path_utils::content_from_bytes(node_type, vfs.read_bytes(&path, 0, None).await.map_err(vfs_err)?)?
    };
    let meta = DocNodeMetaRepo::find(&ctx.db, space_id, &q.rel_path).await?;
    Ok(ok(serde_json::json!({
        "spaceId": id,
        "relPath": q.rel_path,
        "parentId": path_utils::parent_of(&info.path),
        "type": node_type,
        "title": path_utils::title_for_path(&info.name, info.is_dir),
        "content": content,
        "meta": meta.map(crate::db::entities::DocNodeMetaOutput::from),
        "updatedAt": info.modified.map_or_else(|| chrono::Utc::now().to_rfc3339(), |d| d.to_rfc3339())
    })))
}

pub async fn update_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
    Json(input): Json<UpdateNodeInput>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let space_id = parse_uuid(&id)?;
    path_utils::validate_relative_path(&q.rel_path)?;
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let old_path = path_utils::vfs_path(&root_path, &q.rel_path);
    let info = vfs.stat(&old_path).await.map_err(vfs_err)?;
    let node_type = path_utils::type_for_path(&q.rel_path, info.is_dir).to_string();
    let mut final_rel = q.rel_path.clone();
    if let Some(title) = input.title.as_ref() {
        validate_node_name(title)?;
        let ext = path_utils::extension_for_type(&node_type).unwrap_or("");
        let filename = format!("{title}{ext}");
        let new_rel = path_utils::parent_of(&q.rel_path).map_or(filename.clone(), |p| format!("{p}/{filename}"));
        if new_rel != q.rel_path {
            let new_path = path_utils::vfs_path(&root_path, &new_rel);
            if vfs.stat(&new_path).await.is_ok() {
                return Err(AppError::BadRequest("target already exists".into()));
            }
            vfs.rename(&old_path, &new_path).await.map_err(vfs_err)?;
            rename_related(&ctx, space_id, &q.rel_path, &new_rel, info.is_dir).await?;
            final_rel = new_rel;
        }
    }
    if let Some(content) = input.content.as_ref() {
        let data = path_utils::content_to_bytes(&node_type, content)?;
        vfs.put(&path_utils::vfs_path(&root_path, &final_rel), data)
            .await
            .map_err(vfs_err)?;
        let word_count = DocsService::count_words(content);
        DocNodeVersionRepo::create_if_due(
            &ctx.db,
            space_id,
            &final_rel,
            path_utils::title_for_path(&final_rel, false),
            Some(content.clone()),
            word_count,
        )
        .await?;
    }
    if input.tags.is_some() || input.icon.is_some() || input.cover_image.is_some() {
        DocNodeMetaRepo::upsert(
            &ctx.db,
            space_id,
            &final_rel,
            UpsertDocNodeMetaInput {
                tags: input.tags,
                icon: input.icon,
                cover_image: input.cover_image,
                ..Default::default()
            },
        )
        .await?;
    }
    get_node(State(ctx), Path(id), Query(NodeQuery { rel_path: final_rel })).await
}

pub async fn move_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<MoveNodeQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let space_id = parse_uuid(&id)?;
    path_utils::validate_relative_path(&q.from)?;
    path_utils::validate_relative_path(&q.to)?;
    if q.to == q.from || q.to.starts_with(&format!("{}/", q.from)) {
        return Err(AppError::BadRequest("cannot move node into itself".into()));
    }
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let from = path_utils::vfs_path(&root_path, &q.from);
    let info = vfs.stat(&from).await.map_err(vfs_err)?;
    let to = path_utils::vfs_path(&root_path, &q.to);
    if vfs.stat(&to).await.is_ok() {
        return Err(AppError::BadRequest("target already exists".into()));
    }
    vfs.rename(&from, &to).await.map_err(vfs_err)?;
    rename_related(&ctx, space_id, &q.from, &q.to, info.is_dir).await?;
    Ok(ok_empty())
}

pub async fn archive_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let space_id = parse_uuid(&id)?;
    path_utils::validate_relative_path(&q.rel_path)?;
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let from = path_utils::vfs_path(&root_path, &q.rel_path);
    let info = vfs.stat(&from).await.map_err(vfs_err)?;
    let mut trash_rel = format!(".trash/{}", q.rel_path);
    if vfs.stat(&path_utils::vfs_path(&root_path, &trash_rel)).await.is_ok() {
        trash_rel = format!(".trash/{}.{}", chrono::Utc::now().timestamp(), q.rel_path);
    }
    vfs.rename(&from, &path_utils::vfs_path(&root_path, &trash_rel))
        .await
        .map_err(vfs_err)?;
    rename_related(&ctx, space_id, &q.rel_path, &trash_rel, info.is_dir).await?;
    DocNodeMetaRepo::set_archived(&ctx.db, space_id, &trash_rel, true).await?;
    Ok(ok_empty())
}

pub async fn restore_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let trash_rel = if q.rel_path.starts_with(".trash/") {
        q.rel_path.clone()
    } else {
        format!(".trash/{}", q.rel_path)
    };
    let restore_rel = trash_rel.trim_start_matches(".trash/").to_string();
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let from = path_utils::vfs_path(&root_path, &trash_rel);
    let info = vfs.stat(&from).await.map_err(vfs_err)?;
    let to = path_utils::vfs_path(&root_path, &restore_rel);
    if vfs.stat(&to).await.is_ok() {
        return Err(AppError::BadRequest("restore target already exists".into()));
    }
    vfs.rename(&from, &to).await.map_err(vfs_err)?;
    rename_related(&ctx, space_id, &trash_rel, &restore_rel, info.is_dir).await?;
    DocNodeMetaRepo::set_archived(&ctx.db, space_id, &restore_rel, false).await?;
    Ok(ok_empty())
}

pub async fn delete_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let space_id = parse_uuid(&id)?;
    path_utils::validate_relative_path(&q.rel_path)?;
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let path = path_utils::vfs_path(&root_path, &q.rel_path);
    let info = vfs.stat(&path).await.map_err(vfs_err)?;
    if info.is_dir {
        vfs.delete_dir(&path).await.map_err(vfs_err)?;
    } else {
        vfs.delete_file(&path).await.map_err(vfs_err)?;
    }
    DocNodeMetaRepo::delete(&ctx.db, space_id, &q.rel_path).await?;
    Ok(ok_empty())
}
