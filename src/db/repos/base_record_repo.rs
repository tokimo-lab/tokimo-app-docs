use sea_orm::prelude::*;
use sea_orm::sea_query::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::docs_base_records;
use crate::db::pagination::{Page, PageInput};
use crate::error::{AppError, OptionExt};

pub struct BaseRecordRepo;

impl BaseRecordRepo {
    /// List records for a base doc path with pagination, ordered by sort_order.
    pub async fn list<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        page: &PageInput,
    ) -> Result<Page<docs_base_records::Model>, AppError> {
        let query = docs_base_records::Entity::find()
            .filter(docs_base_records::Column::SpaceId.eq(space_id))
            .filter(docs_base_records::Column::RelPath.eq(rel_path))
            .order_by_asc(docs_base_records::Column::SortOrder)
            .order_by_asc(docs_base_records::Column::CreatedAt);

        let total = query.clone().count(db).await? as i64;
        let items = query
            .paginate(db, page.page_size)
            .fetch_page(page.page.saturating_sub(1))
            .await?;

        Ok(Page::new(items, total, page))
    }

    /// Get a single record by id.
    pub async fn get_by_id<C: ConnectionTrait>(db: &C, id: Uuid) -> Result<docs_base_records::Model, AppError> {
        docs_base_records::Entity::find_by_id(id)
            .one(db)
            .await?
            .not_found("record not found")
    }

    /// Create a new record.
    pub async fn create<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        data: serde_json::Value,
        sort_order: i32,
    ) -> Result<docs_base_records::Model, AppError> {
        let id = Uuid::new_v4();
        let model = docs_base_records::ActiveModel {
            id: Set(id),
            space_id: Set(space_id),
            rel_path: Set(rel_path.to_string()),
            data: Set(data),
            sort_order: Set(sort_order),
            ..Default::default()
        };
        docs_base_records::Entity::insert(model).exec(db).await?;
        Self::get_by_id(db, id).await
    }

    /// Batch-create multiple records. Returns all created models.
    pub async fn batch_create<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        items: Vec<(serde_json::Value, i32)>,
    ) -> Result<Vec<docs_base_records::Model>, AppError> {
        if items.is_empty() {
            return Ok(Vec::new());
        }

        let mut ids = Vec::with_capacity(items.len());
        let models: Vec<docs_base_records::ActiveModel> = items
            .into_iter()
            .map(|(data, sort_order)| {
                let id = Uuid::new_v4();
                ids.push(id);
                docs_base_records::ActiveModel {
                    id: Set(id),
                    space_id: Set(space_id),
                    rel_path: Set(rel_path.to_string()),
                    data: Set(data),
                    sort_order: Set(sort_order),
                    ..Default::default()
                }
            })
            .collect();

        docs_base_records::Entity::insert_many(models).exec(db).await?;

        Ok(docs_base_records::Entity::find()
            .filter(docs_base_records::Column::Id.is_in(ids))
            .order_by_asc(docs_base_records::Column::SortOrder)
            .all(db)
            .await?)
    }

    /// Update a record's data and/or sort_order.
    pub async fn update<C: ConnectionTrait>(
        db: &C,
        id: Uuid,
        data: Option<serde_json::Value>,
        sort_order: Option<i32>,
    ) -> Result<docs_base_records::Model, AppError> {
        if data.is_none() && sort_order.is_none() {
            return Self::get_by_id(db, id).await;
        }
        let mut stmt = docs_base_records::Entity::update_many().filter(docs_base_records::Column::Id.eq(id));
        if let Some(d) = data {
            stmt = stmt.col_expr(docs_base_records::Column::Data, Expr::value(d));
        }
        if let Some(s) = sort_order {
            stmt = stmt.col_expr(docs_base_records::Column::SortOrder, Expr::value(s));
        }
        let results = stmt.exec_with_returning(db).await?;
        results
            .into_iter()
            .next()
            .ok_or_else(|| AppError::NotFound("record not found".into()))
    }

    /// Delete a single record. Returns error if not found.
    pub async fn delete<C: ConnectionTrait>(db: &C, id: Uuid) -> Result<(), AppError> {
        let rows = docs_base_records::Entity::delete_by_id(id)
            .exec(db)
            .await?
            .rows_affected;
        if rows == 0 {
            return Err(AppError::NotFound("record not found".into()));
        }
        Ok(())
    }

    /// Batch-delete records by ids. Returns the number of deleted rows.
    pub async fn batch_delete<C: ConnectionTrait>(db: &C, ids: Vec<Uuid>) -> Result<u64, AppError> {
        let result = docs_base_records::Entity::delete_many()
            .filter(docs_base_records::Column::Id.is_in(ids))
            .exec(db)
            .await?;
        Ok(result.rows_affected)
    }

    /// Get the maximum sort_order for a base doc path (used to append new records).
    pub async fn max_sort_order<C: ConnectionTrait>(db: &C, space_id: Uuid, rel_path: &str) -> Result<i32, AppError> {
        let max = docs_base_records::Entity::find()
            .filter(docs_base_records::Column::SpaceId.eq(space_id))
            .filter(docs_base_records::Column::RelPath.eq(rel_path))
            .order_by_desc(docs_base_records::Column::SortOrder)
            .one(db)
            .await?
            .map_or(0, |r| r.sort_order);
        Ok(max)
    }

    pub async fn rename_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        old_rel: &str,
        new_rel: &str,
    ) -> Result<(), AppError> {
        docs_base_records::Entity::update_many()
            .filter(docs_base_records::Column::SpaceId.eq(space_id))
            .filter(docs_base_records::Column::RelPath.eq(old_rel))
            .col_expr(docs_base_records::Column::RelPath, Expr::value(new_rel.to_string()))
            .col_expr(docs_base_records::Column::UpdatedAt, Expr::current_timestamp())
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn rename_path_prefix<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        old_prefix: &str,
        new_prefix: &str,
    ) -> Result<(), AppError> {
        db.execute_raw(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"UPDATE docs_base_records
               SET rel_path = $3 || substring(rel_path from char_length($2) + 1), updated_at = NOW()
               WHERE space_id = $1 AND left(rel_path, char_length($2)) = $2",
            vec![
                space_id.into(),
                old_prefix.to_string().into(),
                new_prefix.to_string().into(),
            ],
        ))
        .await?;
        Ok(())
    }
}
