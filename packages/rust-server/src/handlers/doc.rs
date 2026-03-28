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
    db::models::doc::{
        DocCommentOutput, DocFolderOutput, DocOutput, DocVersionDetailOutput, DocVersionOutput,
    },
    db::pagination::PageInput,
    db::repos::doc_repo::{DocCommentRepo, DocFolderRepo, DocRepo, DocVersionRepo},
    error::AppError,
    handlers::{ok, ok_empty, ApiResponse},
    handlers::user::AuthUser,
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
    pub tags: Option<String>,
    pub archived: Option<bool>,
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
    pub tags: Option<Vec<String>>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentInput {
    pub comment_key: String,
    pub content: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveCommentInput {
    pub resolved: bool,
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
    let tags_filter: Option<Vec<String>> = q.tags.as_ref().map(|t| {
        t.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });
    let result = DocRepo::list(
        &state.db,
        app_id,
        &page_input,
        q.sort_by.as_deref().unwrap_or("updatedAt"),
        q.sort_dir.as_deref().unwrap_or("desc"),
        q.search.as_deref(),
        folder_id,
        q.favorites_only.unwrap_or(false),
        tags_filter.as_deref(),
        q.archived.unwrap_or(false),
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

/// GET /api/apps/{id}/doc-tags
pub async fn list_tags(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<String>>>, AppError> {
    let app_id = parse_uuid(&id)?;
    let tags = DocRepo::list_tags(&state.db, app_id).await?;
    Ok(ok(tags))
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
    let doc = DocService::update_doc_with_version(
        &state.db,
        doc_id,
        input.title,
        input.content,
        input.icon,
        input.cover_image,
        input.tags,
    )
    .await?;
    Ok(ok(DocOutput::from(doc)))
}

/// DELETE /api/docs/{id} — soft delete (archive)
pub async fn delete_doc(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let archived = DocRepo::archive(&state.db, doc_id, true).await?;
    if !archived {
        return Err(AppError::NotFound("doc not found".into()));
    }
    Ok(ok_empty())
}

/// PATCH /api/docs/{id}/restore
pub async fn restore_doc(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let restored = DocRepo::archive(&state.db, doc_id, false).await?;
    if !restored {
        return Err(AppError::NotFound("doc not found".into()));
    }
    Ok(ok_empty())
}

/// DELETE /api/docs/{id}/permanent — hard delete
pub async fn permanent_delete_doc(
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

// ── Comment handlers ─────────────────────────────────────────────────────────

/// GET /api/docs/{id}/comments
pub async fn list_comments(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<DocCommentOutput>>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let comments = DocCommentRepo::list_by_doc(&state.db, doc_id).await?;
    Ok(ok(comments))
}

/// POST /api/docs/{id}/comments
pub async fn create_comment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    auth_user: AuthUser,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let user_id = parse_uuid(&auth_user.0.user_id)?;
    let parent_id = input
        .parent_id
        .as_deref()
        .map(parse_uuid)
        .transpose()?;
    let comment = DocCommentRepo::create(
        &state.db,
        doc_id,
        user_id,
        input.comment_key,
        input.content,
        parent_id,
    )
    .await?;

    Ok(ok(serde_json::json!({
        "id": comment.id.to_string(),
        "commentKey": comment.comment_key,
        "createdAt": comment.created_at.to_rfc3339(),
    })))
}

/// PATCH /api/doc-comments/{id}/resolve
pub async fn resolve_comment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<ResolveCommentInput>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let comment_id = parse_uuid(&id)?;
    let resolved = DocCommentRepo::resolve(&state.db, comment_id, input.resolved).await?;
    if !resolved {
        return Err(AppError::NotFound("comment not found".into()));
    }
    Ok(ok_empty())
}

/// DELETE /api/doc-comments/{id}
pub async fn delete_comment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let comment_id = parse_uuid(&id)?;
    let deleted = DocCommentRepo::delete(&state.db, comment_id).await?;
    if !deleted {
        return Err(AppError::NotFound("comment not found".into()));
    }
    Ok(ok_empty())
}

// ── Version handlers ─────────────────────────────────────────────────────────

/// GET /api/docs/{id}/versions
pub async fn list_versions(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<DocVersionOutput>>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let versions = DocVersionRepo::list(&state.db, doc_id).await?;
    let outputs: Vec<DocVersionOutput> = versions.into_iter().map(DocVersionOutput::from).collect();
    Ok(ok(outputs))
}

/// GET /api/doc-versions/{id}
pub async fn get_version(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<DocVersionDetailOutput>>, AppError> {
    let version_id = parse_uuid(&id)?;
    let version = DocVersionRepo::get_by_id(&state.db, version_id)
        .await?
        .ok_or_else(|| AppError::NotFound("version not found".into()))?;
    Ok(ok(DocVersionDetailOutput::from(version)))
}

/// POST /api/docs/{id}/versions/{version_id}/restore
pub async fn restore_version(
    State(state): State<Arc<AppState>>,
    Path((id, version_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<DocOutput>>, AppError> {
    let doc_id = parse_uuid(&id)?;
    let vid = parse_uuid(&version_id)?;

    let version = DocVersionRepo::get_by_id(&state.db, vid)
        .await?
        .ok_or_else(|| AppError::NotFound("version not found".into()))?;

    if version.doc_id != doc_id {
        return Err(AppError::BadRequest(
            "version does not belong to this doc".into(),
        ));
    }

    // Restore: update doc with version's content and title
    let doc = DocService::update_doc_with_version(
        &state.db,
        doc_id,
        Some(version.title),
        Some(version.content),
        None,
        None,
        None,
    )
    .await?;
    Ok(ok(DocOutput::from(doc)))
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
