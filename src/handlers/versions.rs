use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use std::sync::Arc;
use ts_rs::TS;

use super::{ensure_space_vfs, get_space, parse_uuid, vfs_err};
use crate::db::entities::{DocNodeVersionDetailOutput, DocNodeVersionOutput};
use crate::db::repos::node_meta_repo::DocNodeMetaRepo;
use crate::db::repos::version_repo::DocNodeVersionRepo;
use crate::error::{AppError, OptionExt};
use crate::handlers::AppCtx;
use crate::handlers::{ApiResponse, ok, ok_empty};
use crate::services::path_utils;

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RelPathQuery {
    pub rel_path: String,
}

pub async fn list_versions(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
) -> Result<Json<ApiResponse<Vec<DocNodeVersionOutput>>>, AppError> {
    let versions = DocNodeVersionRepo::list(&ctx.db, parse_uuid(&id)?, &q.rel_path).await?;
    Ok(ok(versions.into_iter().map(DocNodeVersionOutput::from).collect()))
}

pub async fn get_version(
    State(ctx): State<Arc<AppCtx>>,
    Path((_space_id, version_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<DocNodeVersionDetailOutput>>, AppError> {
    let version = DocNodeVersionRepo::get_by_id(&ctx.db, parse_uuid(&version_id)?)
        .await?
        .not_found("version not found")?;
    Ok(ok(DocNodeVersionDetailOutput::from(version)))
}

pub async fn restore_version(
    State(ctx): State<Arc<AppCtx>>,
    Path((id, version_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let version = DocNodeVersionRepo::get_by_id(&ctx.db, parse_uuid(&version_id)?)
        .await?
        .not_found("version not found")?;
    let space_id = parse_uuid(&id)?;
    let meta = DocNodeMetaRepo::find(&ctx.db, space_id, &version.rel_path)
        .await?
        .not_found("document not found")?;
    ctx.collab.ensure_version_restore_allowed(meta.id)?;
    let space = get_space(&ctx, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let node_type = path_utils::type_for_path(&version.rel_path, false);
    let data = version.content.as_ref().map_or_else(
        || b"{}".to_vec(),
        |c| path_utils::content_to_bytes(node_type, c).unwrap_or_else(|_| b"{}".to_vec()),
    );
    vfs.put(&path_utils::vfs_path(&root_path, &version.rel_path), data)
        .await
        .map_err(vfs_err)?;
    ctx.collab.reset_for_version_restore(meta.id).await?;
    Ok(ok_empty())
}
