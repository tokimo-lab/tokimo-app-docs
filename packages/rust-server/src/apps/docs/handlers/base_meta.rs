use axum::Json;
use axum::extract::{Path, State};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;

use super::parse_uuid;
use crate::AppState;
use crate::db::entities::doc_nodes;
use crate::error::{AppError, OptionExt};
use crate::handlers::user::AuthUser;
use crate::handlers::{ApiResponse, ok};
use sea_orm::*;

// ── Output DTOs ──────────────────────────────────────────────────────────────

/// Full base metadata: fields + views + activeViewId
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BaseMetaOutput {
    pub node_id: String,
    /// Fields array from doc_nodes.content
    pub fields: serde_json::Value,
    /// Views array from doc_nodes.content
    pub views: serde_json::Value,
    /// Currently active view id
    pub active_view_id: Option<String>,
}

// ── Input ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBaseMetaInput {
    /// Full replacement of fields array (optional)
    pub fields: Option<serde_json::Value>,
    /// Full replacement of views array (optional)
    pub views: Option<serde_json::Value>,
    /// Update active view id (optional)
    pub active_view_id: Option<String>,
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// GET /api/apps/docs/base/{nodeId} — get base metadata (fields + views)
///
/// If content is null or fields/views are empty, auto-initializes with defaults
/// (one "文本" text column + one "表格" grid view) and persists to DB.
pub async fn get_base_meta(
    State(state): State<Arc<AppState>>,
    AuthUser(_auth): AuthUser,
    Path(node_id): Path<String>,
) -> Result<Json<ApiResponse<BaseMetaOutput>>, AppError> {
    let uid = parse_uuid(&node_id)?;
    let node = doc_nodes::Entity::find_by_id(uid)
        .one(&state.db)
        .await?
        .not_found("node not found")?;

    if node.r#type != "base" {
        return Err(AppError::BadRequest("node is not a base type".into()));
    }

    let content = node.content.clone().unwrap_or(serde_json::json!({}));
    let needs_init = content
        .get("fields")
        .and_then(|v| v.as_array())
        .is_none_or(Vec::is_empty)
        || content
            .get("views")
            .and_then(|v| v.as_array())
            .is_none_or(Vec::is_empty);

    let content = if needs_init {
        let default_content = create_default_content();
        let mut active: doc_nodes::ActiveModel = node.into();
        active.content = Set(Some(default_content.clone()));
        active.update(&state.db).await?;
        default_content
    } else {
        content
    };

    let output = extract_meta(&node_id, &content);
    Ok(ok(output))
}

/// PATCH /api/apps/docs/base/{nodeId} — update base metadata
pub async fn update_base_meta(
    State(state): State<Arc<AppState>>,
    AuthUser(_auth): AuthUser,
    Path(node_id): Path<String>,
    Json(body): Json<UpdateBaseMetaInput>,
) -> Result<Json<ApiResponse<BaseMetaOutput>>, AppError> {
    let uid = parse_uuid(&node_id)?;
    let node = doc_nodes::Entity::find_by_id(uid)
        .one(&state.db)
        .await?
        .not_found("node not found")?;

    if node.r#type != "base" {
        return Err(AppError::BadRequest("node is not a base type".into()));
    }

    let mut content = node.content.clone().unwrap_or(serde_json::json!({}));
    let obj = content
        .as_object_mut()
        .ok_or_else(|| AppError::Internal("node content is not a JSON object".into()))?;

    if let Some(fields) = body.fields {
        obj.insert("fields".to_string(), fields);
    }
    if let Some(views) = body.views {
        obj.insert("views".to_string(), views);
    }
    if let Some(active_view_id) = body.active_view_id {
        obj.insert("activeViewId".to_string(), serde_json::Value::String(active_view_id));
    }

    let mut active: doc_nodes::ActiveModel = node.into();
    active.content = Set(Some(content.clone()));
    active.update(&state.db).await?;

    let output = extract_meta(&node_id, &content);
    Ok(ok(output))
}

fn extract_meta(node_id: &str, content: &serde_json::Value) -> BaseMetaOutput {
    BaseMetaOutput {
        node_id: node_id.to_string(),
        fields: content.get("fields").cloned().unwrap_or(serde_json::json!([])),
        views: content.get("views").cloned().unwrap_or(serde_json::json!([])),
        active_view_id: content.get("activeViewId").and_then(|v| v.as_str()).map(String::from),
    }
}

/// Creates default base content with one "文本" text field and one grid view.
fn create_default_content() -> serde_json::Value {
    let field_id = uuid::Uuid::new_v4().to_string();
    let view_id = uuid::Uuid::new_v4().to_string();

    serde_json::json!({
        "fields": [
            {
                "id": field_id,
                "name": "文本",
                "type": "text",
                "width": 200
            }
        ],
        "views": [
            {
                "id": view_id,
                "name": "表格",
                "type": "grid",
                "filters": { "conjunction": "and", "conditions": [] },
                "sorts": [],
                "groups": [],
                "hiddenFieldIds": [],
                "fieldOrder": [field_id]
            }
        ],
        "activeViewId": view_id
    })
}
