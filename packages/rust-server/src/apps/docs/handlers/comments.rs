use axum::Json;
use axum::extract::{Path, State};
use serde::Deserialize;
use std::sync::Arc;

use super::parse_uuid;
use crate::AppState;
use crate::apps::docs::models::DocNodeCommentOutput;
use crate::apps::docs::repos::comment_repo::DocNodeCommentRepo;
use crate::error::AppError;
use crate::handlers::user::AuthUser;
use crate::handlers::{ApiResponse, ok, ok_empty};

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
    let parent_id = input.parent_id.as_deref().map(parse_uuid).transpose()?;
    let comment =
        DocNodeCommentRepo::create(&state.db, node_id, user_id, input.comment_key, input.content, parent_id).await?;

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
