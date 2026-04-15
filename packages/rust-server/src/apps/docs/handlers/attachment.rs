use axum::{
    extract::{Multipart, Path, State},
    response::{IntoResponse, Response},
};
use axum::http::StatusCode;
use bytes::Bytes;
use std::sync::Arc;
use tracing::{debug, error};
use uuid::Uuid;

use crate::apps::docs::models::DocNodeAttachmentOutput;
use crate::apps::docs::repos::attachment_repo::AttachmentRepo;
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

    match AttachmentRepo::create(
        &state.db,
        node_id,
        &storage_key,
        &file_name,
        &content_type,
        file_size,
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
/// Delete a single attachment (DB record + storage file).
pub async fn delete_attachment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    AuthUser(_auth): AuthUser,
) -> Response {
    // Fetch record first to get storage key
    let record = match AttachmentRepo::get_by_id(&state.db, id).await {
        Ok(Some(r)) => r,
        Ok(None) => {
            return err_resp::<()>(StatusCode::NOT_FOUND, "Attachment not found".into())
                .into_response()
        }
        Err(e) => {
            return err_resp::<()>(StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {e}"))
                .into_response()
        }
    };

    let storage_key = record.storage_key.clone();

    // Delete DB record
    if let Err(e) = AttachmentRepo::delete_by_id(&state.db, id).await {
        return err_resp::<()>(StatusCode::INTERNAL_SERVER_ERROR, format!("Delete failed: {e}"))
            .into_response();
    }

    // Fire-and-forget storage cleanup
    let storage = state.storage.clone();
    tokio::spawn(async move {
        if let Err(e) = storage.delete(&storage_key).await {
            error!("Failed to delete attachment file from storage: {e}");
        }
    });

    ok_empty().into_response()
}
