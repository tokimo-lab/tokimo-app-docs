use chrono::Utc;
use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::docs_node_attachments;
use crate::error::AppError;

pub struct CreateAttachmentParams {
    pub node_id: Uuid,
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
    /// List all active (non-deleted) attachments for a given node.
    pub async fn list_by_node(
        db: &DatabaseConnection,
        node_id: Uuid,
    ) -> Result<Vec<docs_node_attachments::Model>, AppError> {
        docs_node_attachments::Entity::find()
            .filter(docs_node_attachments::Column::NodeId.eq(node_id))
            .filter(docs_node_attachments::Column::DeletedAt.is_null())
            .order_by_asc(docs_node_attachments::Column::CreatedAt)
            .all(db)
            .await
            .map_err(AppError::Database)
    }

    /// Get a single attachment by ID (including soft-deleted).
    pub async fn get_by_id(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<Option<docs_node_attachments::Model>, AppError> {
        docs_node_attachments::Entity::find_by_id(id)
            .one(db)
            .await
            .map_err(AppError::Database)
    }

    /// Insert a new attachment record and return it.
    pub async fn create(
        db: &DatabaseConnection,
        params: CreateAttachmentParams,
    ) -> Result<docs_node_attachments::Model, AppError> {
        let id = Uuid::new_v4();
        let active = docs_node_attachments::ActiveModel {
            id: Set(id),
            node_id: Set(params.node_id),
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
        docs_node_attachments::Entity::insert(active)
            .exec_with_returning(db)
            .await
            .map_err(AppError::Database)
    }

    /// Soft-delete: set deleted_at = now().
    pub async fn soft_delete(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let record = docs_node_attachments::Entity::find_by_id(id)
            .filter(docs_node_attachments::Column::DeletedAt.is_null())
            .one(db)
            .await
            .map_err(AppError::Database)?;
        let Some(record) = record else {
            return Ok(false);
        };
        let mut active: docs_node_attachments::ActiveModel = record.into();
        active.deleted_at = Set(Some(Utc::now().fixed_offset()));
        active.update(db).await.map_err(AppError::Database)?;
        Ok(true)
    }

    /// Restore a soft-deleted attachment (clear deleted_at).
    pub async fn restore(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let record = docs_node_attachments::Entity::find_by_id(id)
            .one(db)
            .await
            .map_err(AppError::Database)?;
        let Some(record) = record else {
            return Ok(false);
        };
        if record.deleted_at.is_none() {
            return Ok(true); // already active
        }
        let mut active: docs_node_attachments::ActiveModel = record.into();
        active.deleted_at = Set(None);
        active.update(db).await.map_err(AppError::Database)?;
        Ok(true)
    }

    /// Hard-delete an attachment by ID (used by purge task).
    pub async fn delete_by_id(db: &DatabaseConnection, id: Uuid) -> Result<u64, AppError> {
        let res = docs_node_attachments::Entity::delete_by_id(id)
            .exec(db)
            .await
            .map_err(AppError::Database)?;
        Ok(res.rows_affected)
    }

    /// Find all attachments that have been soft-deleted for longer than `retention`.
    pub async fn list_expired(
        db: &DatabaseConnection,
        retention: chrono::Duration,
    ) -> Result<Vec<docs_node_attachments::Model>, AppError> {
        let cutoff = Utc::now().fixed_offset() - retention;
        docs_node_attachments::Entity::find()
            .filter(docs_node_attachments::Column::DeletedAt.is_not_null())
            .filter(docs_node_attachments::Column::DeletedAt.lt(cutoff))
            .all(db)
            .await
            .map_err(AppError::Database)
    }

    /// List all storage keys for a node (used for bulk cleanup).
    pub async fn list_storage_keys_by_node(db: &DatabaseConnection, node_id: Uuid) -> Result<Vec<String>, AppError> {
        let rows = docs_node_attachments::Entity::find()
            .filter(docs_node_attachments::Column::NodeId.eq(node_id))
            .all(db)
            .await
            .map_err(AppError::Database)?;
        Ok(rows.into_iter().map(|r| r.storage_key).collect())
    }
}
