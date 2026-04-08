pub mod collab;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::OptionExt;
use crate::{
    db::entities::doc_nodes,
    db::models::docs::{
        DocNodeCommentOutput, DocNodeOutput, DocNodeVersionDetailOutput,
        DocNodeVersionOutput,
    },
    db::pagination::PageInput,
    db::repos::docs_repo::{
        DocNodeCommentRepo, DocNodeRepo, DocNodeVersionRepo,
        ListDocNodesInput,
    },
    error::AppError,
    handlers::{ok, ok_empty, ApiResponse},
    handlers::user::AuthUser,
    apps::docs::services::docs::DocsService,
    AppState,
};
use sea_orm::*;

fn parse_uuid(s: &str) -> Result<Uuid, AppError> {
    s.parse::<Uuid>()
        .map_err(|_| AppError::BadRequest(format!("invalid uuid: {s}")))
}

/// Characters forbidden in node names (Windows + Linux union).
const FORBIDDEN_CHARS: &[char] = &['\\', '/', ':', '*', '?', '"', '<', '>', '|'];

/// Validate a node name for filesystem-compatible rules.
fn validate_node_name(name: &str) -> Result<(), AppError> {
    if name.is_empty() {
        return Err(AppError::BadRequest("node name cannot be empty".into()));
    }
    if name.len() > 255 {
        return Err(AppError::BadRequest("node name too long (max 255 chars)".into()));
    }
    if let Some(ch) = name.chars().find(|c| FORBIDDEN_CHARS.contains(c)) {
        return Err(AppError::BadRequest(format!("node name contains forbidden character: {ch}")));
    }
    if name.starts_with('.') || name.ends_with('.') {
        return Err(AppError::BadRequest("node name cannot start or end with a dot".into()));
    }
    if name != name.trim() {
        return Err(AppError::BadRequest("node name cannot have leading or trailing spaces".into()));
    }
    Ok(())
}

/// Verify that the parent node exists and is a folder.
async fn verify_parent_is_folder(
    db: &DatabaseConnection,
    parent_id: Uuid,
) -> Result<(), AppError> {
    let parent = doc_nodes::Entity::find_by_id(parent_id)
        .one(db)
        .await?
        .not_found("parent node not found")?;
    if parent.r#type != "folder" {
        return Err(AppError::BadRequest("parent node is not a folder".into()));
    }
    Ok(())
}

/// Check that no sibling with the same title exists under the same parent.
async fn check_unique_sibling_name(
    db: &DatabaseConnection,
    app_id: Uuid,
    parent_id: Option<Uuid>,
    title: &str,
    exclude_id: Option<Uuid>,
) -> Result<(), AppError> {
    let mut q = doc_nodes::Entity::find()
        .filter(doc_nodes::Column::AppId.eq(app_id))
        .filter(doc_nodes::Column::Title.eq(title))
        .filter(doc_nodes::Column::IsArchived.eq(false));
    q = if let Some(pid) = parent_id {
        q.filter(doc_nodes::Column::ParentId.eq(pid))
    } else {
        q.filter(doc_nodes::Column::ParentId.is_null())
    };
    if let Some(eid) = exclude_id {
        q = q.filter(doc_nodes::Column::Id.ne(eid));
    }
    let existing = q.one(db).await?;
    if existing.is_some() {
        return Err(AppError::BadRequest(format!(
            "a node named \"{title}\" already exists in this location"
        )));
    }
    Ok(())
}

/// Check that moving `node_id` under `target_parent_id` does not create a cycle.
async fn check_no_cycle(
    db: &DatabaseConnection,
    node_id: Uuid,
    target_parent_id: Uuid,
) -> Result<(), AppError> {
    let mut current = Some(target_parent_id);
    while let Some(pid) = current {
        if pid == node_id {
            return Err(AppError::BadRequest("cannot move a node under itself".into()));
        }
        let parent = doc_nodes::Entity::find_by_id(pid).one(db).await?;
        current = parent.and_then(|p| p.parent_id);
    }
    Ok(())
}

