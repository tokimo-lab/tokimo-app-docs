use axum::{
    routing::{get, patch},
    Router,
};
use std::sync::Arc;

use crate::handlers::doc;
use crate::AppState;

pub fn build_doc_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/apps/{id}/docs",
            get(doc::list_docs).post(doc::create_doc),
        )
        .route("/api/apps/{id}/doc-tags", get(doc::list_tags))
        .route(
            "/api/docs/{id}",
            get(doc::get_doc)
                .patch(doc::update_doc)
                .delete(doc::delete_doc),
        )
        .route("/api/docs/{id}/favorite", patch(doc::toggle_favorite))
        .route("/api/docs/{id}/pin", patch(doc::toggle_pin))
        .route("/api/docs/{id}/move", patch(doc::move_doc))
        .route("/api/docs/{id}/restore", patch(doc::restore_doc))
        .route(
            "/api/docs/{id}/permanent",
            axum::routing::delete(doc::permanent_delete_doc),
        )
        .route(
            "/api/docs/{id}/comments",
            get(doc::list_comments).post(doc::create_comment),
        )
        .route(
            "/api/doc-comments/{id}/resolve",
            patch(doc::resolve_comment),
        )
        .route("/api/doc-comments/{id}", axum::routing::delete(doc::delete_comment))
        .route(
            "/api/apps/{id}/doc-folders",
            get(doc::list_folders).post(doc::create_folder),
        )
        .route(
            "/api/doc-folders/{id}",
            patch(doc::update_folder).delete(doc::delete_folder),
        )
}
