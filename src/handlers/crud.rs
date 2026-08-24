use axum::Json;
use axum::extract::{Path, Query, State};
use sea_orm::{ConnectionTrait, TransactionTrait};
use serde::Deserialize;
use std::path::{Component, Path as FsPath};
use std::sync::Arc;
use ts_rs::TS;

use super::{ensure_space_vfs, get_space, parse_uuid, validate_node_name, vfs_err};
use crate::db::entities::DocNodeListItem;
use crate::db::repos::attachment_repo::AttachmentRepo;
use crate::db::repos::base_record_repo::BaseRecordRepo;
use crate::db::repos::comment_repo::DocNodeCommentRepo;
use crate::db::repos::node_meta_repo::{DocNodeMetaRepo, UpsertDocNodeMetaInput};
use crate::db::repos::version_repo::DocNodeVersionRepo;
use crate::db::repos::view_state_repo::DocNodeViewStateRepo;
use crate::error::AppError;
use crate::handlers::AppCtx;
use crate::handlers::{ApiResponse, ok, ok_empty};
use crate::services::docs_service::DocsService;
use crate::services::path_utils;

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeInput {
    pub space_id: Option<String>,
    pub parent_rel_path: Option<String>,
    pub r#type: String,
    pub title: String,
    pub content: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct NodeQuery {
    pub rel_path: Option<String>,
    pub node_id: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNodeInput {
    pub content: Option<serde_json::Value>,
    pub title: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    #[ts(type = "string | null")]
    pub icon: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    #[ts(type = "string | null")]
    pub cover_image: Option<Option<String>>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct MoveNodeQuery {
    pub from: String,
    pub to: String,
}

fn item_from_meta(meta: &crate::db::entities::docs_node_meta::Model, is_dir: bool) -> DocNodeListItem {
    let rel_path = meta.rel_path.clone();
    DocNodeListItem {
        id: meta.id.to_string(),
        rel_path: rel_path.clone(),
        space_id: meta.space_id.to_string(),
        parent_id: path_utils::parent_of(&rel_path),
        r#type: path_utils::type_for_path(&rel_path, is_dir).to_string(),
        title: path_utils::title_for_path(&rel_path, is_dir),
        icon: meta.icon.clone(),
        tags: meta.tags.as_ref().and_then(|value| {
            value.as_array().map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(ToOwned::to_owned))
                    .collect()
            })
        }),
        is_favorite: meta.is_favorite,
        is_pinned: meta.is_pinned,
        is_archived: meta.is_archived,
        word_count: meta.word_count,
        sort_order: meta.sort_order,
        last_opened_at: meta.last_opened_at.map(|value| value.to_rfc3339()),
        created_at: meta.created_at.to_rfc3339(),
        updated_at: meta.updated_at.to_rfc3339(),
    }
}

async fn resolve_node(
    ctx: &AppCtx,
    space_id: uuid::Uuid,
    query: &NodeQuery,
) -> Result<crate::db::entities::docs_node_meta::Model, AppError> {
    if let Some(node_id) = query.node_id.as_deref() {
        return DocNodeMetaRepo::find_by_node_id(&ctx.db, space_id, parse_uuid(node_id)?)
            .await?
            .ok_or_else(|| AppError::NotFound("document not found".into()));
    }
    let rel_path = query
        .rel_path
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("nodeId or relPath is required".into()))?;
    path_utils::validate_relative_path(rel_path)?;
    DocNodeMetaRepo::upsert(&ctx.db, space_id, rel_path, UpsertDocNodeMetaInput::default()).await
}

async fn rename_related<C: ConnectionTrait>(
    db: &C,
    space_id: uuid::Uuid,
    old_rel: &str,
    new_rel: &str,
    is_dir: bool,
) -> Result<(), AppError> {
    if is_dir {
        DocNodeMetaRepo::rename_path_prefix(db, space_id, old_rel, new_rel).await?;
        DocNodeVersionRepo::rename_path_prefix(db, space_id, old_rel, new_rel).await?;
        DocNodeCommentRepo::rename_path_prefix(db, space_id, old_rel, new_rel).await?;
        AttachmentRepo::rename_path_prefix(db, space_id, old_rel, new_rel).await?;
        DocNodeViewStateRepo::rename_path_prefix(db, space_id, old_rel, new_rel).await?;
        BaseRecordRepo::rename_path_prefix(db, space_id, old_rel, new_rel).await?;
    } else {
        DocNodeMetaRepo::rename_path(db, space_id, old_rel, new_rel).await?;
        DocNodeVersionRepo::rename_path(db, space_id, old_rel, new_rel).await?;
        DocNodeCommentRepo::rename_path(db, space_id, old_rel, new_rel).await?;
        AttachmentRepo::rename_path(db, space_id, old_rel, new_rel).await?;
        DocNodeViewStateRepo::rename_path(db, space_id, old_rel, new_rel).await?;
        BaseRecordRepo::rename_path(db, space_id, old_rel, new_rel).await?;
    }
    Ok(())
}

