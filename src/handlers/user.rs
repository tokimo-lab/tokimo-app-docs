//! User authentication placeholder for standalone app.

use axum::http::HeaderMap;
use uuid::Uuid;

use crate::error::AppError;

/// Authenticated user info extracted from request headers.
/// In standalone app mode, the user ID is passed via X-User-Id header from the main server.
pub struct AuthUser(pub Uuid);

impl AuthUser {
    /// Extract user from request headers.
    pub fn from_headers(headers: &HeaderMap) -> Result<Self, AppError> {
        let user_id = headers
            .get("X-User-Id")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::BadRequest("missing X-User-Id header".into()))?;
        
        let id = user_id
            .parse::<Uuid>()
            .map_err(|_| AppError::BadRequest("invalid X-User-Id header".into()))?;
        
        Ok(Self(id))
    }
}
