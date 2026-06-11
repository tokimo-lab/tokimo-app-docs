//! Repository for docs_node_view_ctxs (placeholder)

use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::db::entities::docs_node_view_ctxs;
use crate::error::AppError;

pub struct DocNodeViewCtxRepo;

impl DocNodeViewCtxRepo {
    pub async fn get_by_space_and_path(
        db: &DatabaseConnection,
        space_id: Uuid,
        rel_path: &str,
    ) -> Result<Option<docs_node_view_ctxs::Model>, AppError> {
        Ok(docs_node_view_ctxs::Entity::find()
            .filter(docs_node_view_ctxs::Column::SpaceId.eq(space_id))
            .filter(docs_node_view_ctxs::Column::RelPath.eq(rel_path))
            .one(db)
            .await?)
    }
}

impl DocNodeViewCtxRepo {
    pub async fn upsert_view_ctx(
        _db: &DatabaseConnection,
        _space_id: Uuid,
        _rel_path: &str,
        _scroll_position: Option<i32>,
    ) -> Result<docs_node_view_ctxs::Model, AppError> {
        // Placeholder implementation
        Err(AppError::Internal("not implemented".into()))
    }

    pub async fn get_view_ctx(
        db: &DatabaseConnection,
        space_id: Uuid,
        rel_path: &str,
    ) -> Result<Option<docs_node_view_ctxs::Model>, AppError> {
        Self::get_by_space_and_path(db, space_id, rel_path).await
    }
}

impl DocNodeViewCtxRepo {
    pub async fn rename_path(
        _db: &DatabaseConnection,
        _space_id: Uuid,
        _old_rel: &str,
        _new_rel: &str,
    ) -> Result<(), AppError> {
        // Placeholder implementation
        Ok(())
    }

    pub async fn rename_path_prefix(
        _db: &DatabaseConnection,
        _space_id: Uuid,
        _old_prefix: &str,
        _new_prefix: &str,
    ) -> Result<(), AppError> {
        // Placeholder implementation
        Ok(())
    }
}
