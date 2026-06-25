pub mod attachment;
pub mod base_meta;
pub mod base_records;
pub mod browse;
pub mod collab;
pub mod comments;
pub mod crud;
pub mod space;
pub mod user;
pub mod versions;
pub mod view_state;
pub mod whiteboard_library;

use std::sync::Arc;
use uuid::Uuid;

use crate::db::entities::docs_spaces;
use crate::db::repos::space_repo::DocSpaceRepo;
use crate::error::{AppError, OptionExt};
use crate::services::path_utils;

/// Application context for the docs app.
pub struct AppCtx {
    pub db: sea_orm::DatabaseConnection,
    pub client: Arc<std::sync::OnceLock<Arc<tokimo_bus_client::BusClient>>>,
    pub http_client: reqwest::Client,
    pub collab: Arc<crate::services::collab::CollabService>,
    pub storage: Arc<dyn crate::services::storage::StorageProvider>,
    pub sources: Arc<crate::services::vfs_registry::VfsRegistry>,
}

pub fn parse_uuid(s: &str) -> Result<Uuid, AppError> {
    s.parse::<Uuid>()
        .map_err(|_| AppError::BadRequest(format!("invalid uuid: {s}")))
}

const FORBIDDEN_CHARS: &[char] = &['\\', '/', ':', '*', '?', '"', '<', '>', '|'];

pub fn validate_node_name(name: &str) -> Result<(), AppError> {
    if name.is_empty() || name != name.trim() || name.starts_with('.') || name.ends_with('.') {
        return Err(AppError::BadRequest("invalid node name".into()));
    }
    if let Some(ch) = name.chars().find(|c| FORBIDDEN_CHARS.contains(c)) {
        return Err(AppError::BadRequest(format!(
            "node name contains forbidden character: {ch}"
        )));
    }
    Ok(())
}

pub(crate) async fn get_space(ctx: &AppCtx, id: &str) -> Result<docs_spaces::Model, AppError> {
    DocSpaceRepo::get_by_id(&ctx.db, parse_uuid(id)?)
        .await?
        .not_found("doc space not found")
}

pub(crate) fn space_vfs_parts(space: &docs_spaces::Model) -> Result<(String, String), AppError> {
    let vfs_id = space
        .vfs_id
        .map(|id| id.to_string())
        .bad_request("doc space has no vfsId")?;
    let root_path = space.root_path.clone().bad_request("doc space has no rootPath")?;
    Ok((vfs_id, path_utils::normalize_rel_path(&root_path)))
}

pub(crate) async fn ensure_space_vfs(
    ctx: &AppCtx,
    space: &docs_spaces::Model,
) -> Result<(Arc<tokimo_vfs::Vfs>, String), AppError> {
    let (vfs_id, root_path) = space_vfs_parts(space)?;
    let vfs = ctx.sources.ensure_vfs(&vfs_id).await.map_err(AppError::Internal)?;
    Ok((vfs, root_path))
}

pub(crate) fn vfs_err(err: impl std::fmt::Display) -> AppError {
    AppError::Internal(format!("vfs error: {err}"))
}

// Re-export from error module
pub use crate::error::{ApiResponse, err_resp, ok, ok_empty};
