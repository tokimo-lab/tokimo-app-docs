use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::error::AppError;

/// Map node type → file extension.  `None` means folder (directory, no file).
pub fn ext_for_type(node_type: &str) -> Option<&'static str> {
    match node_type {
        "folder" => None,
        "markdown" => Some(".md"),
        "notion" => Some(".tknotion.json"),
        "sheet" => Some(".tksheet.json"),
        "mind" => Some(".tkmind.json"),
        "slide" => Some(".tkslide.json"),
        "whiteboard" => Some(".tkwhiteboard.json"),
        "base" => Some(".tkbase.json"),
        "form" => Some(".tkform.json"),
        _ => Some(".json"),
    }
}

/// Resolve the physical path: `space_root` + `/` + `relative_path`.
pub fn resolve_path(space_root: &str, relative_path: &str) -> PathBuf {
    PathBuf::from(space_root).join(relative_path)
}

/// Compute `relative_path` for a node (includes the file extension, or none for folders).
///
/// `parent_relative` is the parent folder's relative_path (folder has no extension).
/// For example:
/// - folder at root: `"工作笔记"`
/// - markdown under that folder: `"工作笔记/2025规划.md"`
pub fn compute_relative_path(parent_relative: Option<&str>, title: &str, node_type: &str) -> String {
    let stem = match parent_relative {
        Some(p) if !p.is_empty() => format!("{p}/{title}"),
        _ => title.to_string(),
    };
    match ext_for_type(node_type) {
        Some(ext) => format!("{stem}{ext}"),
        None => stem,
    }
}

/// Rebase a `relative_path` from `old_prefix` to `new_prefix`.
///
/// Used when a folder is renamed or moved: all its descendants need their paths updated.
pub fn rebase_path(old_prefix: &str, new_prefix: &str, path: &str) -> String {
    if let Some(rest) = path.strip_prefix(old_prefix) {
        format!("{new_prefix}{rest}")
    } else {
        path.to_string()
    }
}

/// Return a title that doesn't collide with any existing sibling title.
///
/// If `base` is taken, tries `"base (2)"`, `"base (3)"`, etc.
pub fn unique_title<S: ::std::hash::BuildHasher>(base: &str, existing: &HashSet<String, S>) -> String {
    if !existing.contains(base) {
        return base.to_string();
    }
    let mut n = 2u32;
    loop {
        let candidate = format!("{base} ({n})");
        if !existing.contains(&candidate) {
            return candidate;
        }
        n += 1;
    }
}

/// Read a node's file content as a JSON `Value`.
///
/// - `markdown` → `Value::String(file_text)`
/// - others → parsed JSON
pub async fn read_node_file(full_path: &Path, node_type: &str) -> Result<serde_json::Value, AppError> {
    let bytes = tokio::fs::read(full_path)
        .await
        .map_err(|e| AppError::Internal(format!("read {}: {e}", full_path.display())))?;
    let text = String::from_utf8(bytes)
        .map_err(|e| AppError::Internal(format!("file {} not utf-8: {e}", full_path.display())))?;
    if node_type == "markdown" {
        Ok(serde_json::Value::String(text))
    } else {
        serde_json::from_str(&text).map_err(|e| AppError::Internal(format!("parse json {}: {e}", full_path.display())))
    }
}

/// Write `content` to `full_path`.
///
/// - `markdown`: extracts the string value and writes as plain text.
/// - others: serialises as pretty-printed JSON.
///
/// Parent directories are created automatically.
pub async fn write_node_file(full_path: &Path, node_type: &str, content: &serde_json::Value) -> Result<(), AppError> {
    if let Some(parent) = full_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Internal(format!("mkdir {}: {e}", parent.display())))?;
    }
    let text = if node_type == "markdown" {
        content.as_str().unwrap_or("").to_string()
    } else {
        serde_json::to_string_pretty(content)?
    };
    tokio::fs::write(full_path, text)
        .await
        .map_err(|e| AppError::Internal(format!("write {}: {e}", full_path.display())))
}

/// Create the filesystem artifact for a newly-created node.
///
/// - `folder`: creates the directory (and parents).
/// - others: creates an empty file with a sensible default (`""` for markdown, `[]` for JSON types).
pub async fn create_node_artifact(full_path: &Path, node_type: &str) -> Result<(), AppError> {
    if node_type == "folder" {
        tokio::fs::create_dir_all(full_path)
            .await
            .map_err(|e| AppError::Internal(format!("mkdir {}: {e}", full_path.display())))?;
    } else {
        if let Some(parent) = full_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Internal(format!("mkdir {}: {e}", parent.display())))?;
        }
        let default = if node_type == "markdown" { "" } else { "[]" };
        tokio::fs::write(full_path, default)
            .await
            .map_err(|e| AppError::Internal(format!("create {}: {e}", full_path.display())))?;
    }
    Ok(())
}

/// Move or rename a node artifact (file or directory).  Parent directories of `to` are created.
pub async fn move_node_artifact(from: &Path, to: &Path) -> Result<(), AppError> {
    if let Some(parent) = to.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Internal(format!("mkdir {}: {e}", parent.display())))?;
    }
    tokio::fs::rename(from, to)
        .await
        .map_err(|e| AppError::Internal(format!("rename {} → {}: {e}", from.display(), to.display())))
}

/// Delete a node artifact.
///
/// - `folder`: recursive directory removal.
/// - others: single file removal.
///
/// Missing-file errors are silently ignored (idempotent).
pub async fn delete_node_artifact(full_path: &Path, node_type: &str) -> Result<(), AppError> {
    if node_type == "folder" {
        match tokio::fs::remove_dir_all(full_path).await {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(AppError::Internal(format!("rmdir {}: {e}", full_path.display()))),
        }
    } else {
        match tokio::fs::remove_file(full_path).await {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(AppError::Internal(format!("rm {}: {e}", full_path.display()))),
        }
    }
    Ok(())
}

/// Sanitize a string for use as a filesystem path component.
///
/// Replaces chars forbidden on Windows + Linux with `_`, trims whitespace and leading/trailing dots.
pub fn sanitize_path_component(name: &str) -> String {
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
