//! User authentication placeholder for standalone app.

use axum::{
    Json,
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
};
use uuid::Uuid;

/// Authenticated user info extracted from request headers.
/// In standalone app mode, the user ID is passed via X-User-Id header from the main server.
pub struct AuthUser(pub Uuid);

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user_id = parts
            .headers
            .get("X-User-Id")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({"error": "missing X-User-Id header"})),
                )
            })?;

        let id = user_id.parse::<Uuid>().map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "invalid X-User-Id header"})),
            )
        })?;

        Ok(Self(id))
    }
}
