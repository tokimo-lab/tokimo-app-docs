use axum::Json;
use axum::extract::{Path, State};
use sea_orm::EntityTrait;
use serde::Deserialize;
use std::sync::Arc;

use super::{parse_uuid, vfs_err};
use crate::AppState;
use crate::apps::docs::models::DocSpaceOutput;
use crate::apps::docs::repos::space_repo::{DocSpaceRepo, UpdateSpaceParams};
use crate::apps::docs::services::path_utils;
use crate::db::entities::{docs_spaces, vfs as vfs_entity};
use crate::error::{AppError, OptionExt};
use crate::handlers::{ApiResponse, ok, ok_empty};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSpaceInput {
    pub name: String,
    pub avatar: Option<serde_json::Value>,
    pub description: Option<String>,
    pub vfs_id: Option<String>,
    pub root_path: Option<String>,
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
    pub vfs_id: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub root_path: Option<Option<String>>,
    pub sort_order: Option<i32>,
}

pub async fn to_doc_space_output(
    db: &sea_orm::DatabaseConnection,
    model: docs_spaces::Model,
) -> Result<DocSpaceOutput, AppError> {
    let source = match model.vfs_id {
        Some(id) => vfs_entity::Entity::find_by_id(id).one(db).await?,
        None => None,
    };
    let mut output = DocSpaceOutput::from(model);
    output.source_name = source.as_ref().map(|s| s.name.clone());
    output.source_type = source.as_ref().map(|s| s.r#type.clone());
    Ok(output)
}

async fn ensure_root(state: &Arc<AppState>, vfs_id: Option<&str>, root_path: Option<&str>) -> Result<(), AppError> {
    let (Some(vfs_id), Some(root_path)) = (vfs_id, root_path) else {
        return Ok(());
    };
    let vfs = state.sources.ensure_vfs(vfs_id).await.map_err(AppError::Internal)?;
    let path = path_utils::vfs_path(root_path, "");
    match vfs.mkdir(&path).await {
        Ok(()) => Ok(()),
        Err(err) => {
            let msg = err.to_string().to_ascii_lowercase();
            if msg.contains("exist") || msg.contains("already") {
                Ok(())
            } else {
                Err(vfs_err(err))
            }
        }
    }
}

pub async fn list_spaces(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<Vec<DocSpaceOutput>>>, AppError> {
    let rows = DocSpaceRepo::list_all(&state.db).await?;
    let mut outputs = Vec::with_capacity(rows.len());
    for row in rows {
        outputs.push(to_doc_space_output(&state.db, row).await?);
    }
    Ok(ok(outputs))
}

pub async fn create_space(
    State(state): State<Arc<AppState>>,
    Json(input): Json<CreateSpaceInput>,
) -> Result<Json<ApiResponse<DocSpaceOutput>>, AppError> {
    if input.name.trim().is_empty() {
        return Err(AppError::BadRequest("space name cannot be empty".into()));
    }
    ensure_root(&state, input.vfs_id.as_deref(), input.root_path.as_deref()).await?;
    let model = DocSpaceRepo::create(
        &state.db,
        input.name,
        input.avatar,
        input.description,
        input.vfs_id,
        input.root_path,
    )
    .await?;
    Ok(ok(to_doc_space_output(&state.db, model).await?))
}

pub async fn update_space(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateSpaceInput>,
) -> Result<Json<ApiResponse<DocSpaceOutput>>, AppError> {
    if let (Some(Some(vfs_id)), Some(Some(root_path))) = (&input.vfs_id, &input.root_path) {
        ensure_root(&state, Some(vfs_id), Some(root_path)).await?;
    }
    let model = DocSpaceRepo::update(
        &state.db,
        parse_uuid(&id)?,
        UpdateSpaceParams {
            name: input.name,
            avatar: input.avatar,
            description: input.description,
            vfs_id: input.vfs_id,
            root_path: input.root_path,
            sort_order: input.sort_order,
        },
    )
    .await?
    .not_found("doc space not found")?;
    Ok(ok(to_doc_space_output(&state.db, model).await?))
}

pub async fn delete_space(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    if !DocSpaceRepo::delete(&state.db, parse_uuid(&id)?).await? {
        return Err(AppError::NotFound("doc space not found".into()));
    }
    Ok(ok_empty())
}
