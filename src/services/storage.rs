//! Storage provider abstraction for docs app.

use std::path::Path;
use async_trait::async_trait;

use crate::error::AppError;

/// Options for uploading files.
pub struct UploadOptions {
    pub content_type: Option<String>,
    pub overwrite: bool,
}

/// Trait for storage providers.
#[async_trait]
pub trait StorageProvider: Send + Sync {
    /// Read a file from storage.
    async fn read(&self, path: &Path) -> Result<Vec<u8>, AppError>;
    
    /// Write a file to storage.
    async fn write(&self, path: &Path, content: &[u8], options: UploadOptions) -> Result<(), AppError>;
    
    /// Delete a file from storage.
    async fn delete(&self, path: &Path) -> Result<(), AppError>;
    
    /// Check if a file exists in storage.
    async fn exists(&self, path: &Path) -> Result<bool, AppError>;
    
    /// Upload a file to storage.
    async fn upload(&self, path: &Path, content: &[u8], content_type: Option<String>) -> Result<(), AppError> {
        self.write(path, content, UploadOptions {
            content_type,
            overwrite: true,
        }).await
    }
}
