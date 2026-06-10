use crate::services::storage::StorageProvider;
use std::path::Path;
use std::sync::Arc;
use tracing::error;

pub struct DocMarkdownSyncService;
pub const ATTACHMENTS_MANIFEST: &str = ".attachments.json";
pub const NOTION_BODY_FILENAME: &str = "README.md";

impl DocMarkdownSyncService {
    pub async fn sync_markdown(storage: &dyn StorageProvider, key: &str, content: &str) -> Result<(), String> {
        storage
            .upload(Path::new(key), content.as_bytes(), None)
            .await
            .map_err(|e| e.to_string())
    }
    pub fn spawn_markdown_sync(storage: Arc<dyn StorageProvider>, key: String, content: String) {
        tokio::spawn(async move {
            if let Err(e) = Self::sync_markdown(storage.as_ref(), &key, &content).await {
                error!("Markdown sync failed: {e}");
            }
        });
    }
}

pub(crate) fn sanitize_path_component(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | '\0' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect();
    let trimmed = sanitized.trim().trim_matches('.');
    if trimmed.is_empty() {
        "untitled".to_string()
    } else {
        trimmed.to_string()
    }
}
