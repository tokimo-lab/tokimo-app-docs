pub mod attachment;
pub mod base_meta;
pub mod base_records;
pub mod browse;
pub mod collab;
pub mod comments;
pub mod crud;
pub mod space;
pub mod versions;
pub mod view_state;
pub mod whiteboard_library;

use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;
use crate::apps::docs::repos::space_repo::DocSpaceRepo;
use crate::apps::docs::services::path_utils;
use crate::db::entities::docs_spaces;
use crate::error::{AppError, OptionExt};

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

pub(crate) async fn get_space(state: &Arc<AppState>, id: &str) -> Result<docs_spaces::Model, AppError> {
    DocSpaceRepo::get_by_id(&state.db, parse_uuid(id)?)
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
    state: &Arc<AppState>,
    space: &docs_spaces::Model,
) -> Result<(Arc<tokimo_vfs::Vfs>, String), AppError> {
    let (vfs_id, root_path) = space_vfs_parts(space)?;
    let vfs = state.sources.ensure_vfs(&vfs_id).await.map_err(AppError::Internal)?;
    Ok((vfs, root_path))
}

pub(crate) fn vfs_err(err: impl std::fmt::Display) -> AppError {
    AppError::Internal(format!("vfs error: {err}"))
}
