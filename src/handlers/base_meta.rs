use axum::Json;
use axum::extract::{Path, Query, State};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;

use super::{ensure_space_vfs, get_space, vfs_err};
use crate::handlers::AppCtx;
use crate::services::path_utils;
use crate::error::AppError;
use crate::handlers::user::AuthUser;
use crate::handlers::{ApiResponse, ok};

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BaseMetaOutput {
    pub rel_path: String,
    pub fields: serde_json::Value,
    pub views: serde_json::Value,
    pub active_view_id: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBaseMetaInput {
    pub fields: Option<serde_json::Value>,
    pub views: Option<serde_json::Value>,
    pub active_view_id: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelPathQuery {
    pub rel_path: String,
}

fn default_content() -> serde_json::Value {
    let field_id = uuid::Uuid::new_v4().to_string();
    let view_id = uuid::Uuid::new_v4().to_string();
    serde_json::json!({"fields":[{"id":field_id,"name":"文本","type":"text","width":200}],"views":[{"id":view_id,"name":"表格","type":"grid","filters":{"conjunction":"and","conditions":[]},"sorts":[],"groups":[],"hiddenFieldIds":[],"fieldOrder":[field_id]}],"activeViewId":view_id})
}
fn output(rel_path: &str, content: &serde_json::Value) -> BaseMetaOutput {
    BaseMetaOutput {
        rel_path: rel_path.to_string(),
        fields: content.get("fields").cloned().unwrap_or(serde_json::json!([])),
        views: content.get("views").cloned().unwrap_or(serde_json::json!([])),
        active_view_id: content.get("activeViewId").and_then(|v| v.as_str()).map(String::from),
    }
}

pub async fn get_base_meta(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(_): AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
) -> Result<Json<ApiResponse<BaseMetaOutput>>, AppError> {
    let space = get_space(&ctx, &id).await?;
    let (vfs, root) = ensure_space_vfs(&ctx, &space).await?;
    let path = path_utils::vfs_path(&root, &q.rel_path);
    if path_utils::type_for_path(&q.rel_path, false) != "base" {
        return Err(AppError::BadRequest("node is not a base type".into()));
    }
    let mut content = path_utils::content_from_bytes("base", vfs.read_bytes(&path, 0, None).await.map_err(vfs_err)?)?;
    let needs_init = content
        .get("fields")
        .and_then(|v| v.as_array())
        .is_none_or(Vec::is_empty)
        || content
            .get("views")
            .and_then(|v| v.as_array())
            .is_none_or(Vec::is_empty);
    if needs_init {
        content = default_content();
        vfs.put(&path, path_utils::content_to_bytes("base", &content)?)
            .await
            .map_err(vfs_err)?;
    }
    Ok(ok(output(&q.rel_path, &content)))
}
pub async fn update_base_meta(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(_): AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
    Json(body): Json<UpdateBaseMetaInput>,
) -> Result<Json<ApiResponse<BaseMetaOutput>>, AppError> {
    let space = get_space(&ctx, &id).await?;
    let (vfs, root) = ensure_space_vfs(&ctx, &space).await?;
    let path = path_utils::vfs_path(&root, &q.rel_path);
    let mut content = path_utils::content_from_bytes("base", vfs.read_bytes(&path, 0, None).await.map_err(vfs_err)?)?;
    if !content.is_object() {
        content = serde_json::json!({});
    }
    let obj = content
        .as_object_mut()
        .ok_or_else(|| AppError::Internal("base content is not object".into()))?;
    if let Some(fields) = body.fields {
        obj.insert("fields".to_string(), fields);
    } else if let Some(views) = body.views {
        obj.insert("views".to_string(), views);
    } else if let Some(active) = body.active_view_id {
        obj.insert("activeViewId".to_string(), serde_json::Value::String(active));
    }
    vfs.put(&path, path_utils::content_to_bytes("base", &content)?)
        .await
        .map_err(vfs_err)?;
    Ok(ok(output(&q.rel_path, &content)))
}
