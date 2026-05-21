//! Callback that reacts to VFS writes on the docs mount at `/mnt/docs`.
//!
//! VFS write routing used to resolve spaces by slug. Slug-based routing has been
//! removed, so writes are currently accepted as a no-op until replacement routing
//! is implemented.

use std::sync::Arc;

use sea_orm::DatabaseConnection;

use crate::apps::docs::services::collab::CollabService;
use crate::services::source::storage_driver::WriteCallback;
use crate::services::storage::StorageProvider;

/// Callback attached to the docs VFS mount.
pub struct DocSpaceWriteCallback;

impl DocSpaceWriteCallback {
    pub fn new(_db: DatabaseConnection, _collab: Arc<CollabService>, _storage: Arc<dyn StorageProvider>) -> Self {
        Self
    }

    /// Extract space key and remaining file path.
    fn parse_path(relative_path: &str) -> Option<(&str, &str)> {
        let path = relative_path.trim_start_matches('/');
        let (space_key, rest) = path.split_once('/')?;
        if space_key.is_empty() || rest.is_empty() {
            return None;
        }
        Some((space_key, rest))
    }
}

#[async_trait::async_trait]
impl WriteCallback for DocSpaceWriteCallback {
    async fn on_file_written(&self, relative_path: &str, _content: &[u8]) -> Result<(), String> {
        let Some((_space_key, _file_path)) = Self::parse_path(relative_path) else {
            return Ok(());
        };
        // VFS write routing removed with slug field; no-op until replacement routing is implemented.
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
