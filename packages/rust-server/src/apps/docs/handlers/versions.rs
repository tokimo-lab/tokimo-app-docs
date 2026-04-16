use axum::Json;
use axum::extract::{Path, State};
use std::sync::Arc;

use super::parse_uuid;
use crate::AppState;
use crate::apps::docs::models::{DocNodeOutput, DocNodeVersionDetailOutput, DocNodeVersionOutput};
use crate::apps::docs::repos::space_repo::DocSpaceRepo;
use crate::apps::docs::repos::version_repo::DocNodeVersionRepo;
use crate::apps::docs::services::docs_service::DocsService;
use crate::apps::docs::services::markdown_sync::DocMarkdownSyncService;
use crate::error::{AppError, OptionExt};
use crate::handlers::{ApiResponse, ok};

/// GET /api/apps/docs/nodes/{id}/versions
pub async fn list_versions(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<DocNodeVersionOutput>>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let versions = DocNodeVersionRepo::list(&state.db, node_id).await?;
    let outputs: Vec<DocNodeVersionOutput> = versions.into_iter().map(DocNodeVersionOutput::from).collect();
    Ok(ok(outputs))
}

/// GET /api/apps/docs/node-versions/{id}
pub async fn get_version(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<DocNodeVersionDetailOutput>>, AppError> {
    let version_id = parse_uuid(&id)?;
    let version = DocNodeVersionRepo::get_by_id(&state.db, version_id)
        .await?
        .not_found("version not found")?;
    Ok(ok(DocNodeVersionDetailOutput::from(version)))
}

/// POST /api/apps/docs/nodes/{id}/versions/{version_id}/restore
pub async fn restore_version(
    State(state): State<Arc<AppState>>,
    Path((id, version_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let vid = parse_uuid(&version_id)?;

    let version = DocNodeVersionRepo::get_by_id(&state.db, vid)
        .await?
        .not_found("version not found")?;

    if version.node_id != node_id {
        return Err(AppError::BadRequest("version does not belong to this node".into()));
    }

    let node = DocsService::update_node_with_version(
        &state.db,
        node_id,
        Some(version.title),
        Some(version.content),
        None,
        None,
        None,
    )
    .await?;

    // Trigger S3 sync after version restore (content changed)
    if node.content.is_some() {
        let db = state.db.clone();
        let storage = state.storage.clone();
        let space_id = node.space_id;
        let node_clone = node.clone();
        tokio::spawn(async move {
            if let Ok(Some(space)) = DocSpaceRepo::get_by_id(&db, space_id).await {
                DocMarkdownSyncService::spawn_sync(storage, space, node_clone);
            }
        });
    }

    Ok(ok(DocNodeOutput::from(node)))
}
