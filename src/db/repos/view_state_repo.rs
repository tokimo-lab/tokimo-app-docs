use sea_orm::prelude::*;
use sea_orm::sea_query::{Expr, OnConflict};
use sea_orm::*;
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::db::entities::docs_node_view_states;
use crate::error::AppError;

pub struct DocNodeViewStateRepo;

impl DocNodeViewStateRepo {
    /// Get the view state for a user + doc path pair.
    pub async fn get_view_state<C: ConnectionTrait>(
        db: &C,
        user_id: Uuid,
        space_id: Uuid,
        rel_path: &str,
    ) -> Result<Option<docs_node_view_states::Model>, AppError> {
        Ok(docs_node_view_states::Entity::find()
            .filter(docs_node_view_states::Column::UserId.eq(user_id))
            .filter(docs_node_view_states::Column::SpaceId.eq(space_id))
            .filter(docs_node_view_states::Column::RelPath.eq(rel_path))
            .one(db)
            .await?)
    }

    /// Upsert the view state for a user + doc path pair.
    pub async fn upsert_view_state<C: ConnectionTrait>(
        db: &C,
        user_id: Uuid,
        space_id: Uuid,
        rel_path: &str,
        view_state: JsonValue,
    ) -> Result<(), AppError> {
        let model = docs_node_view_states::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            space_id: Set(space_id),
            rel_path: Set(rel_path.to_string()),
            view_state: Set(view_state),
            updated_at: Set(chrono::Utc::now().fixed_offset()),
        };

        docs_node_view_states::Entity::insert(model)
            .on_conflict(
                OnConflict::columns([
                    docs_node_view_states::Column::UserId,
                    docs_node_view_states::Column::SpaceId,
                    docs_node_view_states::Column::RelPath,
                ])
                .update_columns([
                    docs_node_view_states::Column::ViewState,
                    docs_node_view_states::Column::UpdatedAt,
                ])
                .to_owned(),
            )
            .exec(db)
            .await?;

        Ok(())
    }

    pub async fn rename_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        old_rel: &str,
        new_rel: &str,
    ) -> Result<(), AppError> {
        docs_node_view_states::Entity::update_many()
            .filter(docs_node_view_states::Column::SpaceId.eq(space_id))
            .filter(docs_node_view_states::Column::RelPath.eq(old_rel))
            .col_expr(docs_node_view_states::Column::RelPath, Expr::value(new_rel.to_string()))
            .col_expr(docs_node_view_states::Column::UpdatedAt, Expr::current_timestamp())
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
            r"UPDATE docs_node_view_states
               SET rel_path = $3 || substring(rel_path from char_length($2) + 1), updated_at = NOW()
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
