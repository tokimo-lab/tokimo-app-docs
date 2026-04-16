use chrono::Utc;
use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::doc_node_attachments;
use crate::error::AppError;

pub struct AttachmentRepo;

impl AttachmentRepo {
    /// List all active (non-deleted) attachments for a given node.
    pub async fn list_by_node(
        db: &DatabaseConnection,
        node_id: Uuid,
    ) -> Result<Vec<doc_node_attachments::Model>, AppError> {
        doc_node_attachments::Entity::find()
            .filter(doc_node_attachments::Column::NodeId.eq(node_id))
            .filter(doc_node_attachments::Column::DeletedAt.is_null())
            .order_by_asc(doc_node_attachments::Column::CreatedAt)
            .all(db)
            .await
            .map_err(AppError::Database)
    }

    /// Get a single attachment by ID (including soft-deleted).
    pub async fn get_by_id(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<Option<doc_node_attachments::Model>, AppError> {
        doc_node_attachments::Entity::find_by_id(id)
            .one(db)
            .await
            .map_err(AppError::Database)
    }

    /// Insert a new attachment record and return it.
    pub async fn create(
        db: &DatabaseConnection,
        node_id: Uuid,
        storage_key: &str,
        file_name: &str,
        file_type: &str,
        file_size: i32,
    ) -> Result<doc_node_attachments::Model, AppError> {
        let id = Uuid::new_v4();
        let active = doc_node_attachments::ActiveModel {
            id: Set(id),
            node_id: Set(node_id),
            storage_key: Set(storage_key.to_string()),
            file_name: Set(file_name.to_string()),
            file_type: Set(file_type.to_string()),
            file_size: Set(file_size),
            ..Default::default()
        };
        doc_node_attachments::Entity::insert(active)
            .exec_with_returning(db)
            .await
            .map_err(AppError::Database)
    }

    /// Soft-delete: set deleted_at = now().
    pub async fn soft_delete(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<bool, AppError> {
        let record = doc_node_attachments::Entity::find_by_id(id)
            .filter(doc_node_attachments::Column::DeletedAt.is_null())
            .one(db)
            .await
            .map_err(AppError::Database)?;
        let Some(record) = record else {
            return Ok(false);
        };
        let mut active: doc_node_attachments::ActiveModel = record.into();
        active.deleted_at = Set(Some(Utc::now().fixed_offset()));
        active.update(db).await.map_err(AppError::Database)?;
        Ok(true)
    }

    /// Restore a soft-deleted attachment (clear deleted_at).
    pub async fn restore(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<bool, AppError> {
        let record = doc_node_attachments::Entity::find_by_id(id)
            .one(db)
            .await
            .map_err(AppError::Database)?;
        let Some(record) = record else {
            return Ok(false);
        };
        if record.deleted_at.is_none() {
            return Ok(true); // already active
        }
        let mut active: doc_node_attachments::ActiveModel = record.into();
        active.deleted_at = Set(None);
        active.update(db).await.map_err(AppError::Database)?;
        Ok(true)
    }

    /// Hard-delete an attachment by ID (used by purge task).
    pub async fn delete_by_id(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<u64, AppError> {
        let res = doc_node_attachments::Entity::delete_by_id(id)
            .exec(db)
            .await
            .map_err(AppError::Database)?;
        Ok(res.rows_affected)
    }

    /// Find all attachments that have been soft-deleted for longer than `retention`.
    pub async fn list_expired(
        db: &DatabaseConnection,
        retention: chrono::Duration,
    ) -> Result<Vec<doc_node_attachments::Model>, AppError> {
        let cutoff = Utc::now().fixed_offset() - retention;
        doc_node_attachments::Entity::find()
            .filter(doc_node_attachments::Column::DeletedAt.is_not_null())
            .filter(doc_node_attachments::Column::DeletedAt.lt(cutoff))
            .all(db)
            .await
            .map_err(AppError::Database)
    }

    /// List all storage keys for a node (used for bulk cleanup).
    pub async fn list_storage_keys_by_node(
        db: &DatabaseConnection,
        node_id: Uuid,
    ) -> Result<Vec<String>, AppError> {
        let rows = doc_node_attachments::Entity::find()
            .filter(doc_node_attachments::Column::NodeId.eq(node_id))
            .all(db)
            .await
            .map_err(AppError::Database)?;
        Ok(rows.into_iter().map(|r| r.storage_key).collect())
    }
}
