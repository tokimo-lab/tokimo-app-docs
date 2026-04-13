use axum::extract::{Path, State};
use axum::http::header;
use axum::response::{IntoResponse, Response};
use axum::Json;
use sea_orm::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;
use uuid::Uuid;

use crate::apps::docs::services::whiteboard_library as wb_svc;
use crate::db::entities::doc_whiteboard_user_libraries;
use crate::error::AppError;
use crate::handlers::user::AuthUser;
use crate::handlers::{ok, ok_empty, ApiResponse};
use crate::AppState;

// ── DTOs ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct LibraryCatalogItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub authors: Vec<LibraryAuthor>,
    pub preview_url: String,
    #[ts(type = "number | null")]
    pub item_count: Option<usize>,
    pub item_names: Option<Vec<String>>,
    pub created: String,
    pub updated: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LibraryAuthor {
    pub name: String,
    pub url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveUserLibraryBody {
    pub items: serde_json::Value,
}

// ── Handlers ────────────────────────────────────────────────────────

/// GET /api/apps/docs/whiteboard/libraries
pub async fn list_libraries(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<Vec<LibraryCatalogItem>>>, AppError> {
    let entries = wb_svc::get_catalog(&state.http_client).await?;

    let items: Vec<LibraryCatalogItem> = entries
        .into_iter()
        .map(|e| {
            let item_count = e.item_names.as_ref().map(|v| v.len());
            LibraryCatalogItem {
                preview_url: format!("/api/apps/docs/whiteboard/libraries/{}/preview", e.id),
                id: e.id,
                name: e.name,
                description: e.description,
                authors: e
                    .authors
                    .into_iter()
                    .map(|a| LibraryAuthor {
                        name: a.name,
                        url: a.url,
                    })
                    .collect(),
                item_count,
                item_names: e.item_names,
                created: e.created,
                updated: e.updated,
            }
        })
        .collect();

    Ok(ok(items))
}

/// GET /api/apps/docs/whiteboard/libraries/:id/download
pub async fn download_library(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    let url = wb_svc::get_library_source_url(&state.http_client, &id).await?;
    let filename = format!("{id}.excalidrawlib");
    let (bytes, content_type) = wb_svc::fetch_cached_file(
        &state.http_client,
        &url,
        wb_svc::lib_cache_dir(),
        &filename,
    )
    .await?;

    Ok((
        [
            (header::CONTENT_TYPE, content_type),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"library.excalidrawlib\"",
            ),
        ],
        bytes,
    )
        .into_response())
}

/// GET /api/apps/docs/whiteboard/libraries/:id/preview
pub async fn preview_library(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    let url = wb_svc::get_library_preview_url(&state.http_client, &id).await?;
    let filename = format!("{id}.png");
    let (bytes, content_type) = wb_svc::fetch_cached_file(
        &state.http_client,
        &url,
        wb_svc::preview_cache_dir(),
        &filename,
    )
    .await?;

    Ok((
        [
            (header::CONTENT_TYPE, content_type),
            (header::CACHE_CONTROL, "public, max-age=86400"),
        ],
        bytes,
    )
        .into_response())
}

/// GET /api/apps/docs/whiteboard/user-library
pub async fn get_user_library(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user_id: Uuid = auth_user.0.user_id.parse().map_err(|_| {
        AppError::BadRequest(format!("invalid user id: {}", auth_user.0.user_id))
    })?;

    let row = doc_whiteboard_user_libraries::Entity::find()
        .filter(doc_whiteboard_user_libraries::Column::UserId.eq(user_id))
        .one(&state.db)
        .await?;

    let items = row.map(|r| r.items).unwrap_or(serde_json::json!([]));
    Ok(ok(items))
}

/// PUT /api/apps/docs/whiteboard/user-library
pub async fn save_user_library(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(body): Json<SaveUserLibraryBody>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let user_id: Uuid = auth_user.0.user_id.parse().map_err(|_| {
        AppError::BadRequest(format!("invalid user id: {}", auth_user.0.user_id))
    })?;

    let now = chrono::Utc::now().fixed_offset();

    let model = doc_whiteboard_user_libraries::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        items: Set(body.items),
        updated_at: Set(now),
    };

    doc_whiteboard_user_libraries::Entity::insert(model)
        .on_conflict(
            sea_orm::sea_query::OnConflict::column(
                doc_whiteboard_user_libraries::Column::UserId,
            )
            .update_column(doc_whiteboard_user_libraries::Column::Items)
            .update_column(doc_whiteboard_user_libraries::Column::UpdatedAt)
            .to_owned(),
        )
        .exec(&state.db)
        .await?;

    Ok(ok_empty())
}