// -- Query / Request types ----------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListNodesQuery {
    pub page: Option<u64>,
    pub page_size: Option<u64>,
    pub parent_id: Option<String>,
    pub r#type: Option<String>,
    pub is_archived: Option<bool>,
    pub is_favorite: Option<bool>,
    pub search: Option<String>,
    pub sort: Option<String>,
    pub direction: Option<String>,
    pub tags: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeInput {
    pub r#type: Option<String>,
    pub title: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNodeInput {
    pub title: Option<String>,
    pub content: Option<Option<serde_json::Value>>,
    pub icon: Option<Option<String>>,
    pub cover_image: Option<Option<String>>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveNodeInput {
    pub parent_id: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentInput {
    pub comment_key: String,
    pub content: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveCommentInput {
    pub resolved: bool,
}

// -- Node handlers ------------------------------------------------------------

/// GET /api/apps/{id}/docs/nodes
pub async fn list_nodes(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<ListNodesQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let app_id = parse_uuid(&id)?;
    let page_input = PageInput {
        page: q.page.unwrap_or(1),
        page_size: q.page_size.unwrap_or(50),
    };

    // parent_id handling: "root" or empty string = root (None parent), absent = all
    let parent_id: Option<Option<Uuid>> = match q.parent_id.as_deref() {
        Some("root" | "") => Some(None),
        Some(s) => Some(Some(parse_uuid(s)?)),
        None => None,
    };

    let tags_filter: Option<Vec<String>> = q.tags.as_ref().map(|t| {
        t.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    let result = DocNodeRepo::list(
        &state.db,
        ListDocNodesInput {
            app_id,
            page: page_input,
            sort_by: q.sort.clone().unwrap_or_else(|| "updatedAt".to_string()),
            sort_dir: q.direction.clone().unwrap_or_else(|| "desc".to_string()),
            search: q.search.clone(),
            parent_id,
            node_type: q.r#type.clone(),
            favorites_only: q.is_favorite.unwrap_or(false),
            tags_filter,
            archived: q.is_archived.unwrap_or(false),
        },
    )
    .await?;

    Ok(ok(serde_json::to_value(result)?))
}

/// GET /api/apps/{id}/docs/nodes/tags
pub async fn list_node_tags(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<String>>>, AppError> {
    let app_id = parse_uuid(&id)?;
    let tags = DocNodeRepo::list_tags(&state.db, app_id).await?;
    Ok(ok(tags))
}

/// POST /api/apps/{id}/docs/nodes
pub async fn create_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<CreateNodeInput>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let app_id = parse_uuid(&id)?;
    let parent_id = input
        .parent_id
        .as_deref()
        .map(parse_uuid)
        .transpose()?;
    let node_type = input.r#type.unwrap_or_else(|| "notion".to_string());
    let title = input.title.unwrap_or_default();

    // Validate name
    if !title.is_empty() {
        validate_node_name(&title)?;
    }

    // Parent must be a folder
    if let Some(pid) = parent_id {
        verify_parent_is_folder(&state.db, pid).await?;
    }

    // Unique sibling name (only if title is non-empty)
    if !title.is_empty() {
        check_unique_sibling_name(&state.db, app_id, parent_id, &title, None).await?;
    }

    let node = DocNodeRepo::create(&state.db, app_id, node_type, title, parent_id).await?;
    Ok(ok(DocNodeOutput::from(node)))
}

/// GET /api/apps/docs/nodes/{id}
pub async fn get_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let node = DocNodeRepo::get_by_id(&state.db, node_id)
        .await?
        .not_found("node not found")?;
    Ok(ok(DocNodeOutput::from(node)))
}

/// PATCH /api/apps/docs/nodes/{id}
pub async fn update_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateNodeInput>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let node_id = parse_uuid(&id)?;

    // Validate title if being changed
    if let Some(ref title) = input.title {
        if !title.is_empty() {
            validate_node_name(title)?;
        }
        // Check unique sibling name
        let node = DocNodeRepo::get_by_id(&state.db, node_id)
            .await?
            .not_found("node not found")?;
        if !title.is_empty() && title != &node.title {
            check_unique_sibling_name(&state.db, node.app_id, node.parent_id, title, Some(node_id)).await?;
        }
    }

    let node = DocsService::update_node_with_version(
        &state.db,
        node_id,
        input.title,
        input.content,
        input.icon,
        input.cover_image,
        input.tags,
    )
    .await?;
    Ok(ok(DocNodeOutput::from(node)))
}

/// DELETE /api/apps/docs/nodes/{id} — soft delete (archive)
pub async fn archive_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let archived = DocNodeRepo::archive(&state.db, node_id, true).await?;
    if !archived {
        return Err(AppError::NotFound("node not found".into()));
    }
    Ok(ok_empty())
}

/// PATCH /api/apps/docs/nodes/{id}/restore
pub async fn restore_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let restored = DocNodeRepo::archive(&state.db, node_id, false).await?;
    if !restored {
        return Err(AppError::NotFound("node not found".into()));
    }
    Ok(ok_empty())
}

/// DELETE /api/apps/docs/nodes/{id}/permanent — hard delete
pub async fn delete_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let deleted = DocNodeRepo::delete(&state.db, node_id).await?;
    if !deleted {
        return Err(AppError::NotFound("node not found".into()));
    }
    Ok(ok_empty())
}

/// PATCH /api/apps/docs/nodes/{id}/favorite
pub async fn toggle_favorite(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let new_state = DocNodeRepo::toggle_favorite(&state.db, node_id)
        .await?
        .not_found("node not found")?;
    Ok(ok(serde_json::json!({ "isFavorite": new_state })))
}

/// PATCH /api/apps/docs/nodes/{id}/pin
pub async fn toggle_pin(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let new_state = DocNodeRepo::toggle_pin(&state.db, node_id)
        .await?
        .not_found("node not found")?;
    Ok(ok(serde_json::json!({ "isPinned": new_state })))
}

/// PATCH /api/apps/docs/nodes/{id}/move
pub async fn move_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<MoveNodeInput>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let parent_id = input
        .parent_id
        .as_deref()
        .map(parse_uuid)
        .transpose()?;

    // Parent must be a folder (if moving into a parent)
    if let Some(pid) = parent_id {
        verify_parent_is_folder(&state.db, pid).await?;
        check_no_cycle(&state.db, node_id, pid).await?;
    }

    // Check unique sibling name at destination
    let node = DocNodeRepo::get_by_id(&state.db, node_id)
        .await?
        .not_found("node not found")?;
    if parent_id != node.parent_id && !node.title.is_empty() {
        check_unique_sibling_name(&state.db, node.app_id, parent_id, &node.title, Some(node_id)).await?;
    }

    let moved =
        DocNodeRepo::move_node(&state.db, node_id, parent_id, input.sort_order).await?;
    if !moved {
        return Err(AppError::NotFound("node not found".into()));
    }
    Ok(ok_empty())
}

