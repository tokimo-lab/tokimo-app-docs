use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use std::sync::Arc;

use super::parse_uuid;
use crate::db::entities::DocNodeCommentOutput;
use crate::db::repos::comment_repo::DocNodeCommentRepo;
use crate::error::AppError;
use crate::handlers::AppCtx;
use crate::handlers::user::AuthUser;
use crate::handlers::{ApiResponse, ok, ok_empty};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelPathQuery {
    pub rel_path: String,
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

pub async fn list_comments(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
) -> Result<Json<ApiResponse<Vec<DocNodeCommentOutput>>>, AppError> {
    Ok(ok(DocNodeCommentRepo::list_by_node(
        &ctx.db,
        parse_uuid(&id)?,
        &q.rel_path,
    )
    .await?))
}
pub async fn create_comment(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
    auth_user: AuthUser,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let comment = DocNodeCommentRepo::create(
        &ctx.db,
        parse_uuid(&id)?,
        &q.rel_path,
        auth_user.0,
        input.comment_key,
        input.content,
        input.parent_id.as_deref().map(parse_uuid).transpose()?,
    )
    .await?;
    Ok(ok(
        serde_json::json!({"id": comment.id.to_string(), "commentKey": comment.comment_key, "createdAt": comment.created_at.to_rfc3339()}),
    ))
}
pub async fn resolve_comment(
    State(ctx): State<Arc<AppCtx>>,
    Path((_space_id, comment_id)): Path<(String, String)>,
    Json(input): Json<ResolveCommentInput>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    if !DocNodeCommentRepo::resolve(&ctx.db, parse_uuid(&comment_id)?, input.resolved).await? {
        return Err(AppError::NotFound("comment not found".into()));
    }
    Ok(ok_empty())
}
pub async fn delete_comment(
    State(ctx): State<Arc<AppCtx>>,
    Path((_space_id, comment_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    if !DocNodeCommentRepo::delete(&ctx.db, parse_uuid(&comment_id)?).await? {
        return Err(AppError::NotFound("comment not found".into()));
    }
    Ok(ok_empty())
}
