use axum::Json;
use axum::extract::{Path, Query, State};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;

use super::parse_uuid;
use crate::db::entities::docs_base_records;
use crate::db::pagination::{Page, PageInput};
use crate::db::repos::base_record_repo::BaseRecordRepo;
use crate::error::AppError;
use crate::handlers::AppCtx;
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
    pub page: Option<u64>,
    pub page_size: Option<u64>,
}
impl RelPathQuery {
    fn pagination(&self) -> PageInput {
        let defaults = PageInput::default();
        PageInput {
            page: self.page.unwrap_or(defaults.page).max(1),
            page_size: self.page_size.unwrap_or(defaults.page_size).clamp(1, 1000),
        }
    }
}
#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordInput {
    pub data: Option<serde_json::Value>,
}
#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecordInput {
    pub data: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}
#[derive(Debug, Deserialize, TS)]
#[ts(export)]
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
    let page = q.pagination();
    let result: Page<docs_base_records::Model> =
        BaseRecordRepo::list(&ctx.db, parse_uuid(&id)?, &q.rel_path, &page).await?;
    let output = Page::new(
        result.items.into_iter().map(BaseRecordOutput::from).collect(),
        result.total,
        &page,
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

#[cfg(test)]
mod tests {
    use axum::extract::Query;
    use axum::http::Uri;

    use super::RelPathQuery;

    #[test]
    fn parses_optional_pagination_from_query_string() {
        let uri: Uri = "/base/records?relPath=Demo.tokimo-base.json&page=2&pageSize=1000"
            .parse()
            .expect("valid URI");
        let Query(query) = Query::<RelPathQuery>::try_from_uri(&uri).expect("query parses");

        assert_eq!(query.rel_path, "Demo.tokimo-base.json");
        assert_eq!(query.pagination().page, 2);
        assert_eq!(query.pagination().page_size, 1000);
    }

    #[test]
    fn allows_record_creation_query_without_pagination() {
        let uri: Uri = "/base/records?relPath=Demo.tokimo-base.json"
            .parse()
            .expect("valid URI");
        let Query(query) = Query::<RelPathQuery>::try_from_uri(&uri).expect("query parses");

        assert_eq!(query.pagination().page, 1);
        assert_eq!(query.pagination().page_size, 20);
    }

    #[test]
    fn normalizes_invalid_and_oversized_pagination() {
        let zero_uri: Uri = "/base/records?relPath=Demo.tokimo-base.json&page=0&pageSize=0"
            .parse()
            .expect("valid URI");
        let Query(zero_query) = Query::<RelPathQuery>::try_from_uri(&zero_uri).expect("query parses");
        assert_eq!(zero_query.pagination().page, 1);
        assert_eq!(zero_query.pagination().page_size, 1);

        let oversized_uri: Uri = "/base/records?relPath=Demo.tokimo-base.json&pageSize=1001"
            .parse()
            .expect("valid URI");
        let Query(oversized_query) = Query::<RelPathQuery>::try_from_uri(&oversized_uri).expect("query parses");
        assert_eq!(oversized_query.pagination().page_size, 1000);
    }
}