async fn commit_related_rename(
    ctx: &AppCtx,
    space_id: uuid::Uuid,
    old_rel: &str,
    new_rel: &str,
    is_dir: bool,
    archived: Option<bool>,
) -> Result<(), AppError> {
    let txn = ctx.db.begin().await?;
    rename_related(&txn, space_id, old_rel, new_rel, is_dir).await?;
    if let Some(archived) = archived {
        DocNodeMetaRepo::set_archived(&txn, space_id, new_rel, archived).await?;
    }
    txn.commit().await?;
    Ok(())
}

fn archive_rel_path(node_id: uuid::Uuid, rel_path: &str) -> String {
    format!(".trash/{node_id}/{rel_path}")
}

fn restore_rel_path(trash_rel_path: &str) -> Result<String, AppError> {
    let archived = trash_rel_path
        .strip_prefix(".trash/")
        .ok_or_else(|| AppError::BadRequest("node is not archived".into()))?;
    let Some((namespace, original)) = archived.split_once('/') else {
        return Ok(archived.to_string());
    };
    if uuid::Uuid::parse_str(namespace).is_ok() {
        if original.is_empty() {
            return Err(AppError::BadRequest("archived node has no original path".into()));
        }
        return Ok(original.to_string());
    }
    Ok(archived.to_string())
}

