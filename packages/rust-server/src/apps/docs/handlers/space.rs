use axum::extract::{Path, State};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;

use super::parse_uuid;
use crate::apps::docs::models::DocSpaceOutput;
use crate::apps::docs::repos::space_repo::DocSpaceRepo;
use crate::error::{AppError, OptionExt};
use crate::handlers::{ok, ok_empty, ApiResponse};
use crate::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSpaceInput {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSpaceInput {
    pub name: Option<String>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub icon: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub color: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub description: Option<Option<String>>,
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
    let model =
        DocSpaceRepo::create(&state.db, input.name, input.icon, input.color, input.description)
            .await?;
    Ok(ok(DocSpaceOutput::from(model)))
}

/// PATCH /api/apps/docs/spaces/{id}
pub async fn update_space(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateSpaceInput>,
) -> Result<Json<ApiResponse<DocSpaceOutput>>, AppError> {
    let uid = parse_uuid(&id)?;
    let model = DocSpaceRepo::update(
        &state.db,
        uid,
        input.name,
        input.icon,
        input.color,
        input.description,
        input.sort_order,
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
