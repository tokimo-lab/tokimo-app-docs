use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::error::AppError;

/// Relative entry from filesystem walk
#[derive(Debug, Clone)]
pub struct RelEntry {
    pub relative_path: String,
    pub is_dir: bool,
    pub modified: Option<chrono::DateTime<chrono::Utc>>,
    pub size: u64,
}

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
        .map_err(|e| AppError::Internal(format!("read {path}: {e}", path = full_path.display())))?;
    let text = String::from_utf8(bytes)
        .map_err(|e| AppError::Internal(format!("file {path} not utf-8: {e}", path = full_path.display())))?;
    if node_type == "markdown" {
        Ok(serde_json::Value::String(text))
    } else {
        serde_json::from_str(&text)
            .map_err(|e| AppError::Internal(format!("parse json {path}: {e}", path = full_path.display())))
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
            .map_err(|e| AppError::Internal(format!("mkdir {path}: {e}", path = parent.display())))?;
    }
    let text = if node_type == "markdown" {
        content.as_str().unwrap_or("").to_string()
    } else {
        serde_json::to_string_pretty(content)?
    };
    tokio::fs::write(full_path, text)
        .await
        .map_err(|e| AppError::Internal(format!("write {path}: {e}", path = full_path.display())))
}

/// Create the filesystem artifact for a newly-created node.
///
/// - `folder`: creates the directory (and parents).
/// - others: creates an empty file with a sensible default (`""` for markdown, `{}` for JSON types).
pub async fn create_node_artifact(full_path: &Path, node_type: &str) -> Result<(), AppError> {
    if node_type == "folder" {
        tokio::fs::create_dir_all(full_path)
            .await
            .map_err(|e| AppError::Internal(format!("mkdir {path}: {e}", path = full_path.display())))?;
    } else {
        if let Some(parent) = full_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Internal(format!("mkdir {path}: {e}", path = parent.display())))?;
        }
        let default = default_content_for_type(node_type);
        tokio::fs::write(full_path, default)
            .await
            .map_err(|e| AppError::Internal(format!("create {path}: {e}", path = full_path.display())))?;
    }
    Ok(())
}

