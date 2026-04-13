use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;

use super::parse_uuid;
use crate::apps::docs::repos::base_record_repo::BaseRecordRepo;
use crate::db::entities::docs_base_records;
use crate::db::pagination::{Page, PageInput};
use crate::error::AppError;
use crate::handlers::user::AuthUser;
use crate::handlers::{ok, ok_empty, ApiResponse};
use crate::AppState;

// ── Output DTOs ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BaseRecordOutput {
    pub id: String,
    pub node_id: String,
    pub data: serde_json::Value,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<docs_base_records::Model> for BaseRecordOutput {
    fn from(m: docs_base_records::Model) -> Self {
        Self {
            id: m.id.to_string(),
            node_id: m.node_id.to_string(),
            data: m.data,
            sort_order: m.sort_order,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}

// ── Input ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordInput {
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecordInput {
    pub data: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDeleteInput {
    pub ids: Vec<String>,
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// GET /api/apps/docs/base/{nodeId}/records
pub async fn list_records(
    State(state): State<Arc<AppState>>,
    AuthUser(_auth): AuthUser,
    Path(node_id): Path<String>,
    Query(page): Query<PageInput>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let uid = parse_uuid(&node_id)?;
    let result: Page<docs_base_records::Model> =
        BaseRecordRepo::list(&state.db, uid, &page).await?;

    let output = Page::new(
        result.items.into_iter().map(BaseRecordOutput::from).collect(),
        result.total,
        &page,
    );
    Ok(ok(serde_json::to_value(output)?))
}

/// POST /api/apps/docs/base/{nodeId}/records
pub async fn create_record(
    State(state): State<Arc<AppState>>,
    AuthUser(_auth): AuthUser,
    Path(node_id): Path<String>,
    Json(body): Json<CreateRecordInput>,
) -> Result<Json<ApiResponse<BaseRecordOutput>>, AppError> {
    let uid = parse_uuid(&node_id)?;
    let data = body.data.unwrap_or(serde_json::json!({}));
    let max_sort = BaseRecordRepo::max_sort_order(&state.db, uid).await?;
    let record = BaseRecordRepo::create(&state.db, uid, data, max_sort + 1).await?;
    Ok(ok(BaseRecordOutput::from(record)))
}

/// PATCH /api/apps/docs/base/records/{recordId}
pub async fn update_record(
    State(state): State<Arc<AppState>>,
    AuthUser(_auth): AuthUser,
    Path(record_id): Path<String>,
    Json(body): Json<UpdateRecordInput>,
) -> Result<Json<ApiResponse<BaseRecordOutput>>, AppError> {
    let uid = parse_uuid(&record_id)?;
    let record = BaseRecordRepo::update(&state.db, uid, body.data, body.sort_order).await?;
    Ok(ok(BaseRecordOutput::from(record)))
}

/// DELETE /api/apps/docs/base/records/{recordId}
pub async fn delete_record(
    State(state): State<Arc<AppState>>,
    AuthUser(_auth): AuthUser,
    Path(record_id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let uid = parse_uuid(&record_id)?;
    BaseRecordRepo::delete(&state.db, uid).await?;
    Ok(ok_empty())
}

/// POST /api/apps/docs/base/{nodeId}/records/batch-delete
pub async fn batch_delete_records(
    State(state): State<Arc<AppState>>,
    AuthUser(_auth): AuthUser,
    Path(_node_id): Path<String>,
    Json(body): Json<BatchDeleteInput>,
) -> Result<Json<ApiResponse<BatchDeleteOutput>>, AppError> {
    let ids: Vec<uuid::Uuid> = body
        .ids
        .iter()
        .map(|s| parse_uuid(s))
        .collect::<Result<Vec<_>, _>>()?;
    let deleted = BaseRecordRepo::batch_delete(&state.db, ids).await?;
    Ok(ok(BatchDeleteOutput {
        deleted: deleted as i64,
    }))
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BatchDeleteOutput {
    #[ts(type = "number")]
    pub deleted: i64,
}
