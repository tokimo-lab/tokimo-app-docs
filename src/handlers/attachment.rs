use axum::extract::{Multipart, Path, Query, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use super::parse_uuid;
use crate::db::entities::DocNodeAttachmentOutput;
use crate::db::repos::attachment_repo::{AttachmentRepo, CreateAttachmentParams};
use crate::db::repos::node_meta_repo::DocNodeMetaRepo;
use crate::handlers::AppCtx;
use crate::handlers::user::AuthUser;
use crate::handlers::{err_resp, ok, ok_empty};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelPathQuery {
    pub rel_path: String,
}

pub async fn upload_attachment(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
    AuthUser(_): AuthUser,
    mut multipart: Multipart,
) -> Response {
    let space_id = match parse_uuid(&id) {
        Ok(value) => value,
        Err(e) => return err_resp(StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    };
    match DocNodeMetaRepo::find(&ctx.db, space_id, &q.rel_path).await {
        Ok(Some(node)) if !node.is_archived => {}
        Ok(_) => return err_resp(StatusCode::NOT_FOUND, "Document not found".into()).into_response(),
        Err(e) => {
            return err_resp(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Document lookup failed: {e}"),
            )
            .into_response();
        }
    }
    let field = match multipart.next_field().await {
        Ok(Some(f)) => f,
        Ok(None) => return err_resp(StatusCode::BAD_REQUEST, "No file provided".into()).into_response(),
        Err(e) => return err_resp(StatusCode::BAD_REQUEST, format!("Multipart error: {e}")).into_response(),
    };
    let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
    let file_name = field.file_name().unwrap_or("unnamed").to_string();
    let data = match field.bytes().await {
        Ok(b) => b,
        Err(e) => return err_resp(StatusCode::BAD_REQUEST, format!("Failed to read file: {e}")).into_response(),
    };
    let ext = std::path::Path::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin")
        .to_string();
    let storage_key = format!(
        "docs/attachments/{}/{}/{}.{}",
        id,
        q.rel_path.replace('/', "_"),
        Uuid::new_v4(),
        ext
    );
    if let Err(e) = ctx
        .storage
        .upload(std::path::Path::new(&storage_key), &data, Some(content_type.clone()))
        .await
    {
        return err_resp(StatusCode::INTERNAL_SERVER_ERROR, format!("Storage upload failed: {e}")).into_response();
    }
    match AttachmentRepo::create(
        &ctx.db,
        CreateAttachmentParams {
            space_id,
            rel_path: q.rel_path,
            storage_key: storage_key.clone(),
            file_name,
            file_type: content_type,
            file_size: data.len() as i32,
            is_binary: None,
            detected_mime: None,
            file_category: None,
            text_encoding: None,
            detected_language: None,
        },
    )
    .await
    {
        Ok(r) => ok(DocNodeAttachmentOutput::from(r)).into_response(),
        Err(e) => {
            let _ = ctx.storage.delete(std::path::Path::new(&storage_key)).await;
            err_resp(StatusCode::INTERNAL_SERVER_ERROR, format!("DB insert failed: {e}")).into_response()
        }
    }
}
pub async fn list_attachments(
    State(ctx): State<Arc<AppCtx>>,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
    AuthUser(_): AuthUser,
) -> Response {
    match AttachmentRepo::list_by_node(
        &ctx.db,
        match parse_uuid(&id) {
            Ok(v) => v,
            Err(e) => return err_resp(StatusCode::BAD_REQUEST, e.to_string()).into_response(),
        },
        &q.rel_path,
    )
    .await
    {
        Ok(rows) => ok(rows.into_iter().map(DocNodeAttachmentOutput::from).collect::<Vec<_>>()).into_response(),
        Err(e) => err_resp(StatusCode::INTERNAL_SERVER_ERROR, format!("List failed: {e}")).into_response(),
    }
}

pub async fn get_attachment_content(
    State(ctx): State<Arc<AppCtx>>,
    Path((space_id, id)): Path<(String, String)>,
    AuthUser(_): AuthUser,
) -> Response {
    let space_id = match parse_uuid(&space_id) {
        Ok(value) => value,
        Err(e) => return err_resp(StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    };
    let id = match parse_uuid(&id) {
        Ok(value) => value,
        Err(e) => return err_resp(StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    };
    let attachment = match AttachmentRepo::get_active_by_id(&ctx.db, space_id, id).await {
        Ok(Some(value)) => value,
        Ok(None) => return err_resp(StatusCode::NOT_FOUND, "Attachment not found".into()).into_response(),
        Err(e) => {
            return err_resp(StatusCode::INTERNAL_SERVER_ERROR, format!("Lookup failed: {e}")).into_response();
        }
    };
    let content = match ctx.storage.read(std::path::Path::new(&attachment.storage_key)).await {
        Ok(value) => value,
        Err(e) => {
            return err_resp(StatusCode::INTERNAL_SERVER_ERROR, format!("Storage read failed: {e}")).into_response();
        }
    };
    let content_type = attachment
        .detected_mime
        .as_deref()
        .unwrap_or(&attachment.file_type)
        .parse()
        .unwrap_or_else(|_| header::HeaderValue::from_static("application/octet-stream"));
    ([(header::CONTENT_TYPE, content_type)], content).into_response()
}

pub async fn delete_attachment(
    State(ctx): State<Arc<AppCtx>>,
    Path((space_id, id)): Path<(String, String)>,
    AuthUser(_): AuthUser,
) -> Response {
    let space_id = match parse_uuid(&space_id) {
        Ok(v) => v,
        Err(e) => return err_resp(StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    };
    match AttachmentRepo::soft_delete(
        &ctx.db,
        space_id,
        match parse_uuid(&id) {
            Ok(v) => v,
            Err(e) => return err_resp(StatusCode::BAD_REQUEST, e.to_string()).into_response(),
        },
    )
    .await
    {
        Ok(true) => ok_empty().into_response(),
        Ok(false) => err_resp(StatusCode::NOT_FOUND, "Attachment not found".into()).into_response(),
        Err(e) => err_resp(StatusCode::INTERNAL_SERVER_ERROR, format!("Delete failed: {e}")).into_response(),
    }
}
pub async fn restore_attachment(
    State(ctx): State<Arc<AppCtx>>,
    Path((space_id, id)): Path<(String, String)>,
    AuthUser(_): AuthUser,
) -> Response {
    let space_id = match parse_uuid(&space_id) {
        Ok(v) => v,
        Err(e) => return err_resp(StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    };
    match AttachmentRepo::restore(
        &ctx.db,
        space_id,
        match parse_uuid(&id) {
            Ok(v) => v,
            Err(e) => return err_resp(StatusCode::BAD_REQUEST, e.to_string()).into_response(),
        },
    )
    .await
    {
        Ok(true) => ok_empty().into_response(),
        Ok(false) => err_resp(StatusCode::NOT_FOUND, "Attachment not found".into()).into_response(),
        Err(e) => err_resp(StatusCode::INTERNAL_SERVER_ERROR, format!("Restore failed: {e}")).into_response(),
    }
}
