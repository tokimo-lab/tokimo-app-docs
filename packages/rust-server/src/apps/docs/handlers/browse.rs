use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;

use super::parse_uuid;
use crate::apps::docs::repos::node_repo::{DocNodeRepo, ListDocNodesInput};
use crate::db::pagination::PageInput;
use crate::error::{AppError, OptionExt};
use crate::handlers::{ok, ApiResponse};
use crate::AppState;

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

/// GET /api/apps/docs/spaces/{id}/nodes
pub async fn list_nodes(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<ListNodesQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let page_input = PageInput {
        page: q.page.unwrap_or(1),
        page_size: q.page_size.unwrap_or(50),
    };

    let parent_id: Option<Option<uuid::Uuid>> = match q.parent_id.as_deref() {
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
            space_id,
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

/// GET /api/apps/docs/spaces/{id}/nodes/tags
pub async fn list_node_tags(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<String>>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let tags = DocNodeRepo::list_tags(&state.db, space_id).await?;
    Ok(ok(tags))
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
