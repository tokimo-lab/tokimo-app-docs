use std::collections::HashMap;
use std::sync::Arc;

use bytes::Bytes;
use tracing::error;

use crate::db::entities::{docs_nodes, docs_spaces};
use crate::services::storage::StorageProvider;

/// Synchronizes doc nodes to S3 as markdown files.
///
/// - `notion` docs: converted via `tokimo-plate-markdown` to a single `README.md`
///   inside `{slug}/{title}/`. Attachments are NOT split — referenced by full
///   `/storage/...` URLs in the markdown for lossless round-trip.
/// - `markdown` docs: content written as-is to `{slug}/{title}.md`.
/// - Other types: skipped.
///
/// Attachments are NOT copied — instead a `.attachments.json` manifest maps
/// virtual filenames to their original storage keys. The VFS driver uses this
/// manifest to serve attachment reads directly from the source location, while
/// keeping the markdown body fully reversible.
pub struct DocMarkdownSyncService;

/// S3 key prefix for all docs markdown files.
const S3_PREFIX: &str = "docs-md";

/// Hidden manifest file that maps attachment filenames → source storage keys.
/// Stored alongside markdown files so the VFS driver can serve attachments
/// without duplicating data.
pub const ATTACHMENTS_MANIFEST: &str = ".attachments.json";

/// Filename for notion-doc body inside `{slug}/{title}/`.
pub const NOTION_BODY_FILENAME: &str = "README.md";

impl DocMarkdownSyncService {
    /// Sync a single node's markdown representation to S3.
    pub async fn sync_node(
        storage: &dyn StorageProvider,
        space: &docs_spaces::Model,
        node: &docs_nodes::Model,
    ) -> Result<(), String> {
        let slug = space.id.to_string();
        let slug = slug.as_str();

        match node.r#type.as_str() {
            "notion" => Self::sync_notion_node(storage, slug, node).await,
            "markdown" => Self::sync_markdown_node(storage, slug, node).await,
            _ => Ok(()),
        }
    }

    /// Sync a notion (Plate JSON) document: convert to single README.md plus
    /// optional attachment manifest. No chapter splitting; URLs are kept verbatim
    /// for round-trip parsing.
    async fn sync_notion_node(
        storage: &dyn StorageProvider,
        slug: &str,
        node: &docs_nodes::Model,
    ) -> Result<(), String> {
        let content = node.content.as_ref().ok_or("notion node has no content")?;

        let md = tokimo_plate_markdown::plate_to_markdown(content)
            .map_err(|e| format!("plate→md conversion failed: {e}"))?;

        let attachments = tokimo_plate_markdown::extract_attachments(content);
        let attachments = tokimo_plate_markdown::dedupe_attachments(&attachments);

        let title_safe = sanitize_path_component(&node.title);
        let base = format!("{S3_PREFIX}/{slug}/{title_safe}");

        // Always write README.md (single body, no splitting).
        storage
            .upload(&format!("{base}/{NOTION_BODY_FILENAME}"), Bytes::from(md), None)
            .await?;

        // Attachment manifest serves virtual file entries in VFS listings.
        if !attachments.is_empty() {
            let manifest: HashMap<&str, &str> = attachments
                .iter()
                .filter_map(|att| {
                    let source_key = att.url.strip_prefix("/storage/")?;
                    if source_key.is_empty() {
                        return None;
                    }
                    Some((att.filename.as_str(), source_key))
                })
                .collect();

            let manifest_json =
                serde_json::to_string_pretty(&manifest).map_err(|e| format!("manifest serialize failed: {e}"))?;
            storage
                .upload(
                    &format!("{base}/{ATTACHMENTS_MANIFEST}"),
                    Bytes::from(manifest_json),
                    None,
                )
                .await?;
        }

        Ok(())
    }

    /// Sync a markdown document: content is already markdown text, just upload.
    async fn sync_markdown_node(
        storage: &dyn StorageProvider,
        slug: &str,
        node: &docs_nodes::Model,
    ) -> Result<(), String> {
        let md_text = node.content.as_ref().and_then(|v| v.as_str()).unwrap_or("");

        let title_safe = sanitize_path_component(&node.title);
        let key = format!("{S3_PREFIX}/{slug}/{title_safe}.md");
        storage.upload(&key, Bytes::from(md_text.to_owned()), None).await
    }

    /// Trigger async sync — fire and forget, logs errors.
    pub fn spawn_sync(storage: Arc<dyn StorageProvider>, space: docs_spaces::Model, node: docs_nodes::Model) {
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
