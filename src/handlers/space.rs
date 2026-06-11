use axum::Json;
use axum::extract::{Path, State};
use sea_orm::EntityTrait;
use serde::Deserialize;
use std::sync::Arc;
use ts_rs::TS;

use super::{parse_uuid, vfs_err};
use crate::db::entities::DocSpaceOutput;
use crate::db::entities::{docs_spaces, vfs as vfs_entity};
use crate::db::repos::space_repo::{DocSpaceRepo, UpdateSpaceParams};
use crate::error::{AppError, OptionExt};
use crate::handlers::AppCtx;
use crate::handlers::{ApiResponse, ok, ok_empty};
use crate::services::path_utils;

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct CreateSpaceInput {
    pub name: String,
    pub avatar: Option<serde_json::Value>,
    pub description: Option<String>,
    pub vfs_id: Option<String>,
    pub root_path: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSpaceInput {
    pub name: Option<String>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    #[ts(type = "unknown | null")]
    pub avatar: Option<Option<serde_json::Value>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    #[ts(type = "string | null")]
    pub description: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    #[ts(type = "string | null")]
    pub vfs_id: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    #[ts(type = "string | null")]
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

async fn ensure_root(ctx: &AppCtx, vfs_id: Option<&str>, root_path: Option<&str>) -> Result<(), AppError> {
    let (Some(vfs_id), Some(root_path)) = (vfs_id, root_path) else {
        return Ok(());
    };
    let vfs = ctx.sources.ensure_vfs(vfs_id).await.map_err(AppError::Internal)?;
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

pub async fn list_spaces(State(ctx): State<Arc<AppCtx>>) -> Result<Json<ApiResponse<Vec<DocSpaceOutput>>>, AppError> {
    let rows = DocSpaceRepo::list_all(&ctx.db).await?;
    let mut outputs = Vec::with_capacity(rows.len());
    for row in rows {
        outputs.push(to_doc_space_output(&ctx.db, row).await?);
    }
    Ok(ok(outputs))
}

pub async fn create_space(
    State(ctx): State<Arc<AppCtx>>,
    Json(input): Json<CreateSpaceInput>,
) -> Result<Json<ApiResponse<DocSpaceOutput>>, AppError> {
    if input.name.trim().is_empty() {
        return Err(AppError::BadRequest("space name cannot be empty".into()));
    }
    ensure_root(&ctx, input.vfs_id.as_deref(), input.root_path.as_deref()).await?;
    let model = DocSpaceRepo::create(
        &ctx.db,
        input.name,
        input.avatar,
        input.description,
        input.vfs_id,
        input.root_path,
    )
    .await?;
    Ok(ok(to_doc_space_output(&ctx.db, model).await?))
}

pub async fn update_space(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateSpaceInput>,
) -> Result<Json<ApiResponse<DocSpaceOutput>>, AppError> {
    if let (Some(Some(vfs_id)), Some(Some(root_path))) = (&input.vfs_id, &input.root_path) {
        ensure_root(&ctx, Some(vfs_id), Some(root_path)).await?;
    }
    let model = DocSpaceRepo::update(
        &ctx.db,
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
    Ok(ok(to_doc_space_output(&ctx.db, model).await?))
}

pub async fn delete_space(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    if !DocSpaceRepo::delete(&ctx.db, parse_uuid(&id)?).await? {
        return Err(AppError::NotFound("doc space not found".into()));
    }
    Ok(ok_empty())
}
