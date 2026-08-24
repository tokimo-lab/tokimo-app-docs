//! VFS registry for the docs app.

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use tokimo_bus_client::BusClient;
use tokimo_vfs::{Driver, DriverRegistry, StorageManager, StorageMount, Vfs};
use tokio::sync::RwLock;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DriverConfig {
    driver_name: String,
    config: serde_json::Value,
}

/// Registry for managing VFS instances.
pub struct VfsRegistry {
    client: Arc<OnceLock<Arc<BusClient>>>,
    vfs_instances: RwLock<HashMap<String, Arc<Vfs>>>,
}

impl VfsRegistry {
    pub fn new(client: Arc<OnceLock<Arc<BusClient>>>) -> Self {
        Self {
            client,
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

        let vfs = self.load_vfs(source_id).await?;
        let mut instances = self.vfs_instances.write().await;
        Ok(Arc::clone(instances.entry(source_id.to_owned()).or_insert(vfs)))
    }

    /// Register a VFS instance for a source.
    pub async fn register(&self, source_id: String, vfs: Arc<Vfs>) {
        let mut instances = self.vfs_instances.write().await;
        instances.insert(source_id, vfs);
    }

    async fn load_vfs(&self, source_id: &str) -> Result<Arc<Vfs>, String> {
        let client = self.client.get().ok_or_else(|| "bus client is not ready".to_owned())?;
        let payload = serde_json::to_vec(&serde_json::json!({ "sourceId": source_id }))
            .map_err(|err| format!("encode VFS request: {err}"))?;
        let response = client
            .invoke("vfs", "get_driver_config", payload, client.auto_caller("docs"))
            .await
            .map_err(|err| format!("load VFS config: {err}"))?;
        let config: DriverConfig =
            serde_json::from_slice(&response).map_err(|err| format!("decode VFS config: {err}"))?;

        let driver = DriverRegistry::new()
            .create(&config.driver_name, &config.config)
            .map_err(|err| format!("create VFS driver: {err}"))?;
        let driver: Arc<dyn Driver> = Arc::from(driver);
        driver
            .init()
            .await
            .map_err(|err| format!("initialize VFS driver: {err}"))?;

        let storage = StorageManager::new();
        storage.mount(StorageMount::new("/", driver)).await;
        Ok(Arc::new(Vfs::new(storage)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn driver_config_decodes_bus_response() {
        let config: DriverConfig = serde_json::from_value(serde_json::json!({
            "driverName": "local",
            "config": { "root_folder_path": "/tmp/docs" }
        }))
        .unwrap();

        assert_eq!(config.driver_name, "local");
        assert_eq!(config.config["root_folder_path"], "/tmp/docs");
    }

    #[tokio::test]
    async fn cache_miss_reports_when_bus_is_not_ready() {
        let registry = VfsRegistry::new(Arc::new(OnceLock::new()));

        let error = match registry.ensure_vfs("source-id").await {
            Ok(_) => panic!("expected cache miss to fail before the bus client is ready"),
            Err(error) => error,
        };

        assert_eq!(error, "bus client is not ready");
    }
}
