use sea_orm::*;
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::db::entities::docs_node_user_states;
use crate::error::AppError;

pub struct UserStateRepo;

impl UserStateRepo {
    /// Get the view state for a user + node pair.
    pub async fn get_view_state(
        db: &DatabaseConnection,
        user_id: Uuid,
        node_id: Uuid,
    ) -> Result<Option<docs_node_user_states::Model>, AppError> {
        docs_node_user_states::Entity::find()
            .filter(docs_node_user_states::Column::UserId.eq(user_id))
            .filter(docs_node_user_states::Column::NodeId.eq(node_id))
            .one(db)
            .await
            .map_err(AppError::Database)
    }

    /// Upsert the view state for a user + node pair.
    pub async fn upsert_view_state(
        db: &DatabaseConnection,
        user_id: Uuid,
        node_id: Uuid,
        view_state: JsonValue,
    ) -> Result<(), AppError> {
        use sea_orm::sea_query::OnConflict;

        let model = docs_node_user_states::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            node_id: Set(node_id),
            view_state: Set(view_state),
            updated_at: Set(chrono::Utc::now().into()),
        };

        docs_node_user_states::Entity::insert(model)
            .on_conflict(
                OnConflict::columns([
                    docs_node_user_states::Column::UserId,
                    docs_node_user_states::Column::NodeId,
                ])
                .update_column(docs_node_user_states::Column::ViewState)
                .update_column(docs_node_user_states::Column::UpdatedAt)
                .to_owned(),
            )
            .exec(db)
            .await?;

        Ok(())
    }
}
