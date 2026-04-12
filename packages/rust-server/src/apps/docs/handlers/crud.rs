use axum::extract::{Path, State};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use super::{parse_uuid, validate_node_name};
use crate::apps::docs::models::DocNodeOutput;
use crate::apps::docs::repos::node_repo::DocNodeRepo;
use crate::apps::docs::services::docs_service::DocsService;
use crate::db::entities::doc_nodes;
use crate::error::{AppError, OptionExt};
use crate::handlers::{ok, ok_empty, ApiResponse};
use crate::AppState;
use sea_orm::*;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeInput {
    pub r#type: Option<String>,
    pub title: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNodeInput {
    pub title: Option<String>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub content: Option<Option<serde_json::Value>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub icon: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub cover_image: Option<Option<String>>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveNodeInput {
    pub parent_id: Option<String>,
    pub sort_order: Option<i32>,
}

/// Verify that the parent node exists and is a folder.
async fn verify_parent_is_folder(
    db: &DatabaseConnection,
    parent_id: Uuid,
) -> Result<(), AppError> {
    let parent = doc_nodes::Entity::find_by_id(parent_id)
        .one(db)
        .await?
        .not_found("parent node not found")?;
    if parent.r#type != "folder" {
        return Err(AppError::BadRequest("parent node is not a folder".into()));
    }
    Ok(())
}

/// Check that no sibling with the same title exists under the same parent.
async fn check_unique_sibling_name(
    db: &DatabaseConnection,
    space_id: Uuid,
    parent_id: Option<Uuid>,
    title: &str,
    exclude_id: Option<Uuid>,
) -> Result<(), AppError> {
    let mut q = doc_nodes::Entity::find()
        .filter(doc_nodes::Column::SpaceId.eq(space_id))
        .filter(doc_nodes::Column::Title.eq(title))
        .filter(doc_nodes::Column::IsArchived.eq(false));
    q = if let Some(pid) = parent_id {
        q.filter(doc_nodes::Column::ParentId.eq(pid))
    } else {
        q.filter(doc_nodes::Column::ParentId.is_null())
    };
    if let Some(eid) = exclude_id {
        q = q.filter(doc_nodes::Column::Id.ne(eid));
    }
    let existing = q.one(db).await?;
    if existing.is_some() {
        return Err(AppError::BadRequest(format!(
            "a node named \"{title}\" already exists in this location"
        )));
    }
    Ok(())
}

/// Check that moving `node_id` under `target_parent_id` does not create a cycle.
async fn check_no_cycle(
    db: &DatabaseConnection,
    node_id: Uuid,
    target_parent_id: Uuid,
) -> Result<(), AppError> {
    let mut current = Some(target_parent_id);
    while let Some(pid) = current {
        if pid == node_id {
            return Err(AppError::BadRequest(
                "cannot move a node under itself".into(),
            ));
        }
        let parent = doc_nodes::Entity::find_by_id(pid).one(db).await?;
        current = parent.and_then(|p| p.parent_id);
    }
    Ok(())
}

/// POST /api/apps/docs/spaces/{id}/nodes
pub async fn create_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<CreateNodeInput>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let parent_id = input
        .parent_id
        .as_deref()
        .map(parse_uuid)
        .transpose()?;
    let node_type = input.r#type.unwrap_or_else(|| "notion".to_string());
    let title = input.title.unwrap_or_default();

    if !title.is_empty() {
        validate_node_name(&title)?;
    }

    if let Some(pid) = parent_id {
        verify_parent_is_folder(&state.db, pid).await?;
    }

    if !title.is_empty() {
        check_unique_sibling_name(&state.db, space_id, parent_id, &title, None).await?;
    }

    let node = DocNodeRepo::create(&state.db, space_id, node_type, title, parent_id).await?;
    Ok(ok(DocNodeOutput::from(node)))
}

/// GET /api/apps/docs/nodes/{id}
pub async fn get_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let node = DocNodeRepo::get_by_id(&state.db, node_id)
        .await?
        .not_found("node not found")?;
    Ok(ok(DocNodeOutput::from(node)))
}

/// PATCH /api/apps/docs/nodes/{id}
pub async fn update_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateNodeInput>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let node_id = parse_uuid(&id)?;

    if let Some(ref title) = input.title {
        if !title.is_empty() {
            validate_node_name(title)?;
        }
        let node = DocNodeRepo::get_by_id(&state.db, node_id)
            .await?
            .not_found("node not found")?;
        if !title.is_empty() && title != &node.title {
            check_unique_sibling_name(
                &state.db,
                node.space_id,
                node.parent_id,
                title,
                Some(node_id),
            )
            .await?;
        }
    }

    let node = DocsService::update_node_with_version(
        &state.db,
        node_id,
        input.title,
        input.content,
        input.icon,
        input.cover_image,
        input.tags,
    )
    .await?;
    Ok(ok(DocNodeOutput::from(node)))
}

/// DELETE /api/apps/docs/nodes/{id} — soft delete (archive)
pub async fn archive_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let archived = DocNodeRepo::archive(&state.db, node_id, true).await?;
    if !archived {
        return Err(AppError::NotFound("node not found".into()));
    }
    Ok(ok_empty())
}

/// PATCH /api/apps/docs/nodes/{id}/restore
pub async fn restore_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let restored = DocNodeRepo::archive(&state.db, node_id, false).await?;
    if !restored {
        return Err(AppError::NotFound("node not found".into()));
    }
    Ok(ok_empty())
}

/// DELETE /api/apps/docs/nodes/{id}/permanent — hard delete
pub async fn delete_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let deleted = DocNodeRepo::delete(&state.db, node_id).await?;
    if !deleted {
        return Err(AppError::NotFound("node not found".into()));
    }
    Ok(ok_empty())
}

/// PATCH /api/apps/docs/nodes/{id}/move
pub async fn move_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<MoveNodeInput>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let parent_id = input
        .parent_id
        .as_deref()
        .map(parse_uuid)
        .transpose()?;

    if let Some(pid) = parent_id {
        verify_parent_is_folder(&state.db, pid).await?;
        check_no_cycle(&state.db, node_id, pid).await?;
    }

    let node = DocNodeRepo::get_by_id(&state.db, node_id)
        .await?
        .not_found("node not found")?;
    if parent_id != node.parent_id && !node.title.is_empty() {
        check_unique_sibling_name(
            &state.db,
            node.space_id,
            parent_id,
            &node.title,
            Some(node_id),
        )
        .await?;
    }

    let moved =
        DocNodeRepo::move_node(&state.db, node_id, parent_id, input.sort_order).await?;
    if !moved {
        return Err(AppError::NotFound("node not found".into()));
    }
    Ok(ok_empty())
}
