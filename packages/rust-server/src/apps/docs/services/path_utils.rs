use std::path::PathBuf;

pub fn normalize_rel_path(path: &str) -> String {
    path.replace('\\', "/").trim_matches('/').to_string()
}

pub fn validate_relative_path(path: &str) -> Result<(), crate::error::AppError> {
    let normalized = normalize_rel_path(path);
    if path.starts_with('/') || path.starts_with('\\') || normalized.split('/').any(|p| p == "..") {
        return Err(crate::error::AppError::BadRequest("invalid relative path".into()));
    }
    Ok(())
}

pub fn vfs_path(root_path: &str, rel_path: &str) -> PathBuf {
    let root = normalize_rel_path(root_path);
    let rel = normalize_rel_path(rel_path);
    let mut s = String::from("/");
    if !root.is_empty() {
        s.push_str(&root);
    }
    if !rel.is_empty() {
        if !s.ends_with('/') {
            s.push('/');
        }
        s.push_str(&rel);
    }
    PathBuf::from(s)
}

pub fn type_for_path(rel_path: &str, is_dir: bool) -> &'static str {
    if is_dir {
        return "folder";
    }
    let name = rel_path.rsplit('/').next().unwrap_or(rel_path).to_ascii_lowercase();
    if std::path::Path::new(&name)
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
    {
        "markdown"
    } else if name.ends_with(".tokimo-doc.json") {
        "notion"
    } else if name.ends_with(".tokimo-sheet.json") {
        "sheet"
    } else if name.ends_with(".tokimo-mind.json") {
        "mind"
    } else if name.ends_with(".tokimo-slide.json") {
        "slide"
    } else if name.ends_with(".tokimo-whiteboard.json") {
        "whiteboard"
    } else if name.ends_with(".tokimo-base.json") {
        "base"
    } else {
        "file"
    }
}

pub fn title_for_path(rel_path: &str, is_dir: bool) -> String {
    let name = rel_path.rsplit('/').next().unwrap_or(rel_path);
    if is_dir {
        return name.to_string();
    }
    for ext in [
        ".tokimo-whiteboard.json",
        ".tokimo-sheet.json",
        ".tokimo-slide.json",
        ".tokimo-base.json",
        ".tokimo-mind.json",
        ".tokimo-doc.json",
        ".md",
    ] {
        if name.to_ascii_lowercase().ends_with(ext) {
            return name[..name.len() - ext.len()].to_string();
        }
    }
    name.rsplit_once('.')
        .map_or_else(|| name.to_string(), |(stem, _)| stem.to_string())
}

pub fn parent_of(rel_path: &str) -> Option<String> {
    let rel_path = normalize_rel_path(rel_path);
    let parent = rel_path.rsplit_once('/')?.0;
    (!parent.is_empty()).then(|| parent.to_string())
}

pub fn extension_for_type(node_type: &str) -> Option<&'static str> {
    match node_type {
        "folder" => None,
        "markdown" => Some(".md"),
        "sheet" => Some(".tokimo-sheet.json"),
        "mind" => Some(".tokimo-mind.json"),
        "slide" => Some(".tokimo-slide.json"),
        "whiteboard" => Some(".tokimo-whiteboard.json"),
        "base" => Some(".tokimo-base.json"),
        _ => Some(".tokimo-doc.json"),
    }
}

pub fn default_content_for_type(node_type: &str, title: &str, content: Option<serde_json::Value>) -> Vec<u8> {
    if let Some(content) = content {
        if node_type == "markdown" {
            return content.as_str().unwrap_or_default().as_bytes().to_vec();
        }
        return serde_json::to_vec_pretty(&content).unwrap_or_else(|_| b"{}".to_vec());
    }
    match node_type {
        "markdown" => format!("# {title}\n").into_bytes(),
        "notion" => br#"[{"type":"p","children":[{"text":""}]}]"#.to_vec(),
        _ => b"{}".to_vec(),
    }
}

pub fn content_from_bytes(node_type: &str, bytes: Vec<u8>) -> Result<serde_json::Value, crate::error::AppError> {
    let text =
        String::from_utf8(bytes).map_err(|e| crate::error::AppError::Internal(format!("file is not utf-8: {e}")))?;
    if node_type == "markdown" || node_type == "file" {
        Ok(serde_json::Value::String(text))
    } else if text.trim().is_empty() {
        Ok(serde_json::json!({}))
    } else {
        Ok(serde_json::from_str(&text)?)
    }
}

pub fn content_to_bytes(node_type: &str, content: &serde_json::Value) -> Result<Vec<u8>, crate::error::AppError> {
    if node_type == "markdown" || node_type == "file" {
        Ok(content.as_str().unwrap_or_default().as_bytes().to_vec())
    } else {
        Ok(serde_json::to_vec_pretty(content)?)
    }
}
