use axum::{
    routing::{get, patch, post},
    Router,
};
use std::sync::Arc;

use crate::apps::docs::handlers::{browse, collab, comments, crud, versions};
use crate::AppState;

pub fn build_docs_app_routes() -> Router<Arc<AppState>> {
    Router::new()
        // App-scoped routes
        .route(
            "/api/apps/{id}/docs/nodes",
            get(browse::list_nodes).post(crud::create_node),
        )
        .route(
            "/api/apps/{id}/docs/nodes/tags",
            get(browse::list_node_tags),
        )
        // Node-level routes
        .route(
            "/api/apps/docs/nodes/{id}",
            get(crud::get_node)
                .patch(crud::update_node)
                .delete(crud::archive_node),
        )
        .route(
            "/api/apps/docs/nodes/{id}/restore",
            patch(crud::restore_node),
        )
        .route(
            "/api/apps/docs/nodes/{id}/permanent",
            axum::routing::delete(crud::delete_node),
        )
        .route(
            "/api/apps/docs/nodes/{id}/favorite",
            patch(browse::toggle_favorite),
        )
        .route(
            "/api/apps/docs/nodes/{id}/pin",
            patch(browse::toggle_pin),
        )
        .route(
            "/api/apps/docs/nodes/{id}/move",
            patch(crud::move_node),
        )
        // Version routes
        .route(
            "/api/apps/docs/nodes/{id}/versions",
            get(versions::list_versions),
        )
        .route(
            "/api/apps/docs/node-versions/{id}",
            get(versions::get_version),
        )
        .route(
            "/api/apps/docs/nodes/{id}/versions/{version_id}/restore",
            post(versions::restore_version),
        )
        // Comment routes
        .route(
            "/api/apps/docs/nodes/{id}/comments",
            get(comments::list_comments).post(comments::create_comment),
        )
        .route(
            "/api/apps/docs/node-comments/{id}/resolve",
            patch(comments::resolve_comment),
        )
        .route(
            "/api/apps/docs/node-comments/{id}",
            axum::routing::delete(comments::delete_comment),
        )
        // Collab WebSocket route
        .route(
            "/api/apps/docs/collab/{node_id}",
            get(collab::collab_ws),
        )
}
