use axum::{
    extract::{Multipart, Path, State},
    response::{IntoResponse, Response},
};
use axum::http::StatusCode;
use bytes::Bytes;
use std::sync::Arc;
use tracing::{debug, error};
use uuid::Uuid;

use tokimo_filetype_detector::detect_buffer;

use crate::apps::docs::models::DocNodeAttachmentOutput;
use crate::apps::docs::repos::attachment_repo::{AttachmentRepo, CreateAttachmentParams};
use crate::apps::docs::services::preview_service;
use crate::error::OptionExt;
use crate::handlers::user::AuthUser;
use crate::handlers::{err_resp, ok, ok_empty};
use crate::services::storage::UploadOptions;
use crate::AppState;

/// POST /api/apps/docs/nodes/{id}/attachments/upload
///
/// Upload a file attachment to a doc node.
/// Accepts multipart/form-data with a single "file" field.
pub async fn upload_attachment(
    State(state): State<Arc<AppState>>,
    Path(node_id): Path<Uuid>,
    AuthUser(_auth): AuthUser,
    mut multipart: Multipart,
) -> Response {
    let field = match multipart.next_field().await {
        Ok(Some(f)) => f,
        Ok(None) => {
            return err_resp::<()>(StatusCode::BAD_REQUEST, "No file provided".into())
                .into_response()
        }
        Err(e) => {
            return err_resp::<()>(StatusCode::BAD_REQUEST, format!("Multipart error: {e}"))
                .into_response()
        }
    };

    let content_type = field
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();

    let file_name = field
        .file_name()
        .unwrap_or("unnamed")
        .to_string();

    let data = match field.bytes().await {
        Ok(b) => b,
        Err(e) => {
            return err_resp::<()>(StatusCode::BAD_REQUEST, format!("Failed to read file: {e}"))
                .into_response()
        }
    };

    let file_size = data.len() as i32;

    // Derive extension from original file name or content type
    let ext = std::path::Path::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .map_or_else(
            || {
                mime_guess::get_mime_extensions_str(&content_type)
                    .and_then(|exts| exts.first().copied())
                    .unwrap_or("bin")
                    .to_string()
            },
            str::to_lowercase,
        );

    let storage_key = format!(
        "docs/attachments/{}/{}{}",
        node_id,
        Uuid::new_v4(),
        if ext.is_empty() {
            String::new()
        } else {
            format!(".{ext}")
        }
    );

    debug!(
        "Uploading attachment: key={}, name={}, size={}, type={}",
        storage_key, file_name, file_size, content_type
    );

    let options = UploadOptions {
        content_type: Some(content_type.clone()),
    };

    if let Err(e) = state
        .storage
        .upload(&storage_key, Bytes::from(data.to_vec()), Some(options))
        .await
    {
        return err_resp::<()>(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Storage upload failed: {e}"),
        )
        .into_response();
    }

    // Detect file type from content
    let file_info = detect_buffer(&data, Some(&file_name));

    match AttachmentRepo::create(
        &state.db,
        CreateAttachmentParams {
            node_id,
            storage_key: storage_key.clone(),
            file_name,
            file_type: content_type,
            file_size,
            is_binary: Some(file_info.is_binary),
            detected_mime: Some(file_info.mime),
            file_category: Some(file_info.category.as_str().to_string()),
            text_encoding: file_info.encoding,
            detected_language: file_info.language,
        },
    )
    .await
    {
        Ok(record) => ok(DocNodeAttachmentOutput::from(record)).into_response(),
        Err(e) => {
            // Best-effort cleanup of the uploaded file
            let sk = storage_key.clone();
            let storage = state.storage.clone();
            tokio::spawn(async move {
                if let Err(del_err) = storage.delete(&sk).await {
                    error!("Failed to clean up storage after DB error: {del_err}");
                }
            });
            err_resp::<()>(StatusCode::INTERNAL_SERVER_ERROR, format!("DB insert failed: {e}"))
                .into_response()
        }
    }
}

