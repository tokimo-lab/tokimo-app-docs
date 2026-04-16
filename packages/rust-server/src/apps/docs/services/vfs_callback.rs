//! Callback that reacts to VFS writes on a DocSpace FUSE mount.
//!
//! When a markdown file is written via VFS/FUSE, this callback updates
//! (or creates) the corresponding `doc_nodes` record in the database.
//! Notion documents are read-only through VFS — only markdown-type documents
//! are written back.

use sea_orm::*;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::db::entities::doc_nodes;
use crate::services::media::source::storage_driver::WriteCallback;

/// Callback attached to a DocSpace's FUSE mount.
///
/// Receives VFS write events and translates them to doc_nodes DB operations.
/// The `relative_path` parameter is relative to the space root in storage
/// (e.g., `my-doc.md` or `folder/note.md`).
pub struct DocSpaceWriteCallback {
    db: DatabaseConnection,
    space_id: Uuid,
}

impl DocSpaceWriteCallback {
    pub fn new(db: DatabaseConnection, space_id: Uuid) -> Self {
        Self { db, space_id }
    }

    /// Find a markdown doc_node by title within this space.
    async fn find_markdown_node_by_title(&self, title: &str) -> Result<Option<doc_nodes::Model>, DbErr> {
        doc_nodes::Entity::find()
            .filter(doc_nodes::Column::SpaceId.eq(self.space_id))
            .filter(doc_nodes::Column::Type.eq("markdown"))
            .filter(doc_nodes::Column::Title.eq(title))
            .one(&self.db)
            .await
    }
}

#[async_trait::async_trait]
impl WriteCallback for DocSpaceWriteCallback {
    async fn on_file_written(&self, relative_path: &str, content: &[u8]) -> Result<(), String> {
        // Only handle .md files
        let is_md = std::path::Path::new(relative_path)
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("md"));
        if !is_md {
            return Ok(());
        }

        let title = relative_path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or("untitled");

        let md_text = String::from_utf8_lossy(content);

        // Try to find existing markdown node
        match self.find_markdown_node_by_title(title).await {
            Ok(Some(node)) => {
                // Update existing node
                let now = chrono::Utc::now().fixed_offset();
                let mut active: doc_nodes::ActiveModel = node.into();
                active.content = Set(Some(serde_json::Value::String(md_text.into_owned())));
                active.updated_at = Set(now);
                active
                    .update(&self.db)
                    .await
                    .map_err(|e| format!("Failed to update doc_node: {e}"))?;
                info!(space_id = %self.space_id, title, "VFS write → updated markdown doc");
            }
            Ok(None) => {
                // Create new markdown doc_node
                let now = chrono::Utc::now().fixed_offset();
                let id = Uuid::new_v4();
                let model = doc_nodes::ActiveModel {
                    id: Set(id),
                    space_id: Set(self.space_id),
                    title: Set(title.to_string()),
                    r#type: Set("markdown".to_string()),
                    content: Set(Some(serde_json::Value::String(md_text.into_owned()))),
                    created_at: Set(now),
                    updated_at: Set(now),
                    ..Default::default()
                };
                doc_nodes::Entity::insert(model)
                    .exec(&self.db)
                    .await
                    .map_err(|e| format!("Failed to create doc_node: {e}"))?;
                info!(space_id = %self.space_id, title, "VFS write → created markdown doc");
            }
            Err(e) => {
                error!(space_id = %self.space_id, title, "DB lookup failed: {e}");
                return Err(format!("DB lookup failed: {e}"));
            }
        }

        Ok(())
    }

    async fn on_file_deleted(&self, relative_path: &str) -> Result<(), String> {
        let is_md = std::path::Path::new(relative_path)
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("md"));
        if !is_md {
            return Ok(());
        }

        let title = relative_path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or("untitled");

        match self.find_markdown_node_by_title(title).await {
            Ok(Some(node)) => {
                doc_nodes::Entity::delete_by_id(node.id)
                    .exec(&self.db)
                    .await
                    .map_err(|e| format!("Failed to delete doc_node: {e}"))?;
                warn!(space_id = %self.space_id, title, "VFS delete → removed markdown doc");
            }
            Ok(None) => {
                // No matching node — nothing to do
            }
            Err(e) => {
                error!(space_id = %self.space_id, title, "DB lookup for delete failed: {e}");
            }
        }

        Ok(())
    }
}
