use bytes::Bytes;
use reqwest::multipart;
use std::sync::Arc;
use tracing::debug;

use crate::error::AppError;
use crate::services::storage::{StorageProvider, UploadOptions};

/// S3 key for cached preview PDFs.
fn preview_cache_key(attachment_id: &str) -> String {
    format!("docs/previews/{attachment_id}.pdf")
}

/// Storage-relative URL for cached preview PDFs.
fn preview_url(attachment_id: &str) -> String {
    format!("/storage/docs/previews/{attachment_id}.pdf")
}

/// Check if a cached preview exists, returning its URL if so.
pub async fn get_cached_preview(storage: &Arc<dyn StorageProvider>, attachment_id: &str) -> Option<String> {
    let key = preview_cache_key(attachment_id);
    match storage.exists(&key).await {
        Ok(true) => Some(preview_url(attachment_id)),
        _ => None,
    }
}

/// Convert a file to PDF via Gotenberg and cache the result in S3.
/// Returns the URL to the cached preview.
pub async fn convert_and_cache(
    storage: &Arc<dyn StorageProvider>,
    gotenberg_url: &str,
    attachment_id: &str,
    original_key: &str,
    file_name: &str,
) -> Result<String, AppError> {
    // Download original from storage
    let original_data = storage
        .download(original_key)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to download original file: {e}")))?;

    debug!(attachment_id, file_name, "Converting attachment to PDF via Gotenberg");

    // Send to Gotenberg for conversion
    let pdf_bytes = call_gotenberg(gotenberg_url, &original_data, file_name).await?;

    // Upload PDF to cache
    let cache_key = preview_cache_key(attachment_id);
    let options = UploadOptions {
        content_type: Some("application/pdf".to_string()),
    };
    storage
        .upload(&cache_key, pdf_bytes, Some(options))
        .await
        .map_err(|e| AppError::Internal(format!("Failed to cache preview PDF: {e}")))?;

    Ok(preview_url(attachment_id))
}

async fn call_gotenberg(gotenberg_url: &str, file_data: &[u8], file_name: &str) -> Result<Bytes, AppError> {
    let url = format!("{gotenberg_url}/forms/libreoffice/convert");

    let part = multipart::Part::bytes(file_data.to_vec())
        .file_name(file_name.to_string())
        .mime_str("application/octet-stream")
        .map_err(|e| AppError::Internal(format!("MIME error: {e}")))?;

    let form = multipart::Form::new().part("files", part);

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Gotenberg request failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Gotenberg conversion failed ({status}): {body}"
        )));
    }

    resp.bytes()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read Gotenberg response: {e}")))
}
