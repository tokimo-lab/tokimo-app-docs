use crate::handlers::AppCtx;
use crate::handlers::{
    attachment, base_meta, base_records, browse, collab, comments, crud, space, versions, view_ctx,
    whiteboard_library,
};
use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{delete, get, patch, post},
};
use std::sync::Arc;

pub fn build_docs_app_routes() -> Router<Arc<AppCtx>> {
    Router::new()
        .route(
            "/spaces",
            get(space::list_spaces).post(space::create_space),
        )
        .route(
            "/spaces/{id}",
            patch(space::update_space).delete(space::delete_space),
        )
        .route(
            "/spaces/{id}/nodes",
            get(browse::list_nodes).post(crud::create_node),
        )
        .route("/spaces/{id}/nodes/tags", get(browse::list_node_tags))
        .route(
            "/spaces/{id}/node",
            get(crud::get_node).patch(crud::update_node).delete(crud::archive_node),
        )
        .route("/spaces/{id}/node/restore", patch(crud::restore_node))
        .route("/spaces/{id}/node/permanent", delete(crud::delete_node))
        .route(
            "/spaces/{id}/node/favorite",
            patch(browse::toggle_favorite),
        )
        .route("/spaces/{id}/node/pin", patch(browse::toggle_pin))
        .route("/spaces/{id}/node/move", patch(crud::move_node))
        .route("/spaces/{id}/node/versions", get(versions::list_versions))
        .route(
            "/spaces/{id}/node/version/{versionId}",
            get(versions::get_version),
        )
        .route(
            "/spaces/{id}/node/version/{versionId}/restore",
            post(versions::restore_version),
        )
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
        .route(
            "/spaces/{id}/node/view-ctx",
            get(view_ctx::get_view_ctx).put(view_ctx::put_view_ctx),
        )
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
        .route("/spaces/{id}/collab", get(collab::collab_ws))
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
            get(whiteboard_library::get_user_library).put(whiteboard_library::save_user_library),
        )
}
