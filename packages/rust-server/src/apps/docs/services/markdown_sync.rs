use std::collections::HashMap;
use std::sync::Arc;

use bytes::Bytes;
use tracing::error;

use crate::db::entities::{docs_nodes, docs_spaces};
use crate::services::storage::StorageProvider;

/// Synchronizes doc nodes to S3 as markdown files.
///
/// - `notion` docs: converted via `tokimo-plate-markdown` with smart splitting
/// - `markdown` docs: content written as-is
/// - Other types: skipped
///
/// Attachments are NOT copied — instead a `.attachments.json` manifest maps
/// virtual filenames to their original storage keys. The VFS driver uses this
/// manifest to serve attachment reads directly from the source location.
pub struct DocMarkdownSyncService;

/// S3 key prefix for all docs markdown files.
const S3_PREFIX: &str = "docs-md";

/// Hidden manifest file that maps attachment filenames → source storage keys.
/// Stored alongside markdown files so the VFS driver can serve attachments
/// without duplicating data.
pub const ATTACHMENTS_MANIFEST: &str = ".attachments.json";

impl DocMarkdownSyncService {
    /// Sync a single node's markdown representation to S3.
    pub async fn sync_node(
        storage: &dyn StorageProvider,
        space: &docs_spaces::Model,
        node: &docs_nodes::Model,
    ) -> Result<(), String> {
        let Some(ref slug) = space.slug else {
            return Err("space has no slug, cannot sync to S3".into());
        };

        match node.r#type.as_str() {
            "notion" => Self::sync_notion_node(storage, slug, node).await,
            "markdown" => Self::sync_markdown_node(storage, slug, node).await,
            _ => Ok(()),
        }
    }

    /// Sync a notion (Plate JSON) document: convert → split → upload manifest.
    async fn sync_notion_node(
        storage: &dyn StorageProvider,
        slug: &str,
        node: &docs_nodes::Model,
    ) -> Result<(), String> {
        let content = node.content.as_ref().ok_or("notion node has no content")?;

        let result = tokimo_plate_markdown::split_to_sections(content, &node.title)
            .map_err(|e| format!("plate→md conversion failed: {e}"))?;

        let attachments = tokimo_plate_markdown::extract_attachments(content);
        let title_safe = sanitize_path_component(&node.title);
        let has_attachments = !attachments.is_empty();

        if result.sections.len() <= 1 && !has_attachments {
            // Simple document without attachments: flat .md file
            let md = result
                .sections
                .first()
                .map(|s| s.markdown.as_str())
                .or(result.preamble.as_deref())
                .unwrap_or("");
            let key = format!("{S3_PREFIX}/{slug}/{title_safe}.md");
            storage.upload(&key, Bytes::from(md.to_owned()), None).await?;
        } else {
            // Directory-based document: sections + attachment manifest
            let base = format!("{S3_PREFIX}/{slug}/{title_safe}");

            // Rewrite attachment URLs once to get deduplicated filenames
            let (_, deduped) = if has_attachments {
                tokimo_plate_markdown::rewrite_attachment_urls("", &attachments)
            } else {
                (String::new(), Vec::new())
            };

            if let Some(ref preamble) = result.preamble {
                let md = if has_attachments {
                    let (rewritten, _) = tokimo_plate_markdown::rewrite_attachment_urls(preamble, &attachments);
                    rewritten
                } else {
                    preamble.clone()
                };
                storage
                    .upload(&format!("{base}/README.md"), Bytes::from(md), None)
                    .await?;
            }

            for section in &result.sections {
                let md = if has_attachments {
                    let (rewritten, _) =
                        tokimo_plate_markdown::rewrite_attachment_urls(&section.markdown, &attachments);
                    rewritten
                } else {
                    section.markdown.clone()
                };
                storage
                    .upload(&format!("{base}/{}", section.filename), Bytes::from(md), None)
                    .await?;
            }

            // Write attachment manifest instead of copying files.
            // Maps: { "cos正太体型.dat": "docs/attachments/{space_id}/{uuid}.dat", ... }
            if !deduped.is_empty() {
                let manifest: HashMap<&str, &str> = deduped
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
