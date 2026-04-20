//! Callback that reacts to VFS writes on the docs FUSE mount at `/mnt/docs`.
//!
//! When a markdown file is written via VFS/FUSE, this callback resolves the
//! target space from the slug directory in the path, then updates (or creates)
//! the corresponding `docs_nodes` record in the database.
//!
//! Path conventions:
//! - `{slug}/{title}.md`           → `markdown`-type node, content is raw md (JSON string)
//! - `{slug}/{title}/README.md`    → `notion`-type node, content is plate JSON array
//!   (parsed from markdown via `tokimo_plate_markdown::markdown_to_plate`)

use std::sync::Arc;

use sea_orm::*;
use sea_orm::sea_query::Expr;
use tracing::{info, warn};
use uuid::Uuid;

use crate::apps::docs::repos::attachment_repo::{AttachmentRepo, CreateAttachmentParams};
use crate::apps::docs::services::collab::CollabService;
use crate::apps::docs::services::markdown_sync::{NOTION_BODY_FILENAME, sanitize_path_component};
use crate::db::entities::{docs_node_attachments, docs_nodes, docs_spaces};
use crate::services::media::source::storage_driver::WriteCallback;
use crate::services::storage::StorageProvider;

/// Callback attached to the docs FUSE mount.
pub struct DocSpaceWriteCallback {
    db: DatabaseConnection,
    collab: Arc<CollabService>,
    storage: Arc<dyn StorageProvider>,
}

