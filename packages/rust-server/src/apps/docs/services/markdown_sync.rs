use std::sync::Arc;

use bytes::Bytes;
use tracing::error;

use crate::db::entities::{doc_nodes, doc_spaces};
use crate::services::storage::StorageProvider;

/// Synchronizes doc nodes to S3 as markdown files.
///
/// - `notion` docs: converted via `tokimo-plate-markdown` with smart splitting
/// - `markdown` docs: content written as-is
/// - Other types: skipped
pub struct DocMarkdownSyncService;

/// S3 key prefix for all docs markdown files.
const S3_PREFIX: &str = "docs-md";

impl DocMarkdownSyncService {
    /// Sync a single node's markdown representation to S3.
    ///
    /// Called asynchronously after a document save. Errors are logged, not propagated
    /// to the save path.
    pub async fn sync_node(
        storage: &dyn StorageProvider,
        space: &doc_spaces::Model,
        node: &doc_nodes::Model,
    ) -> Result<(), String> {
        let Some(ref slug) = space.slug else {
            return Err("space has no slug, cannot sync to S3".into());
        };

        match node.r#type.as_str() {
            "notion" => Self::sync_notion_node(storage, slug, node).await,
            "markdown" => Self::sync_markdown_node(storage, slug, node).await,
            _ => Ok(()), // Other types are not synced
        }
    }

    /// Sync a notion (Plate JSON) document: convert → split → upload.
    async fn sync_notion_node(
        storage: &dyn StorageProvider,
        slug: &str,
        node: &doc_nodes::Model,
    ) -> Result<(), String> {
        let content = node.content.as_ref().ok_or("notion node has no content")?;

        let result = tokimo_plate_markdown::split_to_sections(content, &node.title)
            .map_err(|e| format!("plate→md conversion failed: {e}"))?;

        let attachments = tokimo_plate_markdown::extract_attachments(content);
        let title_safe = sanitize_path_component(&node.title);

        if result.sections.len() <= 1 && attachments.is_empty() {
            // Simple document: store as flat .md file
            let md = result
                .sections
                .first()
                .map(|s| s.markdown.as_str())
                .or(result.preamble.as_deref())
                .unwrap_or("");
            let key = format!("{S3_PREFIX}/{slug}/{title_safe}.md");
            storage.upload(&key, Bytes::from(md.to_owned()), None).await?;
        } else {
            // Complex document: store as directory with sections + attachments
            let base = format!("{S3_PREFIX}/{slug}/{title_safe}");

            if let Some(ref preamble) = result.preamble {
                storage
                    .upload(&format!("{base}/README.md"), Bytes::from(preamble.clone()), None)
                    .await?;
            }

            for section in &result.sections {
                storage
                    .upload(
                        &format!("{base}/{}", section.filename),
                        Bytes::from(section.markdown.clone()),
                        None,
                    )
                    .await?;
            }

            // Log attachment references for now — actual attachment copy
            // requires resolving storage URLs, which will be implemented when
            // we integrate with the VFS layer.
            if !attachments.is_empty() {
                tracing::debug!(
                    "Node {} has {} attachments to sync (not yet copied)",
                    node.id,
                    attachments.len()
                );
            }
        }

        Ok(())
    }

    /// Sync a markdown document: content is already markdown text, just upload.
    async fn sync_markdown_node(
        storage: &dyn StorageProvider,
        slug: &str,
        node: &doc_nodes::Model,
    ) -> Result<(), String> {
        let md_text = node.content.as_ref().and_then(|v| v.as_str()).unwrap_or("");

        let title_safe = sanitize_path_component(&node.title);
        let key = format!("{S3_PREFIX}/{slug}/{title_safe}.md");
        storage.upload(&key, Bytes::from(md_text.to_owned()), None).await
    }

    /// Trigger async sync — fire and forget, logs errors.
    pub fn spawn_sync(storage: Arc<dyn StorageProvider>, space: doc_spaces::Model, node: doc_nodes::Model) {
        tokio::spawn(async move {
            if let Err(e) = Self::sync_node(storage.as_ref(), &space, &node).await {
                error!(
                    node_id = %node.id,
                    space_id = %space.id,
                    "Markdown S3 sync failed: {e}"
                );
            }
        });
    }
}

/// Sanitize a string for use as a filesystem path component.
/// Replaces `/`, `\`, NUL with `_`, trims whitespace and dots.
fn sanitize_path_component(name: &str) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_path_component() {
        assert_eq!(sanitize_path_component("hello/world"), "hello_world");
        assert_eq!(sanitize_path_component("  ...  "), "untitled");
        assert_eq!(sanitize_path_component("normal"), "normal");
        assert_eq!(sanitize_path_component("a:b*c?d"), "a_b_c_d");
    }
}
