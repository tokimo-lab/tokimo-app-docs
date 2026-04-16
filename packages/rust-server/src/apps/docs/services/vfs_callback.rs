//! Callback that reacts to VFS writes on the docs FUSE mount at `/mnt/docs`.
//!
//! When a markdown file is written via VFS/FUSE, this callback resolves the
//! target space from the slug directory in the path, then updates (or creates)
//! the corresponding `doc_nodes` record in the database.

use sea_orm::*;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::db::entities::{doc_nodes, doc_spaces};
use crate::services::media::source::storage_driver::WriteCallback;

/// Callback attached to the docs FUSE mount.
///
/// Receives VFS write events and translates them to doc_nodes DB operations.
/// The `relative_path` is relative to the `docs-md/` S3 prefix, so it looks
/// like `{slug}/my-doc.md` or `{slug}/folder/note.md`.
pub struct DocSpaceWriteCallback {
    db: DatabaseConnection,
}

impl DocSpaceWriteCallback {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Extract slug and file path from a relative path like `{slug}/file.md`.
    fn parse_path(relative_path: &str) -> Option<(&str, &str)> {
        let path = relative_path.trim_start_matches('/');
        let (slug, rest) = path.split_once('/')?;
        if slug.is_empty() || rest.is_empty() {
            return None;
        }
        Some((slug, rest))
    }

    /// Resolve a space by slug.
    async fn find_space_by_slug(
        &self,
        slug: &str,
    ) -> Result<Option<doc_spaces::Model>, DbErr> {
        doc_spaces::Entity::find()
            .filter(doc_spaces::Column::Slug.eq(slug))
            .one(&self.db)
            .await
    }

    /// Find a markdown doc_node by title within a space.
    async fn find_markdown_node_by_title(
        &self,
        space_id: Uuid,
        title: &str,
    ) -> Result<Option<doc_nodes::Model>, DbErr> {
        doc_nodes::Entity::find()
            .filter(doc_nodes::Column::SpaceId.eq(space_id))
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

        let Some((slug, file_path)) = Self::parse_path(relative_path) else {
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

        let title = file_path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or("untitled");

        let md_text = String::from_utf8_lossy(content);

        match self.find_markdown_node_by_title(space.id, title).await {
            Ok(Some(node)) => {
                let now = chrono::Utc::now().fixed_offset();
                let mut active: doc_nodes::ActiveModel = node.into();
                active.content = Set(Some(serde_json::Value::String(md_text.into_owned())));
                active.updated_at = Set(now);
                active
                    .update(&self.db)
                    .await
                    .map_err(|e| format!("Failed to update doc_node: {e}"))?;
                info!(slug, title, "VFS write → updated markdown doc");
            }
            Ok(None) => {
                let now = chrono::Utc::now().fixed_offset();
                let id = Uuid::new_v4();
                let model = doc_nodes::ActiveModel {
                    id: Set(id),
                    space_id: Set(space.id),
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
                info!(slug, title, "VFS write → created markdown doc");
            }
            Err(e) => {
                error!(slug, title, "DB lookup failed: {e}");
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

        let Some((slug, file_path)) = Self::parse_path(relative_path) else {
            return Ok(());
        };

        let space = self
            .find_space_by_slug(slug)
            .await
            .map_err(|e| format!("Failed to find space by slug '{slug}': {e}"))?;
        let Some(space) = space else {
            return Ok(());
        };

        let title = file_path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or("untitled");

        match self.find_markdown_node_by_title(space.id, title).await {
            Ok(Some(node)) => {
                doc_nodes::Entity::delete_by_id(node.id)
                    .exec(&self.db)
                    .await
                    .map_err(|e| format!("Failed to delete doc_node: {e}"))?;
                warn!(slug, title, "VFS delete → removed markdown doc");
            }
            Ok(None) => {}
            Err(e) => {
                error!(slug, title, "DB lookup for delete failed: {e}");
            }
        }

        Ok(())
    }
}
