use axum::{
    routing::{get, patch, post},
    Router,
};
use std::sync::Arc;

use super::handlers;
use crate::AppState;

pub fn build_docs_app_routes() -> Router<Arc<AppState>> {
    Router::new()
        // App-scoped routes
        .route(
            "/api/apps/{id}/docs/nodes",
            get(handlers::list_nodes).post(handlers::create_node),
        )
        .route(
            "/api/apps/{id}/docs/nodes/tags",
            get(handlers::list_node_tags),
        )
        // Node-level routes
        .route(
            "/api/apps/docs/nodes/{id}",
            get(handlers::get_node)
                .patch(handlers::update_node)
                .delete(handlers::archive_node),
        )
        .route(
            "/api/apps/docs/nodes/{id}/restore",
            patch(handlers::restore_node),
        )
        .route(
            "/api/apps/docs/nodes/{id}/permanent",
            axum::routing::delete(handlers::delete_node),
        )
        .route(
            "/api/apps/docs/nodes/{id}/favorite",
            patch(handlers::toggle_favorite),
        )
        .route(
            "/api/apps/docs/nodes/{id}/pin",
            patch(handlers::toggle_pin),
        )
        .route(
            "/api/apps/docs/nodes/{id}/move",
            patch(handlers::move_node),
        )
        // Version routes
        .route(
            "/api/apps/docs/nodes/{id}/versions",
            get(handlers::list_versions),
        )
        .route(
            "/api/apps/docs/node-versions/{id}",
            get(handlers::get_version),
        )
        .route(
            "/api/apps/docs/nodes/{id}/versions/{version_id}/restore",
            post(handlers::restore_version),
        )
        // Comment routes
        .route(
            "/api/apps/docs/nodes/{id}/comments",
            get(handlers::list_comments).post(handlers::create_comment),
        )
        .route(
            "/api/apps/docs/node-comments/{id}/resolve",
            patch(handlers::resolve_comment),
        )
        .route(
            "/api/apps/docs/node-comments/{id}",
            axum::routing::delete(handlers::delete_comment),
        )
        // Collab WebSocket
        .route(
            "/api/apps/docs/collab/{node_id}",
            get(handlers::collab::collab_ws),
        )
}
