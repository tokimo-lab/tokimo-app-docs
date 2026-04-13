pub mod base_meta;
pub mod base_records;
pub mod browse;
pub mod collab;
pub mod comments;
pub mod crud;
pub mod space;
pub mod versions;
pub mod view_state;
pub mod whiteboard_library;

use crate::error::AppError;
use uuid::Uuid;

pub fn parse_uuid(s: &str) -> Result<Uuid, AppError> {
    s.parse::<Uuid>()
        .map_err(|_| AppError::BadRequest(format!("invalid uuid: {s}")))
}

/// Characters forbidden in node names (Windows + Linux union).
const FORBIDDEN_CHARS: &[char] = &['\\', '/', ':', '*', '?', '"', '<', '>', '|'];

/// Validate a node name for filesystem-compatible rules.
pub fn validate_node_name(name: &str) -> Result<(), AppError> {
    if name.is_empty() {
        return Err(AppError::BadRequest("node name cannot be empty".into()));
    }
    if name.len() > 255 {
        return Err(AppError::BadRequest(
            "node name too long (max 255 chars)".into(),
        ));
    }
    if let Some(ch) = name.chars().find(|c| FORBIDDEN_CHARS.contains(c)) {
        return Err(AppError::BadRequest(format!(
            "node name contains forbidden character: {ch}"
        )));
    }
    if name.starts_with('.') || name.ends_with('.') {
        return Err(AppError::BadRequest(
            "node name cannot start or end with a dot".into(),
        ));
    }
    if name != name.trim() {
        return Err(AppError::BadRequest(
            "node name cannot have leading or trailing spaces".into(),
        ));
    }
    Ok(())
}
