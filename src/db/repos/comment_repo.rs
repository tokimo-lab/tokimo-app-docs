use sea_orm::prelude::*;
use sea_orm::sea_query::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::apps::docs::models::DocNodeCommentOutput;
use crate::db::entities::{docs_node_comments, users};
use crate::error::AppError;
use crate::error::OptionExt;

pub struct DocNodeCommentRepo;

impl DocNodeCommentRepo {
    /// List comments for a doc path (top-level + replies).
    pub async fn list_by_node<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
    ) -> Result<Vec<DocNodeCommentOutput>, AppError> {
        let comments = docs_node_comments::Entity::find()
            .filter(docs_node_comments::Column::SpaceId.eq(space_id))
            .filter(docs_node_comments::Column::RelPath.eq(rel_path))
            .find_also_related(users::Entity)
            .order_by_asc(docs_node_comments::Column::CreatedAt)
            .all(db)
            .await?;

        let mut top_level: Vec<DocNodeCommentOutput> = Vec::new();
        let mut replies_map: std::collections::HashMap<Uuid, Vec<DocNodeCommentOutput>> =
            std::collections::HashMap::new();

        for (comment, user) in &comments {
            let user_name = user.as_ref().map_or_else(|| "Unknown".to_string(), |u| u.name.clone());
            let output = DocNodeCommentOutput {
                id: comment.id.to_string(),
                space_id: comment.space_id.to_string(),
                rel_path: comment.rel_path.clone(),
                user_id: comment.user_id.to_string(),
                user_name,
                comment_key: comment.comment_key.clone(),
                content: comment.content.clone(),
                is_resolved: comment.is_resolved,
                parent_id: comment.parent_id.map(|id| id.to_string()),
                replies: vec![],
                created_at: comment.created_at.to_rfc3339(),
                updated_at: comment.updated_at.to_rfc3339(),
            };
            if let Some(pid) = comment.parent_id {
                replies_map.entry(pid).or_default().push(output);
            } else {
                top_level.push(output);
            }
        }

        for comment in &mut top_level {
            if let Ok(id) = comment.id.parse::<Uuid>()
                && let Some(replies) = replies_map.remove(&id)
            {
                comment.replies = replies;
            }
        }

        Ok(top_level)
    }

    /// Create a comment.
    pub async fn create<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        user_id: Uuid,
        comment_key: String,
        content: String,
        parent_id: Option<Uuid>,
    ) -> Result<docs_node_comments::Model, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();
        let model = docs_node_comments::ActiveModel {
            id: Set(id),
            space_id: Set(space_id),
            rel_path: Set(rel_path.to_string()),
            user_id: Set(user_id),
            comment_key: Set(comment_key),
            content: Set(content),
            is_resolved: Set(false),
            parent_id: Set(parent_id),
            created_at: Set(now),
            updated_at: Set(now),
        };
        docs_node_comments::Entity::insert(model).exec(db).await?;
        docs_node_comments::Entity::find_by_id(id)
            .one(db)
            .await?
            .internal("failed to fetch created comment")
    }

    /// Resolve/unresolve a comment.
    pub async fn resolve<C: ConnectionTrait>(db: &C, id: Uuid, resolved: bool) -> Result<bool, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let result = docs_node_comments::Entity::update_many()
            .filter(docs_node_comments::Column::Id.eq(id))
            .col_expr(docs_node_comments::Column::IsResolved, Expr::value(resolved))
            .col_expr(docs_node_comments::Column::UpdatedAt, Expr::value(now))
            .exec(db)
            .await?;
        Ok(result.rows_affected > 0)
    }

    /// Delete a comment.
    pub async fn delete<C: ConnectionTrait>(db: &C, id: Uuid) -> Result<bool, AppError> {
        let result = docs_node_comments::Entity::delete_by_id(id).exec(db).await?;
        Ok(result.rows_affected > 0)
    }

    pub async fn rename_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        old_rel: &str,
        new_rel: &str,
    ) -> Result<(), AppError> {
        docs_node_comments::Entity::update_many()
            .filter(docs_node_comments::Column::SpaceId.eq(space_id))
            .filter(docs_node_comments::Column::RelPath.eq(old_rel))
            .col_expr(docs_node_comments::Column::RelPath, Expr::value(new_rel.to_string()))
            .col_expr(docs_node_comments::Column::UpdatedAt, Expr::current_timestamp())
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
            r"UPDATE docs_node_comments
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
