use axum::{
    Router,
    routing::{get, patch, post},
};
use std::sync::Arc;

use crate::AppState;
use crate::apps::docs::handlers::{
    attachment, base_meta, base_records, browse, collab, comments, crud, space, versions, view_state,
    whiteboard_library,
};

pub fn build_docs_app_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Space CRUD routes
        .route(
            "/api/apps/docs/spaces",
            get(space::list_spaces).post(space::create_space),
        )
        .route(
            "/api/apps/docs/spaces/{id}",
            patch(space::update_space).delete(space::delete_space),
        )
        // Space-scoped node routes
        .route(
            "/api/apps/docs/spaces/{id}/nodes",
            get(browse::list_nodes).post(crud::create_node),
        )
        .route(
            "/api/apps/docs/spaces/{id}/nodes/tags",
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
        // Whiteboard library routes
        .route(
            "/api/apps/docs/whiteboard/libraries",
            get(whiteboard_library::list_libraries),
        )
        .route(
            "/api/apps/docs/whiteboard/libraries/{id}/download",
            get(whiteboard_library::download_library),
        )
        .route(
            "/api/apps/docs/whiteboard/libraries/{id}/preview",
            get(whiteboard_library::preview_library),
        )
        .route(
            "/api/apps/docs/whiteboard/user-library",
            get(whiteboard_library::get_user_library).put(whiteboard_library::save_user_library),
        )
        // View state routes (per-user viewport persistence)
        .route(
            "/api/apps/docs/nodes/{id}/view-state",
            get(view_state::get_view_state).put(view_state::put_view_state),
        )
        // ── Base (bitable) routes ─────────────────────────────────────────
        .route(
            "/api/apps/docs/base/{nodeId}",
            get(base_meta::get_base_meta).patch(base_meta::update_base_meta),
        )
        .route(
            "/api/apps/docs/base/{nodeId}/records",
            get(base_records::list_records).post(base_records::create_record),
        )
        .route(
            "/api/apps/docs/base/records/{recordId}",
            patch(base_records::update_record).delete(base_records::delete_record),
        )
        .route(
            "/api/apps/docs/base/{nodeId}/records/batch-delete",
            post(base_records::batch_delete_records),
        )
        // Attachment routes
        .route(
            "/api/apps/docs/nodes/{id}/attachments/upload",
            post(attachment::upload_attachment),
        )
        .route(
            "/api/apps/docs/nodes/{id}/attachments",
            get(attachment::list_attachments),
        )
        .route(
            "/api/apps/docs/attachments/{id}",
            axum::routing::delete(attachment::delete_attachment),
        )
        .route(
            "/api/apps/docs/attachments/{id}/restore",
            post(attachment::restore_attachment),
        )
}