/// GET /api/apps/docs/nodes/{id}/attachments
///
/// List all attachments for a doc node.
pub async fn list_attachments(
    State(state): State<Arc<AppState>>,
    Path(node_id): Path<Uuid>,
    AuthUser(_auth): AuthUser,
) -> Response {
    match AttachmentRepo::list_by_node(&state.db, node_id).await {
        Ok(rows) => {
            let items: Vec<DocNodeAttachmentOutput> =
                rows.into_iter().map(DocNodeAttachmentOutput::from).collect();
            ok(items).into_response()
        }
        Err(e) => {
            err_resp::<()>(StatusCode::INTERNAL_SERVER_ERROR, format!("List failed: {e}"))
                .into_response()
        }
    }
}

/// DELETE /api/apps/docs/attachments/{id}
///
/// Soft-delete a single attachment (marks deleted_at, S3 file kept for 7 days).
pub async fn delete_attachment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    AuthUser(_auth): AuthUser,
) -> Response {
    match AttachmentRepo::soft_delete(&state.db, id).await {
        Ok(true) => ok_empty().into_response(),
        Ok(false) => {
            err_resp::<()>(StatusCode::NOT_FOUND, "Attachment not found".into()).into_response()
        }
        Err(e) => {
            err_resp::<()>(StatusCode::INTERNAL_SERVER_ERROR, format!("Delete failed: {e}"))
                .into_response()
        }
    }
}

/// GET /api/apps/docs/attachments/{id}/preview
///
/// Returns a URL to a PDF preview of the attachment.
/// For Office documents, converts via Gotenberg and caches the result.
pub async fn preview_attachment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    AuthUser(_auth): AuthUser,
) -> Response {
    // 1. Look up attachment
    let record = match AttachmentRepo::get_by_id(&state.db, id).await {
        Ok(opt) => match opt.not_found("Attachment not found") {
            Ok(r) => r,
            Err(e) => {
                return err_resp::<()>(StatusCode::NOT_FOUND, format!("{e}")).into_response()
            }
        },
        Err(e) => {
            return err_resp::<()>(StatusCode::INTERNAL_SERVER_ERROR, format!("{e}"))
                .into_response()
        }
    };

    let id_str = id.to_string();

    // 2. Check cache
    if let Some(url) = preview_service::get_cached_preview(&state.storage, &id_str).await {
        return ok(serde_json::json!({ "url": url })).into_response();
    }

    // 3. Check Gotenberg is configured
    let gotenberg_url = match &state.gotenberg_url {
        Some(url) => url.clone(),
        None => {
            return err_resp::<()>(
                StatusCode::SERVICE_UNAVAILABLE,
                "Preview service not configured".into(),
            )
            .into_response()
        }
    };

    // 4. Convert via Gotenberg and cache
    match preview_service::convert_and_cache(
        &state.storage,
        &gotenberg_url,
        &id_str,
        &record.storage_key,
        &record.file_name,
    )
    .await
    {
        Ok(url) => ok(serde_json::json!({ "url": url })).into_response(),
        Err(e) => {
            error!("Preview conversion failed for attachment {id}: {e}");
            err_resp::<()>(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Preview failed: {e}"),
            )
            .into_response()
        }
    }
}

/// POST /api/apps/docs/attachments/{id}/restore
///
/// Restore a soft-deleted attachment (clears deleted_at).
pub async fn restore_attachment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    AuthUser(_auth): AuthUser,
) -> Response {
    match AttachmentRepo::restore(&state.db, id).await {
        Ok(true) => ok_empty().into_response(),
        Ok(false) => {
            err_resp::<()>(StatusCode::NOT_FOUND, "Attachment not found".into()).into_response()
        }
        Err(e) => {
            err_resp::<()>(StatusCode::INTERNAL_SERVER_ERROR, format!("Restore failed: {e}"))
                .into_response()
        }
    }
}