/// Logical kind derived from the relative VFS path.
enum PathKind<'a> {
    /// `{slug}/{title}.md` → markdown-type node.
    Markdown { title: &'a str },
    /// `{slug}/{dir}/README.md` → notion-type node, title = parent dir name.
    Notion { title: &'a str },
}

impl DocSpaceWriteCallback {
    pub fn new(
        db: DatabaseConnection,
        collab: Arc<CollabService>,
        storage: Arc<dyn StorageProvider>,
    ) -> Self {
        Self { db, collab, storage }
    }

    /// Extract slug and remaining file path.
    fn parse_path(relative_path: &str) -> Option<(&str, &str)> {
        let path = relative_path.trim_start_matches('/');
        let (slug, rest) = path.split_once('/')?;
        if slug.is_empty() || rest.is_empty() {
            return None;
        }
        Some((slug, rest))
    }

    /// Classify a path within a space into either markdown or notion.
    /// Only `.md` files are recognized; the manifest and attachments are ignored.
    fn classify_path(file_path: &str) -> Option<PathKind<'_>> {
        let p = std::path::Path::new(file_path);
        let ext = p.extension()?;
        if !ext.eq_ignore_ascii_case("md") {
            return None;
        }
        let basename = p.file_name()?.to_str()?;
        if basename.eq_ignore_ascii_case(NOTION_BODY_FILENAME) {
            // Need a parent directory to act as the title.
            let parent = p.parent()?;
            let dir = parent.file_name()?.to_str()?;
            if dir.is_empty() {
                return None;
            }
            Some(PathKind::Notion { title: dir })
        } else {
            // {slug}/{title}.md (only at the top level of the space; nested .md
            // files outside notion dirs are not supported).
            let title = basename.strip_suffix(".md").or_else(|| basename.strip_suffix(".MD"))?;
            if title.is_empty() {
                return None;
            }
            Some(PathKind::Markdown { title })
        }
    }

    async fn find_space_by_slug(&self, slug: &str) -> Result<Option<docs_spaces::Model>, DbErr> {
        docs_spaces::Entity::find()
            .filter(docs_spaces::Column::Slug.eq(slug))
            .one(&self.db)
            .await
    }

    /// Find a doc_node by title + type within a space.
    async fn find_node_by_title_and_type(
        &self,
        space_id: Uuid,
        title: &str,
        node_type: &str,
    ) -> Result<Option<docs_nodes::Model>, DbErr> {
        docs_nodes::Entity::find()
            .filter(docs_nodes::Column::SpaceId.eq(space_id))
            .filter(docs_nodes::Column::Type.eq(node_type))
            .filter(docs_nodes::Column::Title.eq(title))
            .one(&self.db)
            .await
    }

    /// Resolve a written file to (node_type, title, content_value).
    /// Returns Err(String) on conversion failure, Ok(None) if path is unsupported.
    fn resolve_write<'a>(
        kind: &PathKind<'a>,
        bytes: &[u8],
    ) -> Result<(&'static str, &'a str, serde_json::Value), String> {
        let text = String::from_utf8_lossy(bytes);
        match *kind {
            PathKind::Markdown { title } => {
                Ok(("markdown", title, serde_json::Value::String(text.into_owned())))
            }
            PathKind::Notion { title } => {
                let nodes = tokimo_plate_markdown::markdown_to_plate(&text)
                    .map_err(|e| format!("md→plate failed: {e}"))?;
                Ok(("notion", title, nodes))
            }
        }
    }

    /// Walk the plate tree and for each attachment/img node whose `url` points
    /// at our internal `/storage/...` space, fetch the first chunk of file
    /// content and run content-based MIME detection. This is important because
    /// extension-based detection is unreliable (e.g. `.dat` containing Lua
    /// source). Frontend uploads rely on the same content sniffing.
    ///
    /// Also reuses or creates a `docs_node_attachments` row per attachment so
    /// `attachmentId` is populated — required by OfficePreview for
    /// `.doc`/`.xls`/`.ppt` and for soft-delete tracking.
    async fn refine_attachment_mimes(&self, node_id: Uuid, content: &mut serde_json::Value) {
        let serde_json::Value::Array(nodes) = content else { return };
        // Preload existing attachment records so we can reuse ids by storage_key.
        let existing = match AttachmentRepo::list_by_node(&self.db, node_id).await {
            Ok(v) => v,
            Err(e) => {
                warn!("list attachments for {node_id} failed: {e}");
                Vec::new()
            }
        };
        for node in nodes.iter_mut() {
            self.refine_node_mime(node_id, node, &existing).await;
        }
    }

    async fn refine_node_mime(
        &self,
        node_id: Uuid,
        node: &mut serde_json::Value,
        existing: &[docs_node_attachments::Model],
    ) {
        let node_type = node.get("type").and_then(|v| v.as_str()).map(str::to_string);
        if matches!(node_type.as_deref(), Some("attachment" | "img"))
            && let Some(storage_key) =
                node.get("storageKey").and_then(|v| v.as_str()).map(str::to_string)
        {
            let filename = node
                .get("fileName")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            // Try to reuse an existing DB row (matched by storage_key) first.
            let (mime, category, is_binary, encoding, language, size_bytes, attachment_id) =
                if let Some(row) = existing.iter().find(|r| r.storage_key == storage_key) {
                    (
                        row.detected_mime.clone().unwrap_or_else(|| row.file_type.clone()),
                        row.file_category.clone().unwrap_or_default(),
                        row.is_binary.unwrap_or(false),
                        row.text_encoding.clone(),
                        row.detected_language.clone(),
                        row.file_size as u64,
                        row.id,
                    )
                } else if let Some((info, size)) =
                    self.detect_from_storage(&storage_key, filename.as_deref()).await
                {
                    // No existing row → create one so OfficePreview and soft-delete work.
                    let size_i32 = i32::try_from(size).unwrap_or(i32::MAX);
                    let category_str = info.category.as_str().to_string();
                    let created = AttachmentRepo::create(
                        &self.db,
                        CreateAttachmentParams {
                            node_id,
                            storage_key: storage_key.clone(),
                            file_name: filename.clone().unwrap_or_default(),
                            file_type: info.mime.clone(),
                            file_size: size_i32,
                            is_binary: Some(info.is_binary),
                            detected_mime: Some(info.mime.clone()),
                            file_category: Some(category_str.clone()),
                            text_encoding: info.encoding.clone(),
                            detected_language: info.language.clone(),
                        },
                    )
                    .await;
                    let attachment_id = match created {
                        Ok(m) => m.id,
                        Err(e) => {
                            warn!("create attachment row failed for {storage_key}: {e}");
                            Uuid::nil()
                        }
                    };
                    (
                        info.mime,
                        category_str,
                        info.is_binary,
                        info.encoding,
                        info.language,
                        size,
                        attachment_id,
                    )
                } else {
                    return;
                };

            if let Some(obj) = node.as_object_mut() {
                obj.insert("fileType".into(), serde_json::Value::String(mime.clone()));
                obj.insert("detectedMime".into(), serde_json::Value::String(mime));
                obj.insert("fileCategory".into(), serde_json::Value::String(category));
                obj.insert("isBinary".into(), serde_json::Value::Bool(is_binary));
                if let Some(enc) = encoding {
                    obj.insert("textEncoding".into(), serde_json::Value::String(enc));
                }
                if let Some(lang) = language {
                    obj.insert("detectedLanguage".into(), serde_json::Value::String(lang));
                }
                obj.insert(
                    "fileSize".into(),
                    serde_json::Value::Number(serde_json::Number::from(size_bytes)),
                );
                if attachment_id != Uuid::nil() {
                    obj.insert(
                        "attachmentId".into(),
                        serde_json::Value::String(attachment_id.to_string()),
                    );
                }
            }
        }
        // Recurse into children (tables, lists, columns, callouts, etc.)
        if let Some(children) = node.get_mut("children").and_then(|v| v.as_array_mut()) {
            for child in children.iter_mut() {
                Box::pin(self.refine_node_mime(node_id, child, existing)).await;
            }
        }
    }

    /// Download the attachment from storage and run content-based detection.
    /// Returns (`FileTypeInfo`, total_size). Caps sniff input at 64 KiB.
    async fn detect_from_storage(
        &self,
        storage_key: &str,
        filename: Option<&str>,
    ) -> Option<(tokimo_filetype_detector::FileTypeInfo, u64)> {
        let bytes = match self.storage.download(storage_key).await {
            Ok(b) => b,
            Err(e) => {
                warn!("attachment mime sniff: failed to download {storage_key}: {e}");
                return None;
            }
        };
        let total = bytes.len() as u64;
        let sniff_len = bytes.len().min(64 * 1024);
        let info = tokimo_filetype_detector::detect_buffer(&bytes[..sniff_len], filename);
        Some((info, total))
    }
}

