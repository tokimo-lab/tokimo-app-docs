use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::docs_base_records;
use crate::db::pagination::{Page, PageInput};
use crate::error::{AppError, OptionExt};

pub struct BaseRecordRepo;

impl BaseRecordRepo {
    /// List records for a base node with pagination, ordered by sort_order.
    pub async fn list(
        db: &DatabaseConnection,
        node_id: Uuid,
        page: &PageInput,
    ) -> Result<Page<docs_base_records::Model>, AppError> {
        let query = docs_base_records::Entity::find()
            .filter(docs_base_records::Column::NodeId.eq(node_id))
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
    pub async fn get_by_id(db: &DatabaseConnection, id: Uuid) -> Result<docs_base_records::Model, AppError> {
        docs_base_records::Entity::find_by_id(id)
            .one(db)
            .await?
            .not_found("record not found")
    }

    /// Create a new record.
    pub async fn create(
        db: &DatabaseConnection,
        node_id: Uuid,
        data: serde_json::Value,
        sort_order: i32,
    ) -> Result<docs_base_records::Model, AppError> {
        let id = Uuid::new_v4();
        let model = docs_base_records::ActiveModel {
            id: Set(id),
            node_id: Set(node_id),
            data: Set(data),
            sort_order: Set(sort_order),
            ..Default::default()
        };
        docs_base_records::Entity::insert(model).exec(db).await?;
        Self::get_by_id(db, id).await
    }

    /// Batch-create multiple records. Returns all created models.
    pub async fn batch_create(
        db: &DatabaseConnection,
        node_id: Uuid,
        items: Vec<(serde_json::Value, i32)>,
    ) -> Result<Vec<docs_base_records::Model>, AppError> {
        let mut ids = Vec::with_capacity(items.len());
        let models: Vec<docs_base_records::ActiveModel> = items
            .into_iter()
            .map(|(data, sort_order)| {
                let id = Uuid::new_v4();
                ids.push(id);
                docs_base_records::ActiveModel {
                    id: Set(id),
                    node_id: Set(node_id),
                    data: Set(data),
                    sort_order: Set(sort_order),
                    ..Default::default()
                }
            })
            .collect();

        docs_base_records::Entity::insert_many(models).exec(db).await?;

        docs_base_records::Entity::find()
            .filter(docs_base_records::Column::Id.is_in(ids))
            .order_by_asc(docs_base_records::Column::SortOrder)
            .all(db)
            .await
            .map_err(AppError::Database)
    }

    /// Update a record's data and/or sort_order.
    pub async fn update(
        db: &DatabaseConnection,
        id: Uuid,
        data: Option<serde_json::Value>,
        sort_order: Option<i32>,
    ) -> Result<docs_base_records::Model, AppError> {
        let model = Self::get_by_id(db, id).await?;
        let mut active: docs_base_records::ActiveModel = model.into();

        if let Some(d) = data {
            active.data = Set(d);
        }
        if let Some(s) = sort_order {
            active.sort_order = Set(s);
        }
        active.update(db).await.map_err(AppError::Database)
    }

    /// Delete a single record. Returns error if not found.
    pub async fn delete(db: &DatabaseConnection, id: Uuid) -> Result<(), AppError> {
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
    pub async fn batch_delete(db: &DatabaseConnection, ids: Vec<Uuid>) -> Result<u64, AppError> {
        let result = docs_base_records::Entity::delete_many()
            .filter(docs_base_records::Column::Id.is_in(ids))
            .exec(db)
            .await?;
        Ok(result.rows_affected)
    }

    /// Get the maximum sort_order for a node (used to append new records).
    pub async fn max_sort_order(db: &DatabaseConnection, node_id: Uuid) -> Result<i32, AppError> {
        use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};

        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM docs_base_records WHERE node_id = $1",
            [node_id.into()],
        );
        let row = db.query_one_raw(stmt).await?;
        match row {
            Some(r) => {
                let val: i32 = r.try_get_by_index(0)?;
                Ok(val)
            }
            None => Ok(0),
        }
    }
}
