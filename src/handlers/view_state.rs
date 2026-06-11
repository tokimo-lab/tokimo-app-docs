use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use std::sync::Arc;
use ts_rs::TS;

use super::parse_uuid;
use crate::db::repos::view_ctx_repo::DocNodeViewCtxRepo;
use crate::error::AppError;
use crate::handlers::AppCtx;
use crate::handlers::user::AuthUser;
use crate::handlers::{ApiResponse, ok, ok_empty};

#[derive(Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct PutViewStateBody {
    pub view_ctx: serde_json::Value,
}
#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RelPathQuery {
    pub rel_path: String,
}

pub async fn get_view_ctx(
    State(ctx): State<Arc<AppCtx>>,
    _auth_user: AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let record = DocNodeViewCtxRepo::get_view_ctx(&ctx.db, parse_uuid(&id)?, &q.rel_path).await?;
    Ok(ok(record.map_or(serde_json::Value::Null, |r| {
        serde_json::json!({
            "scrollPosition": r.scroll_position,
            "lastViewedAt": r.last_viewed_at.map(|d| d.to_rfc3339()),
        })
    })))
}
pub async fn put_view_ctx(
    State(ctx): State<Arc<AppCtx>>,
    _auth_user: AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
    Json(body): Json<PutViewStateBody>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    if !body.view_ctx.is_object() {
        return Err(AppError::BadRequest("viewState must be a JSON object".into()));
    }
    let scroll = body
        .view_ctx
        .get("scrollPosition")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32);
    DocNodeViewCtxRepo::upsert_view_ctx(&ctx.db, parse_uuid(&id)?, &q.rel_path, scroll).await?;
    Ok(ok_empty())
}
