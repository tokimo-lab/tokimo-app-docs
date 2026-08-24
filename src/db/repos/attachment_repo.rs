use chrono::Utc;
use sea_orm::prelude::*;
use sea_orm::sea_query::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::docs_node_attachments;
use crate::error::AppError;

pub struct CreateAttachmentParams {
    pub space_id: Uuid,
    pub rel_path: String,
    pub storage_key: String,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i32,
    pub is_binary: Option<bool>,
    pub detected_mime: Option<String>,
    pub file_category: Option<String>,
    pub text_encoding: Option<String>,
    pub detected_language: Option<String>,
}

pub struct AttachmentRepo;

impl AttachmentRepo {
    /// List all active (non-deleted) attachments for a given doc path.
    pub async fn list_by_node<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
    ) -> Result<Vec<docs_node_attachments::Model>, AppError> {
        Ok(docs_node_attachments::Entity::find()
            .filter(docs_node_attachments::Column::SpaceId.eq(space_id))
            .filter(docs_node_attachments::Column::RelPath.eq(rel_path))
            .filter(docs_node_attachments::Column::DeletedAt.is_null())
            .order_by_asc(docs_node_attachments::Column::CreatedAt)
            .all(db)
            .await?)
    }

    /// Get a single attachment by ID (including soft-deleted).
    pub async fn get_by_id<C: ConnectionTrait>(
        db: &C,
        id: Uuid,
    ) -> Result<Option<docs_node_attachments::Model>, AppError> {
        Ok(docs_node_attachments::Entity::find_by_id(id).one(db).await?)
    }

    /// Insert a new attachment record and return it.
    pub async fn create<C: ConnectionTrait>(
        db: &C,
        params: CreateAttachmentParams,
    ) -> Result<docs_node_attachments::Model, AppError> {
        let id = Uuid::new_v4();
        let active = docs_node_attachments::ActiveModel {
            id: Set(id),
            space_id: Set(params.space_id),
            rel_path: Set(params.rel_path),
            storage_key: Set(params.storage_key),
            file_name: Set(params.file_name),
            file_type: Set(params.file_type),
            file_size: Set(params.file_size),
            is_binary: Set(params.is_binary),
            detected_mime: Set(params.detected_mime),
            file_category: Set(params.file_category),
            text_encoding: Set(params.text_encoding),
            detected_language: Set(params.detected_language),
            ..Default::default()
        };
        Ok(docs_node_attachments::Entity::insert(active)
            .exec_with_returning(db)
            .await?)
    }

    /// Soft-delete: set deleted_at = now().
    pub async fn soft_delete<C: ConnectionTrait>(db: &C, id: Uuid) -> Result<bool, AppError> {
        let result = docs_node_attachments::Entity::update_many()
            .filter(docs_node_attachments::Column::Id.eq(id))
            .filter(docs_node_attachments::Column::DeletedAt.is_null())
            .col_expr(
                docs_node_attachments::Column::DeletedAt,
                Expr::value(Some(Utc::now().fixed_offset())),
            )
            .exec(db)
            .await?;
        Ok(result.rows_affected > 0)
    }

    /// Restore a soft-deleted attachment (clear deleted_at).
    pub async fn restore<C: ConnectionTrait>(db: &C, id: Uuid) -> Result<bool, AppError> {
        let result = docs_node_attachments::Entity::update_many()
            .filter(docs_node_attachments::Column::Id.eq(id))
            .col_expr(
                docs_node_attachments::Column::DeletedAt,
                Expr::value(Option::<chrono::DateTime<chrono::FixedOffset>>::None),
            )
            .exec(db)
            .await?;
        Ok(result.rows_affected > 0)
    }

    /// Hard-delete an attachment by ID (used by purge task).
    pub async fn delete_by_id<C: ConnectionTrait>(db: &C, id: Uuid) -> Result<u64, AppError> {
        let res = docs_node_attachments::Entity::delete_by_id(id).exec(db).await?;
        Ok(res.rows_affected)
    }

    /// Find all attachments that have been soft-deleted for longer than `retention`.
    pub async fn list_expired<C: ConnectionTrait>(
        db: &C,
        retention: chrono::Duration,
    ) -> Result<Vec<docs_node_attachments::Model>, AppError> {
        let cutoff = Utc::now().fixed_offset() - retention;
        Ok(docs_node_attachments::Entity::find()
            .filter(docs_node_attachments::Column::DeletedAt.is_not_null())
            .filter(docs_node_attachments::Column::DeletedAt.lt(cutoff))
            .all(db)
            .await?)
    }

    /// List all storage keys for a path (used for bulk cleanup).
    pub async fn list_storage_keys_by_node<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
    ) -> Result<Vec<String>, AppError> {
        let rows = docs_node_attachments::Entity::find()
            .filter(docs_node_attachments::Column::SpaceId.eq(space_id))
            .filter(docs_node_attachments::Column::RelPath.eq(rel_path))
            .all(db)
            .await?;
        Ok(rows.into_iter().map(|r| r.storage_key).collect())
    }

    pub async fn rename_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        old_rel: &str,
        new_rel: &str,
    ) -> Result<(), AppError> {
        docs_node_attachments::Entity::update_many()
            .filter(docs_node_attachments::Column::SpaceId.eq(space_id))
            .filter(docs_node_attachments::Column::RelPath.eq(old_rel))
            .col_expr(docs_node_attachments::Column::RelPath, Expr::value(new_rel.to_string()))
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
            r"UPDATE docs_node_attachments
               SET rel_path = $3 || substring(rel_path from char_length($2) + 1)
               WHERE space_id = $1
                 AND (rel_path = $2 OR left(rel_path, char_length($2) + 1) = $2 || '/')",
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