// -- Comment handlers ---------------------------------------------------------

/// GET /api/apps/docs/nodes/{id}/comments
pub async fn list_comments(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<DocNodeCommentOutput>>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let comments = DocNodeCommentRepo::list_by_node(&state.db, node_id).await?;
    Ok(ok(comments))
}

/// POST /api/apps/docs/nodes/{id}/comments
pub async fn create_comment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    auth_user: AuthUser,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let user_id = parse_uuid(&auth_user.0.user_id)?;
    let parent_id = input
        .parent_id
        .as_deref()
        .map(parse_uuid)
        .transpose()?;
    let comment = DocNodeCommentRepo::create(
        &state.db,
        node_id,
        user_id,
        input.comment_key,
        input.content,
        parent_id,
    )
    .await?;

    Ok(ok(serde_json::json!({
        "id": comment.id.to_string(),
        "commentKey": comment.comment_key,
        "createdAt": comment.created_at.to_rfc3339(),
    })))
}

/// PATCH /api/apps/docs/node-comments/{id}/resolve
pub async fn resolve_comment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<ResolveCommentInput>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let comment_id = parse_uuid(&id)?;
    let resolved = DocNodeCommentRepo::resolve(&state.db, comment_id, input.resolved).await?;
    if !resolved {
        return Err(AppError::NotFound("comment not found".into()));
    }
    Ok(ok_empty())
}

/// DELETE /api/apps/docs/node-comments/{id}
pub async fn delete_comment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let comment_id = parse_uuid(&id)?;
    let deleted = DocNodeCommentRepo::delete(&state.db, comment_id).await?;
    if !deleted {
        return Err(AppError::NotFound("comment not found".into()));
    }
    Ok(ok_empty())
}

// -- Version handlers ---------------------------------------------------------

/// GET /api/apps/docs/nodes/{id}/versions
pub async fn list_versions(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<DocNodeVersionOutput>>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let versions = DocNodeVersionRepo::list(&state.db, node_id).await?;
    let outputs: Vec<DocNodeVersionOutput> = versions
        .into_iter()
        .map(DocNodeVersionOutput::from)
        .collect();
    Ok(ok(outputs))
}

/// GET /api/apps/docs/node-versions/{id}
pub async fn get_version(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<DocNodeVersionDetailOutput>>, AppError> {
    let version_id = parse_uuid(&id)?;
    let version = DocNodeVersionRepo::get_by_id(&state.db, version_id)
        .await?
        .not_found("version not found")?;
    Ok(ok(DocNodeVersionDetailOutput::from(version)))
}

/// POST /api/apps/docs/nodes/{id}/versions/{version_id}/restore
pub async fn restore_version(
    State(state): State<Arc<AppState>>,
    Path((id, version_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let vid = parse_uuid(&version_id)?;

    let version = DocNodeVersionRepo::get_by_id(&state.db, vid)
        .await?
        .not_found("version not found")?;

    if version.node_id != node_id {
        return Err(AppError::BadRequest(
            "version does not belong to this node".into(),
        ));
    }

    // Restore: update node with version's content and title
    let node = DocsService::update_node_with_version(
        &state.db,
        node_id,
        Some(version.title),
        Some(version.content),
        None,
        None,
        None,
    )
    .await?;
    Ok(ok(DocNodeOutput::from(node)))
}
