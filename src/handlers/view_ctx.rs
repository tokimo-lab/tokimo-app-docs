//! View context handler (placeholder)

use axum::Json;
use serde::Serialize;

use crate::error::{AppError, ApiResponse, ok};

#[derive(Debug, Serialize)]
pub struct ViewCtxOutput {
    pub scroll_position: Option<i32>,
    pub last_viewed_at: Option<String>,
}

pub async fn get_view_ctx() -> Result<Json<ApiResponse<ViewCtxOutput>>, AppError> {
    Ok(ok(ViewCtxOutput {
        scroll_position: None,
        last_viewed_at: None,
    }))
}

pub async fn put_view_ctx() -> Result<Json<ApiResponse<ViewCtxOutput>>, AppError> {
    Ok(ok(ViewCtxOutput {
        scroll_position: None,
        last_viewed_at: None,
    }))
}
