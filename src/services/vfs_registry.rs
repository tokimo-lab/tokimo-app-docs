//! VFS registry for the docs app.

use std::collections::HashMap;
use std::sync::Arc;
use tokimo_vfs::Vfs;
use tokio::sync::RwLock;

/// Registry for managing VFS instances.
pub struct VfsRegistry {
    vfs_instances: RwLock<HashMap<String, Arc<Vfs>>>,
}

impl Default for VfsRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl VfsRegistry {
    pub fn new() -> Self {
        Self {
            vfs_instances: RwLock::new(HashMap::new()),
        }
    }

    /// Ensure a VFS instance exists for the given source ID.
    pub async fn ensure_vfs(&self, source_id: &str) -> Result<Arc<Vfs>, String> {
        let instances = self.vfs_instances.read().await;
        if let Some(vfs) = instances.get(source_id) {
            return Ok(Arc::clone(vfs));
        }
        drop(instances);

        // Create a new VFS instance if it doesn't exist
        // In a real implementation, this would create a VFS based on the source configuration
        Err(format!("VFS not found for source: {}", source_id))
    }

    /// Register a VFS instance for a source.
    pub async fn register(&self, source_id: String, vfs: Arc<Vfs>) {
        let mut instances = self.vfs_instances.write().await;
        instances.insert(source_id, vfs);
    }
}
