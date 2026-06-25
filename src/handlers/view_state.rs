use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use std::sync::Arc;
use ts_rs::TS;

use super::parse_uuid;
use crate::db::repos::view_state_repo::DocNodeViewStateRepo;
use crate::error::AppError;
use crate::handlers::AppCtx;
use crate::handlers::user::AuthUser;
use crate::handlers::{ApiResponse, ok, ok_empty};

#[derive(Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct PutViewStateBody {
    pub view_state: serde_json::Value,
}
#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RelPathQuery {
    pub rel_path: String,
}

pub async fn get_view_state(
    State(ctx): State<Arc<AppCtx>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let record = DocNodeViewStateRepo::get_view_state(&ctx.db, auth_user.0, parse_uuid(&id)?, &q.rel_path).await?;
    Ok(ok(record.map_or(serde_json::Value::Null, |r| r.view_state)))
}
pub async fn put_view_state(
    State(ctx): State<Arc<AppCtx>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
    Json(body): Json<PutViewStateBody>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    if !body.view_state.is_object() {
        return Err(AppError::BadRequest("viewState must be a JSON object".into()));
    }
    DocNodeViewStateRepo::upsert_view_state(&ctx.db, auth_user.0, parse_uuid(&id)?, &q.rel_path, body.view_state)
        .await?;
    Ok(ok_empty())
}
