use sea_orm::prelude::*;
use sea_orm::sea_query::OnConflict;
use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::docs_collab_states;
use crate::error::AppError;

pub struct CollabStateRepo;

impl CollabStateRepo {
    pub async fn get<C: ConnectionTrait>(db: &C, node_id: Uuid) -> Result<Option<Vec<u8>>, AppError> {
        Ok(docs_collab_states::Entity::find_by_id(node_id)
            .one(db)
            .await?
            .map(|row| row.yjs_state))
    }

    pub async fn upsert<C: ConnectionTrait>(db: &C, node_id: Uuid, yjs_state: Vec<u8>) -> Result<(), AppError> {
        let now = chrono::Utc::now().fixed_offset();
        docs_collab_states::Entity::insert(docs_collab_states::ActiveModel {
            node_id: Set(node_id),
            yjs_state: Set(yjs_state),
            updated_at: Set(now),
        })
        .on_conflict(
            OnConflict::column(docs_collab_states::Column::NodeId)
                .update_columns([
                    docs_collab_states::Column::YjsState,
                    docs_collab_states::Column::UpdatedAt,
                ])
                .to_owned(),
        )
        .exec(db)
        .await?;
        Ok(())
    }

    pub async fn delete<C: ConnectionTrait>(db: &C, node_id: Uuid) -> Result<(), AppError> {
        docs_collab_states::Entity::delete_by_id(node_id).exec(db).await?;
        Ok(())
    }
}
