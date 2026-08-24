//! User authentication placeholder for standalone app.

use axum::{
    Json,
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
};
use uuid::Uuid;

/// Authenticated user info extracted from request headers.
/// In standalone app mode, the main server injects the trusted user ID header.
pub struct AuthUser(pub Uuid);

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user_id = parts
            .headers
            .get("x-tokimo-user-id")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({"error": "missing x-tokimo-user-id header"})),
                )
            })?;

        let id = user_id.parse::<Uuid>().map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "invalid x-tokimo-user-id header"})),
            )
        })?;

        Ok(Self(id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request;

    #[tokio::test]
    async fn extracts_host_injected_user_header() {
        let id = Uuid::new_v4();
        let request = Request::builder()
            .header("x-tokimo-user-id", id.to_string())
            .body(())
            .unwrap();
        let (mut parts, _) = request.into_parts();

        let user = match AuthUser::from_request_parts(&mut parts, &()).await {
            Ok(user) => user,
            Err(_) => panic!("expected trusted user header to be accepted"),
        };

        assert_eq!(user.0, id);
    }
}