async fn ensure_vfs_parent_dirs(vfs: &tokimo_vfs::Vfs, root_path: &str, rel_path: &str) -> Result<(), AppError> {
    let Some(parent) = FsPath::new(rel_path).parent() else {
        return Ok(());
    };
    let mut current = path_utils::vfs_path(root_path, "");
    for component in parent.components() {
        let Component::Normal(part) = component else {
            continue;
        };
        current.push(part);
        if vfs.stat(&current).await.is_err() {
            vfs.mkdir(&current).await.map_err(vfs_err)?;
        }
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
    let meta = match DocNodeMetaRepo::upsert(&ctx.db, space_id, &rel_path, UpsertDocNodeMetaInput::default()).await {
        Ok(meta) => meta,
        Err(error) => {
            let cleanup = if input.r#type == "folder" {
                vfs.delete_dir(&target).await
            } else {
                vfs.delete_file(&target).await
            };
            if let Err(cleanup_error) = cleanup {
                return Err(AppError::Internal(format!(
                    "failed to create node metadata ({error}); VFS rollback also failed: {cleanup_error}"
                )));
            }
            return Err(error);
        }
    };
    Ok(ok(item_from_meta(&meta, input.r#type == "folder")))
}

pub async fn get_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let meta = resolve_node(&ctx, space_id, &q).await?;
    let rel_path = meta.rel_path.clone();
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let path = path_utils::vfs_path(&root_path, &rel_path);
    let info = vfs.stat(&path).await.map_err(vfs_err)?;
    DocNodeMetaRepo::update_last_opened(&ctx.db, space_id, &rel_path).await?;
    let node_type = path_utils::type_for_path(&rel_path, info.is_dir);
    let content = if info.is_dir {
        serde_json::Value::Null
    } else {
        path_utils::content_from_bytes(node_type, vfs.read_bytes(&path, 0, None).await.map_err(vfs_err)?)?
    };
    Ok(ok(serde_json::json!({
        "id": meta.id,
        "spaceId": id,
        "relPath": rel_path,
        "parentId": path_utils::parent_of(&meta.rel_path),
        "type": node_type,
        "title": path_utils::title_for_path(&info.name, info.is_dir),
        "content": content,
        "meta": crate::db::entities::DocNodeMetaOutput::from(meta),
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
    let meta = resolve_node(&ctx, space_id, &q).await?;
    let original_rel = meta.rel_path.clone();
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let old_path = path_utils::vfs_path(&root_path, &original_rel);
    let info = vfs.stat(&old_path).await.map_err(vfs_err)?;
    let node_type = path_utils::type_for_path(&original_rel, info.is_dir).to_string();
    let mut final_rel = original_rel.clone();
    if let Some(title) = input.title.as_ref() {
        validate_node_name(title)?;
        let ext = path_utils::extension_for_type(&node_type).unwrap_or("");
        let filename = format!("{title}{ext}");
        let new_rel = path_utils::parent_of(&original_rel).map_or(filename.clone(), |p| format!("{p}/{filename}"));
        if new_rel != original_rel {
            let new_path = path_utils::vfs_path(&root_path, &new_rel);
            if vfs.stat(&new_path).await.is_ok() {
                return Err(AppError::BadRequest("target already exists".into()));
            }
            vfs.rename(&old_path, &new_path).await.map_err(vfs_err)?;
            if let Err(error) = commit_related_rename(&ctx, space_id, &original_rel, &new_rel, info.is_dir, None).await
            {
                if let Err(rollback_error) = vfs.rename(&new_path, &old_path).await {
                    return Err(AppError::Internal(format!(
                        "database rename failed ({error}); VFS rollback also failed: {rollback_error}"
                    )));
                }
                return Err(error);
            }
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
    get_node(
        State(ctx),
        Path(id),
        Query(NodeQuery {
            rel_path: None,
            node_id: Some(meta.id.to_string()),
        }),
    )
    .await
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
    if let Err(error) = commit_related_rename(&ctx, space_id, &q.from, &q.to, info.is_dir, None).await {
        if let Err(rollback_error) = vfs.rename(&to, &from).await {
            return Err(AppError::Internal(format!(
                "database move failed ({error}); VFS rollback also failed: {rollback_error}"
            )));
        }
        return Err(error);
    }
    Ok(ok_empty())
}

pub async fn archive_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let meta = resolve_node(&ctx, space_id, &q).await?;
    let rel_path = meta.rel_path;
    let node_id = meta.id;
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let from = path_utils::vfs_path(&root_path, &rel_path);
    let info = vfs.stat(&from).await.map_err(vfs_err)?;
    let trash_rel = archive_rel_path(node_id, &rel_path);
    let trash_path = path_utils::vfs_path(&root_path, &trash_rel);
    if vfs.stat(&trash_path).await.is_ok() {
        return Err(AppError::BadRequest("archive target already exists".into()));
    }
    ensure_vfs_parent_dirs(&vfs, &root_path, &trash_rel).await?;
    vfs.rename(&from, &trash_path).await.map_err(vfs_err)?;
    if let Err(error) = commit_related_rename(&ctx, space_id, &rel_path, &trash_rel, info.is_dir, Some(true)).await {
        if let Err(rollback_error) = vfs.rename(&trash_path, &from).await {
            return Err(AppError::Internal(format!(
                "database archive failed ({error}); VFS rollback also failed: {rollback_error}"
            )));
        }
        return Err(error);
    }
    Ok(ok_empty())
}

pub async fn restore_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let meta = resolve_node(&ctx, space_id, &q).await?;
    let trash_rel = if meta.rel_path.starts_with(".trash/") {
        meta.rel_path
    } else {
        format!(".trash/{}", meta.rel_path)
    };
    let restore_rel = restore_rel_path(&trash_rel)?;
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let from = path_utils::vfs_path(&root_path, &trash_rel);
    let info = vfs.stat(&from).await.map_err(vfs_err)?;
    let to = path_utils::vfs_path(&root_path, &restore_rel);
    if vfs.stat(&to).await.is_ok() {
        return Err(AppError::BadRequest("restore target already exists".into()));
    }
    ensure_vfs_parent_dirs(&vfs, &root_path, &restore_rel).await?;
    vfs.rename(&from, &to).await.map_err(vfs_err)?;
    if let Err(error) = commit_related_rename(&ctx, space_id, &trash_rel, &restore_rel, info.is_dir, Some(false)).await
    {
        if let Err(rollback_error) = vfs.rename(&to, &from).await {
            return Err(AppError::Internal(format!(
                "database restore failed ({error}); VFS rollback also failed: {rollback_error}"
            )));
        }
        return Err(error);
    }
    Ok(ok_empty())
}

pub async fn delete_node(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<NodeQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let meta = resolve_node(&ctx, space_id, &q).await?;
    let rel_path = meta.rel_path;
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let path = path_utils::vfs_path(&root_path, &rel_path);
    let info = vfs.stat(&path).await.map_err(vfs_err)?;
    if info.is_dir {
        vfs.delete_dir(&path).await.map_err(vfs_err)?;
    } else {
        vfs.delete_file(&path).await.map_err(vfs_err)?;
    }
    DocNodeMetaRepo::delete(&ctx.db, space_id, &rel_path).await?;
    Ok(ok_empty())
}

#[cfg(test)]
mod tests {
    use super::{archive_rel_path, restore_rel_path};

    #[test]
    fn archive_path_namespaces_original_path_by_stable_node_id() {
        let node_id = uuid::Uuid::parse_str("7c98f94d-f20d-426f-ac50-f16563c624f8").expect("valid UUID");
        let original = "项目/演示文稿.tokimo-slide.json";

        let archived = archive_rel_path(node_id, original);

        assert_eq!(
            archived,
            ".trash/7c98f94d-f20d-426f-ac50-f16563c624f8/项目/演示文稿.tokimo-slide.json"
        );
        assert_eq!(restore_rel_path(&archived).expect("restorable"), original);
    }

    #[test]
    fn restore_path_remains_compatible_with_legacy_archives() {
        assert_eq!(
            restore_rel_path(".trash/项目/文档.tokimo-doc.json").expect("restorable"),
            "项目/文档.tokimo-doc.json"
        );
    }

    #[test]
    fn restore_path_rejects_non_archived_nodes() {
        assert!(restore_rel_path("项目/文档.tokimo-doc.json").is_err());
    }
}