#[async_trait::async_trait]
impl WriteCallback for DocSpaceWriteCallback {
    async fn on_file_written(&self, relative_path: &str, content: &[u8]) -> Result<(), String> {
        let Some((slug, file_path)) = Self::parse_path(relative_path) else {
            return Ok(());
        };
        let Some(kind) = Self::classify_path(file_path) else {
            return Ok(());
        };

        let space = self
            .find_space_by_slug(slug)
            .await
            .map_err(|e| format!("Failed to find space by slug '{slug}': {e}"))?;
        let Some(space) = space else {
            warn!(slug, "VFS write to unknown space slug, ignoring");
            return Ok(());
        };

        let (node_type, title_raw, mut content_value) = Self::resolve_write(&kind, content)?;
        // VFS path uses the sanitized title; for lookup we match raw title strings,
        // so we compare against any node whose sanitized title equals the dir name.
        let title = title_raw.to_string();

        // First try exact title match (typical case where title has no special chars).
        let existing = self
            .find_node_by_title_and_type(space.id, &title, node_type)
            .await
            .map_err(|e| format!("DB lookup failed: {e}"))?;
        // Fall back: scan space + sanitize. Cheap because a space's nodes are bounded.
        let existing = if existing.is_some() {
            existing
        } else {
            let candidates = docs_nodes::Entity::find()
                .filter(docs_nodes::Column::SpaceId.eq(space.id))
                .filter(docs_nodes::Column::Type.eq(node_type))
                .all(&self.db)
                .await
                .map_err(|e| format!("DB scan failed: {e}"))?;
            candidates
                .into_iter()
                .find(|n| sanitize_path_component(&n.title) == title)
        };

        let now = chrono::Utc::now().fixed_offset();
        let updated_id: Uuid = if let Some(node) = existing {
            let id = node.id;
            let mut active: docs_nodes::ActiveModel = node.into();
            active.content = Set(Some(content_value.clone()));
            active.updated_at = Set(now);
            active
                .update(&self.db)
                .await
                .map_err(|e| format!("Failed to update doc_node: {e}"))?;
            info!(slug, title = %title, node_type, "VFS write → updated doc");
            id
        } else {
            let id = Uuid::new_v4();
            let model = docs_nodes::ActiveModel {
                id: Set(id),
                space_id: Set(space.id),
                title: Set(title.clone()),
                r#type: Set(node_type.to_string()),
                content: Set(Some(content_value.clone())),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            };
            docs_nodes::Entity::insert(model)
                .exec(&self.db)
                .await
                .map_err(|e| format!("Failed to create doc_node: {e}"))?;
            info!(slug, title = %title, node_type, "VFS write → created doc");
            id
        };

        // Invalidate the cached Y.Doc so the next collab connection re-seeds
        // from the fresh `content` rather than the stale Y.Doc state.
        if let Err(e) = self.collab.invalidate_room(updated_id, true).await {
            warn!("collab invalidate failed for {updated_id}: {e}");
        }

        // For notion docs: now that we have the node id, enrich each attachment
        // node with content-based MIME detection + create/reuse
        // docs_node_attachments rows so the frontend preview router works
        // (OfficePreview, text viewer with language, etc.). Then re-save.
        if node_type == "notion" {
            self.refine_attachment_mimes(updated_id, &mut content_value).await;
            let update_res = docs_nodes::Entity::update_many()
                .col_expr(docs_nodes::Column::Content, Expr::value(content_value))
                .filter(docs_nodes::Column::Id.eq(updated_id))
                .exec(&self.db)
                .await;
            if let Err(e) = update_res {
                warn!("failed to save refined attachment content for {updated_id}: {e}");
            } else {
                // Invalidate again so the second update is picked up.
                if let Err(e) = self.collab.invalidate_room(updated_id, true).await {
                    warn!("collab invalidate (refine) failed for {updated_id}: {e}");
                }
            }
        }

        Ok(())
    }

    async fn on_file_deleted(&self, relative_path: &str) -> Result<(), String> {
        // Intentionally a no-op for docs nodes.
        //
        // Editors like vim save files via an unlink-then-rewrite (or
        // rename-over) pattern, which would otherwise be interpreted as
        // "delete node, then create a new node with a new UUID". That breaks
        // any frontend holding the old node id (Yjs collab WS would return
        // `node not found`).
        //
        // Doc deletion must go through the API (`DELETE /api/apps/docs/nodes/{id}`);
        // the subsequent write (if any) will update the existing node in place.
        let _ = relative_path;
        Ok(())
    }
}
