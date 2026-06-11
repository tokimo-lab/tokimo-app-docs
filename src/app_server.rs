//! Embedded axum HTTP server, listening on a local socket.
//!
//! Route layout (server-side `/api/apps/docs/<rest>` proxies to this sock's `/<rest>`):
//! - All doc CRUD routes (spaces, nodes, comments, attachments, collab, whiteboard)
//! - `GET /assets/{*path}` → static assets
//!
//! Single sock serves control plane + data plane + assets; server side only needs one proxy rule.

use std::sync::Arc;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{delete, get, patch, post},
};
use tokimo_bus_protocol::{BusListener, DataPlaneSocket};
use tracing::{error, info};

use crate::{assets, handlers::AppCtx};
use crate::handlers::{
    attachment, base_meta, base_records, browse, collab, comments, crud, space, versions,
    view_ctx, whiteboard_library,
};

/// Start axum server on local socket, return `DataPlaneSocket` for broker registration.
pub async fn spawn(service: &str, ctx: Arc<AppCtx>) -> anyhow::Result<DataPlaneSocket> {
    let (listener, socket) = BusListener::bind_for_app(service)?;
    info!(?socket, "docs: app server listening");

    let app_router = build_router(ctx);

    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app_router).await {
            error!(error = %e, "docs: app server stopped");
        }
    });

    Ok(socket)
}

fn build_router(ctx: Arc<AppCtx>) -> Router {
    Router::new()
        // ── Spaces ──────────────────────────────────────────────
        .route(
            "/spaces",
            get(space::list_spaces).post(space::create_space),
        )
        .route(
            "/spaces/{id}",
            patch(space::update_space).delete(space::delete_space),
        )
        // ── Nodes CRUD ──────────────────────────────────────────
        .route(
            "/spaces/{id}/nodes",
            get(browse::list_nodes).post(crud::create_node),
        )
        .route("/spaces/{id}/nodes/tags", get(browse::list_node_tags))
        .route(
            "/spaces/{id}/node",
            get(crud::get_node)
                .patch(crud::update_node)
                .delete(crud::archive_node),
        )
        .route("/spaces/{id}/node/restore", patch(crud::restore_node))
        .route("/spaces/{id}/node/permanent", delete(crud::delete_node))
        .route(
            "/spaces/{id}/node/favorite",
            patch(browse::toggle_favorite),
        )
        .route("/spaces/{id}/node/pin", patch(browse::toggle_pin))
        .route("/spaces/{id}/node/move", patch(crud::move_node))
        // ── Versions ────────────────────────────────────────────
        .route("/spaces/{id}/node/versions", get(versions::list_versions))
        .route(
            "/spaces/{id}/node/version/{versionId}",
            get(versions::get_version),
        )
        .route(
            "/spaces/{id}/node/version/{versionId}/restore",
            post(versions::restore_version),
        )
        // ── Comments ────────────────────────────────────────────
        .route(
            "/spaces/{id}/node/comments",
            get(comments::list_comments).post(comments::create_comment),
        )
        .route(
            "/spaces/{id}/node/comment/{commentId}/resolve",
            patch(comments::resolve_comment),
        )
        .route(
            "/spaces/{id}/node/comment/{commentId}",
            delete(comments::delete_comment),
        )
        // ── Attachments ─────────────────────────────────────────
        .route(
            "/spaces/{id}/node/attachments",
            get(attachment::list_attachments)
                .post(attachment::upload_attachment)
                .layer(DefaultBodyLimit::disable()),
        )
        .route(
            "/spaces/{id}/attachments/{attachmentId}",
            delete(attachment::delete_attachment),
        )
        .route(
            "/spaces/{id}/attachments/{attachmentId}/restore",
            post(attachment::restore_attachment),
        )
        // ── View context ────────────────────────────────────────
        .route(
            "/spaces/{id}/node/view-ctx",
            get(view_ctx::get_view_ctx).put(view_ctx::put_view_ctx),
        )
        // ── Base (spreadsheet) ──────────────────────────────────
        .route(
            "/spaces/{id}/base",
            get(base_meta::get_base_meta).patch(base_meta::update_base_meta),
        )
        .route(
            "/spaces/{id}/base/records",
            get(base_records::list_records).post(base_records::create_record),
        )
        .route(
            "/spaces/{id}/base/record/{recordId}",
            patch(base_records::update_record).delete(base_records::delete_record),
        )
        .route(
            "/spaces/{id}/base/records/batch-delete",
            post(base_records::batch_delete_records),
        )
        // ── Collaboration ───────────────────────────────────────
        .route("/spaces/{id}/collab", get(collab::collab_ws))
        // ── Whiteboard libraries ────────────────────────────────
        .route(
            "/whiteboard/libraries",
            get(whiteboard_library::list_libraries),
        )
        .route(
            "/whiteboard/libraries/{id}/download",
            get(whiteboard_library::download_library),
        )
        .route(
            "/whiteboard/libraries/{id}/preview",
            get(whiteboard_library::preview_library),
        )
        .route(
            "/whiteboard/user-library",
            get(whiteboard_library::get_user_library)
                .put(whiteboard_library::save_user_library),
        )
        // ── Static assets ───────────────────────────────────────
        .route("/assets/{*path}", get(assets::serve))
        .with_state(ctx)
}
