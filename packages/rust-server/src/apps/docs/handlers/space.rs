use axum::Json;
use axum::extract::{Path, State};
use serde::Deserialize;
use std::sync::Arc;

use super::parse_uuid;
use crate::AppState;
use crate::apps::docs::models::DocSpaceOutput;
use crate::apps::docs::repos::space_repo::{self, DocSpaceRepo};
use crate::error::{AppError, OptionExt};
use crate::handlers::{ApiResponse, ok, ok_empty};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSpaceInput {
    pub name: String,
    pub avatar: Option<serde_json::Value>,
    pub description: Option<String>,
    pub local_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSpaceInput {
    pub name: Option<String>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub avatar: Option<Option<serde_json::Value>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub description: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub local_path: Option<Option<String>>,
    pub sort_order: Option<i32>,
}

/// GET /api/apps/docs/spaces
pub async fn list_spaces(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<Vec<DocSpaceOutput>>>, AppError> {
    let rows = DocSpaceRepo::list_all(&state.db).await?;
    let outputs: Vec<DocSpaceOutput> = rows.into_iter().map(DocSpaceOutput::from).collect();
    Ok(ok(outputs))
}

/// POST /api/apps/docs/spaces
pub async fn create_space(
    State(state): State<Arc<AppState>>,
    Json(input): Json<CreateSpaceInput>,
) -> Result<Json<ApiResponse<DocSpaceOutput>>, AppError> {
    if input.name.trim().is_empty() {
        return Err(AppError::BadRequest("space name cannot be empty".into()));
    }
    // Ensure local_path directory exists if provided.
    if let Some(ref lp) = input.local_path {
        tokio::fs::create_dir_all(lp)
            .await
            .map_err(|e| AppError::Internal(format!("cannot create space directory: {e}")))?;
    }

    let model = DocSpaceRepo::create(&state.db, input.name, input.avatar, input.description, input.local_path).await?;
    Ok(ok(DocSpaceOutput::from(model)))
}

/// PATCH /api/apps/docs/spaces/{id}
pub async fn update_space(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateSpaceInput>,
) -> Result<Json<ApiResponse<DocSpaceOutput>>, AppError> {
    let uid = parse_uuid(&id)?;
    // Ensure new local_path directory exists if being set.
    if let Some(Some(ref lp)) = input.local_path {
        tokio::fs::create_dir_all(lp)
            .await
            .map_err(|e| AppError::Internal(format!("cannot create space directory: {e}")))?;
    }

    let model = DocSpaceRepo::update(
        &state.db,
        uid,
        space_repo::UpdateSpaceParams {
            name: input.name,
            avatar: input.avatar,
            description: input.description,
            local_path: input.local_path,
            sort_order: input.sort_order,
        },
    )
    .await?
    .not_found("doc space not found")?;
    Ok(ok(DocSpaceOutput::from(model)))
}

/// DELETE /api/apps/docs/spaces/{id}
pub async fn delete_space(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let uid = parse_uuid(&id)?;
    let deleted = DocSpaceRepo::delete(&state.db, uid).await?;
    if !deleted {
        return Err(AppError::NotFound("doc space not found".into()));
    }
    Ok(ok_empty())
}
