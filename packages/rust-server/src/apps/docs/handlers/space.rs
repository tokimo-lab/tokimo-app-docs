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
    pub slug: String,
    pub avatar: Option<serde_json::Value>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSpaceInput {
    pub name: Option<String>,
    pub slug: Option<String>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub avatar: Option<Option<serde_json::Value>>,
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
    validate_slug(&input.slug)?;
    let model = DocSpaceRepo::create(&state.db, input.name, Some(input.slug), input.avatar, input.description).await?;
    Ok(ok(DocSpaceOutput::from(model)))
}

/// PATCH /api/apps/docs/spaces/{id}
pub async fn update_space(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateSpaceInput>,
) -> Result<Json<ApiResponse<DocSpaceOutput>>, AppError> {
    let uid = parse_uuid(&id)?;
    if let Some(ref slug) = input.slug {
        validate_slug(slug)?;
    }
    let model = DocSpaceRepo::update(
        &state.db,
        uid,
        space_repo::UpdateSpaceParams {
            name: input.name,
            slug: input.slug,
            avatar: input.avatar,
            description: input.description,
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

/// Validate that a slug is filesystem-safe: [a-z0-9-_], 2-50 chars, no leading/trailing dash/underscore.
fn validate_slug(slug: &str) -> Result<(), AppError> {
    if slug.len() < 2 || slug.len() > 50 {
        return Err(AppError::BadRequest("slug must be 2-50 characters".into()));
    }
    if !slug
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
    {
        return Err(AppError::BadRequest(
            "slug must contain only lowercase letters, digits, hyphens, and underscores".into(),
        ));
    }
    if slug.starts_with('-') || slug.starts_with('_') || slug.ends_with('-') || slug.ends_with('_') {
        return Err(AppError::BadRequest(
            "slug must not start or end with a hyphen or underscore".into(),
        ));
    }
    Ok(())
}
