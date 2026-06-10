use axum::Json;
use axum::extract::{Path, Query, State};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;

use super::parse_uuid;
use crate::handlers::AppCtx;
use crate::db::repos::base_record_repo::BaseRecordRepo;
use crate::db::entities::docs_base_records;
use crate::db::pagination::{Page, PageInput};
use crate::error::AppError;
use crate::handlers::user::AuthUser;
use crate::handlers::{ApiResponse, ok, ok_empty};

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BaseRecordOutput {
    pub id: String,
    pub space_id: String,
    pub rel_path: String,
    pub data: serde_json::Value,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}
impl From<docs_base_records::Model> for BaseRecordOutput {
    fn from(m: docs_base_records::Model) -> Self {
        Self {
            id: m.id.to_string(),
            space_id: m.space_id.to_string(),
            rel_path: m.rel_path,
            data: m.data,
            sort_order: m.sort_order,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelPathQuery {
    pub rel_path: String,
    #[serde(flatten)]
    pub page: PageInput,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordInput {
    pub data: Option<serde_json::Value>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecordInput {
    pub data: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDeleteInput {
    pub ids: Vec<String>,
}
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BatchDeleteOutput {
    #[ts(type = "number")]
    pub deleted: i64,
}

pub async fn list_records(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(_): AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let result: Page<docs_base_records::Model> =
        BaseRecordRepo::list(&ctx.db, parse_uuid(&id)?, &q.rel_path, &q.page).await?;
    let output = Page::new(
        result.items.into_iter().map(BaseRecordOutput::from).collect(),
        result.total,
        &q.page,
    );
    Ok(ok(serde_json::to_value(output)?))
}
pub async fn create_record(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(_): AuthUser,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
    Json(body): Json<CreateRecordInput>,
) -> Result<Json<ApiResponse<BaseRecordOutput>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let max = BaseRecordRepo::max_sort_order(&ctx.db, space_id, &q.rel_path).await?;
    Ok(ok(BaseRecordOutput::from(
        BaseRecordRepo::create(
            &ctx.db,
            space_id,
            &q.rel_path,
            body.data.unwrap_or(serde_json::json!({})),
            max + 1,
        )
        .await?,
    )))
}
pub async fn update_record(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(_): AuthUser,
    Path((_space_id, record_id)): Path<(String, String)>,
    Json(body): Json<UpdateRecordInput>,
) -> Result<Json<ApiResponse<BaseRecordOutput>>, AppError> {
    Ok(ok(BaseRecordOutput::from(
        BaseRecordRepo::update(&ctx.db, parse_uuid(&record_id)?, body.data, body.sort_order).await?,
    )))
}
pub async fn delete_record(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(_): AuthUser,
    Path((_space_id, record_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    BaseRecordRepo::delete(&ctx.db, parse_uuid(&record_id)?).await?;
    Ok(ok_empty())
}
pub async fn batch_delete_records(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(_): AuthUser,
    Path(_id): Path<String>,
    Json(body): Json<BatchDeleteInput>,
) -> Result<Json<ApiResponse<BatchDeleteOutput>>, AppError> {
    let ids = body.ids.iter().map(|s| parse_uuid(s)).collect::<Result<Vec<_>, _>>()?;
    Ok(ok(BatchDeleteOutput {
        deleted: BaseRecordRepo::batch_delete(&ctx.db, ids).await? as i64,
    }))
}
