use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use std::sync::Arc;

use super::parse_uuid;
use crate::handlers::AppCtx;
use crate::db::repos::view_ctx_repo::DocNodeViewCtxRepo;
use crate::error::AppError;
use crate::handlers::user::AuthUser;
use crate::handlers::{ApiResponse, ok, ok_empty};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PutViewStateBody {
    pub view_ctx: serde_json::Value,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelPathQuery {
    pub rel_path: String,
}

pub async fn get_view_ctx(
    State(ctx): State<Arc<AppCtx>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let record = DocNodeViewCtxRepo::get_view_ctx(
        &ctx.db,
        auth_user.0,
        parse_uuid(&id)?,
        &q.rel_path,
    )
    .await?;
    Ok(ok(record.map_or(serde_json::Value::Null, |r| r.view_ctx)))
}
pub async fn put_view_ctx(
    State(ctx): State<Arc<AppCtx>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
    Json(body): Json<PutViewStateBody>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    if !body.view_ctx.is_object() {
        return Err(AppError::BadRequest("viewState must be a JSON object".into()));
    }
    DocNodeViewCtxRepo::upsert_view_ctx(
        &ctx.db,
        auth_user.0,
        parse_uuid(&id)?,
        &q.rel_path,
        body.view_ctx,
    )
    .await?;
    Ok(ok_empty())
}
