use axum::Json;
use axum::extract::{Path, State};
use serde::Deserialize;
use std::sync::Arc;

use super::parse_uuid;
use crate::AppState;
use crate::apps::docs::repos::user_state_repo::UserStateRepo;
use crate::error::AppError;
use crate::handlers::user::AuthUser;
use crate::handlers::{ApiResponse, ok, ok_empty};

// ── DTOs ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PutViewStateBody {
    pub view_state: serde_json::Value,
}

// ── Handlers ────────────────────────────────────────────────────────

/// GET /api/apps/docs/nodes/{id}/view-state
pub async fn get_view_state(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user_id = parse_uuid(&auth_user.0.user_id)?;
    let node_id = parse_uuid(&id)?;

    let record = UserStateRepo::get_view_state(&state.db, user_id, node_id).await?;

    match record {
        Some(r) => Ok(ok(r.view_state)),
        None => Ok(ok(serde_json::Value::Null)),
    }
}

/// PUT /api/apps/docs/nodes/{id}/view-state
pub async fn put_view_state(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PutViewStateBody>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let user_id = parse_uuid(&auth_user.0.user_id)?;
    let node_id = parse_uuid(&id)?;

    if !body.view_state.is_object() {
        return Err(AppError::BadRequest("viewState must be a JSON object".into()));
    }

    UserStateRepo::upsert_view_state(&state.db, user_id, node_id, body.view_state).await?;

    Ok(ok_empty())
}
