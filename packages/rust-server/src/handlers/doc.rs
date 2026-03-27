use axum::{
    extract::{Path, Query, State},
    Json,
};
use sea_orm::*;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    db::entities::doc_folders,
    db::models::doc::{DocFolderOutput, DocOutput},
    db::pagination::PageInput,
    db::repos::doc_repo::{DocFolderRepo, DocRepo},
    error::AppError,
    handlers::{ok, ok_empty, ApiResponse},
    services::doc_service::DocService,
    AppState,
};

fn parse_uuid(s: &str) -> Result<Uuid, AppError> {
    s.parse::<Uuid>()
        .map_err(|_| AppError::BadRequest(format!("invalid uuid: {s}")))
}

// ── Query / Request types ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDocsQuery {
    pub page: Option<u64>,
    pub page_size: Option<u64>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
    pub search: Option<String>,
    pub folder_id: Option<String>,
    pub favorites_only: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocInput {
    pub title: Option<String>,
    pub folder_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocInput {
    pub title: Option<String>,
    pub content: Option<Option<serde_json::Value>>,
    pub icon: Option<Option<String>>,
    pub cover_image: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveDocInput {
    pub folder_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderInput {
    pub name: String,
    pub parent_id: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFolderInput {
    pub name: Option<String>,
    pub icon: Option<Option<String>>,
    pub sort_order: Option<i32>,
}

// ── Doc handlers ─────────────────────────────────────────────────────────────

/// GET /api/apps/{id}/docs
pub async fn list_docs(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<ListDocsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let app_id = parse_uuid(&id)?;
    let page_input = PageInput {
        page: q.page.unwrap_or(1),
        page_size: q.page_size.unwrap_or(50),
    };
    let folder_id = q
        .folder_id
        .as_deref()
        .and_then(|s| s.parse::<Uuid>().ok());
    let result = DocRepo::list(
        &state.db,
        app_id,
        &page_input,
        q.sort_by.as_deref().unwrap_or("updatedAt"),
        q.sort_dir.as_deref().unwrap_or("desc"),
        q.search.as_deref(),
        folder_id,
        q.favorites_only.unwrap_or(false),
    )
    .await?;
    Ok(ok(serde_json::json!({
        "items": result.items,
        "total": result.total,
        "page": result.page,
        "pageSize": result.page_size,
        "totalPages": result.total_pages,
    })))
}

/// POST /api/apps/{id}/docs
pub async fn create_doc(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<CreateDocInput>,
) -> Result<Json<ApiResponse<DocOutput>>, AppError> {
    let app_id = parse_uuid(&id)?;
    let folder_id = input
        .folder_id
        .as_deref()
        .map(parse_uuid)
        .transpose()?;
    let title = input.title.unwrap_or_else(|| "Untitled".to_string());
    let doc = DocRepo::create(&state.db, app_id, title, folder_id).await?;
    Ok(ok(DocOutput::from(doc)))
}

/// GET /api/docs/{id}
pub async fn get_doc(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<DocOutput>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let doc = DocRepo::get_by_id(&state.db, doc_id)
        .await?
        .ok_or_else(|| AppError::NotFound("doc not found".into()))?;
    Ok(ok(DocOutput::from(doc)))
}

/// PATCH /api/docs/{id}
pub async fn update_doc(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateDocInput>,
) -> Result<Json<ApiResponse<DocOutput>>, AppError> {
    let doc_id = parse_uuid(&id)?;

    // Compute word count if content is being updated
    let word_count = input.content.as_ref().and_then(|opt_content| {
        opt_content
            .as_ref()
            .map(|c| DocService::count_words(c))
    });

    let doc = DocRepo::update(
        &state.db,
        doc_id,
        input.title,
        input.content,
        input.icon,
        input.cover_image,
        word_count,
    )
    .await?
    .ok_or_else(|| AppError::NotFound("doc not found".into()))?;
    Ok(ok(DocOutput::from(doc)))
}

/// DELETE /api/docs/{id}
pub async fn delete_doc(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let deleted = DocRepo::delete(&state.db, doc_id).await?;
    if !deleted {
        return Err(AppError::NotFound("doc not found".into()));
    }
    Ok(ok_empty())
}

/// PATCH /api/docs/{id}/favorite
pub async fn toggle_favorite(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let new_state = DocRepo::toggle_favorite(&state.db, doc_id)
        .await?
        .ok_or_else(|| AppError::NotFound("doc not found".into()))?;
    Ok(ok(serde_json::json!({ "isFavorite": new_state })))
}

/// PATCH /api/docs/{id}/pin
pub async fn toggle_pin(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let new_state = DocRepo::toggle_pin(&state.db, doc_id)
        .await?
        .ok_or_else(|| AppError::NotFound("doc not found".into()))?;
    Ok(ok(serde_json::json!({ "isPinned": new_state })))
}

/// PATCH /api/docs/{id}/move
pub async fn move_doc(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<MoveDocInput>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let folder_id = input
        .folder_id
        .as_deref()
        .map(parse_uuid)
        .transpose()?;
    let moved = DocRepo::move_to_folder(&state.db, doc_id, folder_id).await?;
    if !moved {
        return Err(AppError::NotFound("doc not found".into()));
    }
    Ok(ok_empty())
}

// ── Folder handlers ──────────────────────────────────────────────────────────

/// GET /api/apps/{id}/doc-folders
pub async fn list_folders(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<DocFolderOutput>>>, AppError> {
    let app_id = parse_uuid(&id)?;
    let folders = DocFolderRepo::list(&state.db, app_id).await?;
    Ok(ok(folders))
}

/// POST /api/apps/{id}/doc-folders
pub async fn create_folder(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<CreateFolderInput>,
) -> Result<Json<ApiResponse<DocFolderOutput>>, AppError> {
    let app_id = parse_uuid(&id)?;
    let parent_id = input
        .parent_id
        .as_deref()
        .map(parse_uuid)
        .transpose()?;
    let folder =
        DocFolderRepo::create(&state.db, app_id, input.name, parent_id, input.icon).await?;
    // Convert to output via partial model query
    let output = doc_folders::Entity::find_by_id(folder.id)
        .into_partial_model::<DocFolderOutput>()
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::Internal("failed to fetch created folder".into()))?;
    Ok(ok(output))
}

/// PATCH /api/doc-folders/{id}
pub async fn update_folder(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateFolderInput>,
) -> Result<Json<ApiResponse<DocFolderOutput>>, AppError> {
    let folder_id = parse_uuid(&id)?;
    let folder = DocFolderRepo::update(&state.db, folder_id, input.name, input.icon, input.sort_order)
        .await?
        .ok_or_else(|| AppError::NotFound("folder not found".into()))?;
    let output = doc_folders::Entity::find_by_id(folder.id)
        .into_partial_model::<DocFolderOutput>()
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::Internal("failed to fetch updated folder".into()))?;
    Ok(ok(output))
}

/// DELETE /api/doc-folders/{id}
pub async fn delete_folder(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let folder_id = parse_uuid(&id)?;
    let deleted = DocFolderRepo::delete(&state.db, folder_id).await?;
    if !deleted {
        return Err(AppError::NotFound("folder not found".into()));
    }
    Ok(ok_empty())
}
