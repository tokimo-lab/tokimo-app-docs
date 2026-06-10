//! Source storage driver placeholder.

/// Callback trait for VFS file operations.
#[async_trait::async_trait]
pub trait WriteCallback: Send + Sync {
    /// Called when a file is written.
    async fn on_file_written(&self, relative_path: &str, content: &[u8]) -> Result<(), String>;

    /// Called when a file is deleted.
    async fn on_file_deleted(&self, relative_path: &str) -> Result<(), String>;
}

pub mod storage_driver {
    pub use super::WriteCallback;
}