/// Move or rename a node artifact (file or directory).  Parent directories of `to` are created.
pub async fn move_node_artifact(from: &Path, to: &Path) -> Result<(), AppError> {
    if let Some(parent) = to.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Internal(format!("mkdir {path}: {e}", path = parent.display())))?;
    }
    tokio::fs::rename(from, to).await.map_err(|e| {
        AppError::Internal(format!(
            "rename {from_path} → {to_path}: {e}",
            from_path = from.display(),
            to_path = to.display()
        ))
    })
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
            Err(e) => {
                return Err(AppError::Internal(format!(
                    "rmdir {path}: {e}",
                    path = full_path.display()
                )));
            }
        }
    } else {
        match tokio::fs::remove_file(full_path).await {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => {
                return Err(AppError::Internal(format!(
                    "rm {path}: {e}",
                    path = full_path.display()
                )));
            }
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

/// Walk the filesystem tree recursively, returning RelEntry for each file/folder.
/// Skips hidden entries (.xxx), .git, node_modules, and .trash.
pub async fn walk_tree(root: &Path) -> Result<Vec<RelEntry>, AppError> {
    let mut result = Vec::new();
    walk_tree_recursive(root, "", &mut result, false).await?;
    Ok(result)
}

/// Walk .trash folder, returning entries with relative paths starting `.trash/`.
pub async fn walk_trash(root: &Path) -> Result<Vec<RelEntry>, AppError> {
    let trash_dir = root.join(".trash");
    if !trash_dir.exists() {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    walk_tree_recursive(&trash_dir, ".trash", &mut result, true).await?;
    Ok(result)
}

fn path_suffix_eq_ignore_ascii_case(path: &str, suffix: &str) -> bool {
    let Some(name) = path.rsplit(['/', '\\']).next() else {
        return false;
    };
    if name.len() < suffix.len() {
        return false;
    }
    name.as_bytes()
        .get(name.len() - suffix.len()..)
        .is_some_and(|ending| ending.eq_ignore_ascii_case(suffix.as_bytes()))
}

/// Determine node type from file path and is_dir flag.
pub fn type_for_path(rel: &str, is_dir: bool) -> String {
    if is_dir {
        return "folder".to_string();
    }
    if path_suffix_eq_ignore_ascii_case(rel, ".md") {
        "markdown".to_string()
    } else if path_suffix_eq_ignore_ascii_case(rel, ".tknotion.json") {
        "notion".to_string()
    } else if path_suffix_eq_ignore_ascii_case(rel, ".tksheet.json") {
        "sheet".to_string()
    } else if path_suffix_eq_ignore_ascii_case(rel, ".tkmind.json") {
        "mind".to_string()
    } else if path_suffix_eq_ignore_ascii_case(rel, ".tkslide.json") {
        "slide".to_string()
    } else if path_suffix_eq_ignore_ascii_case(rel, ".tkwhiteboard.json") {
        "whiteboard".to_string()
    } else if path_suffix_eq_ignore_ascii_case(rel, ".tkbase.json") {
        "base".to_string()
    } else if path_suffix_eq_ignore_ascii_case(rel, ".tkform.json") {
        "form".to_string()
    } else {
        "unknown".to_string()
    }
}

/// Extract title from relative path (remove extension, take basename).
pub fn title_for_path(rel: &str, is_dir: bool) -> String {
    let name = rel.rsplit('/').next().unwrap_or(rel);
    if is_dir {
        return name.to_string();
    }
    // Remove known compound extensions first, then any generic extension
    let stem = name
        .strip_suffix(".tknotion.json")
        .or_else(|| name.strip_suffix(".tksheet.json"))
        .or_else(|| name.strip_suffix(".tkmind.json"))
        .or_else(|| name.strip_suffix(".tkslide.json"))
        .or_else(|| name.strip_suffix(".tkwhiteboard.json"))
        .or_else(|| name.strip_suffix(".tkbase.json"))
        .or_else(|| name.strip_suffix(".tkform.json"))
        .unwrap_or(name);
    // If no compound extension matched, strip generic extension (last . suffix)
    if let Some(dot_pos) = stem.rfind('.') {
        stem[..dot_pos].to_string()
    } else {
        stem.to_string()
    }
}

/// Compute parent relative path (directory containing this path).
pub fn parent_of(path: &str) -> Option<String> {
    if path.is_empty() || !path.contains('/') {
        return None;
    }
    let parent = path.rsplit_once('/')?.0;
    if parent.is_empty() {
        None
    } else {
        Some(parent.to_string())
    }
}

/// Return default content for a newly created node of given type.
pub fn default_content_for_type(node_type: &str) -> &'static str {
    if node_type == "markdown" { "" } else { "{}" }
}

/// Recursive helper for walk_tree/walk_trash.
fn walk_tree_recursive<'a>(
    dir: &'a Path,
    prefix: &'a str,
    result: &'a mut Vec<RelEntry>,
    allow_trash: bool,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), AppError>> + Send + 'a>> {
    Box::pin(async move {
        let mut entries = tokio::fs::read_dir(dir)
            .await
            .map_err(|e| AppError::Internal(format!("read_dir {path}: {e}", path = dir.display())))?;
        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| AppError::Internal(format!("next_entry: {e}")))?
        {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with('.') && (!allow_trash || name_str != ".trash") {
                continue;
            }
            if name_str == ".git" || name_str == "node_modules" {
                continue;
            }
            if name_str == ".trash" && !allow_trash {
                continue;
            }
            let meta = entry
                .metadata()
                .await
                .map_err(|e| AppError::Internal(format!("metadata: {e}")))?;
            let is_dir = meta.is_dir();
            let modified = meta.modified().ok().map(chrono::DateTime::<chrono::Utc>::from);
            let size = if is_dir { 0 } else { meta.len() };
            let rel = if prefix.is_empty() {
                name_str.to_string()
            } else {
                format!("{prefix}/{name_str}")
            };
            let rel_normalized = rel.replace('\\', "/");
            result.push(RelEntry {
                relative_path: rel_normalized.clone(),
                is_dir,
                modified,
                size,
            });
            if is_dir && (allow_trash || !name_str.starts_with('.')) {
                walk_tree_recursive(&entry.path(), &rel_normalized, result, allow_trash).await?;
            }
        }
        Ok(())
    })
}
