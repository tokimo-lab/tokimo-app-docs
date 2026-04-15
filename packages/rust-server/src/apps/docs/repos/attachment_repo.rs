use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::doc_node_attachments;
use crate::error::AppError;

pub struct AttachmentRepo;

impl AttachmentRepo {
    /// List all attachments for a given node.
    pub async fn list_by_node(
        db: &DatabaseConnection,
        node_id: Uuid,
    ) -> Result<Vec<doc_node_attachments::Model>, AppError> {
        doc_node_attachments::Entity::find()
            .filter(doc_node_attachments::Column::NodeId.eq(node_id))
            .order_by_asc(doc_node_attachments::Column::CreatedAt)
            .all(db)
            .await
            .map_err(AppError::Database)
    }

    /// Get a single attachment by ID.
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

    /// Delete an attachment by ID.
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
