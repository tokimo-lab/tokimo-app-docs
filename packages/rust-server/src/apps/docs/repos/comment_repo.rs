use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::{doc_node_comments, users};
use crate::apps::docs::models::DocNodeCommentOutput;
use crate::error::AppError;
use crate::error::OptionExt;

pub struct DocNodeCommentRepo;

impl DocNodeCommentRepo {
    /// List comments for a node (top-level + replies).
    pub async fn list_by_node(
        db: &DatabaseConnection,
        node_id: Uuid,
    ) -> Result<Vec<DocNodeCommentOutput>, AppError> {
        let comments = doc_node_comments::Entity::find()
            .filter(doc_node_comments::Column::NodeId.eq(node_id))
            .find_also_related(users::Entity)
            .order_by_asc(doc_node_comments::Column::CreatedAt)
            .all(db)
            .await?;

        let mut top_level: Vec<DocNodeCommentOutput> = Vec::new();
        let mut replies_map: std::collections::HashMap<Uuid, Vec<DocNodeCommentOutput>> =
            std::collections::HashMap::new();

        for (comment, user) in &comments {
            let user_name = user
                .as_ref()
                .map_or_else(|| "Unknown".to_string(), |u| u.name.clone());
            let output = DocNodeCommentOutput {
                id: comment.id.to_string(),
                node_id: comment.node_id.to_string(),
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
    pub async fn create(
        db: &DatabaseConnection,
        node_id: Uuid,
        user_id: Uuid,
        comment_key: String,
        content: String,
        parent_id: Option<Uuid>,
    ) -> Result<doc_node_comments::Model, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();
        let model = doc_node_comments::ActiveModel {
            id: Set(id),
            node_id: Set(node_id),
            user_id: Set(user_id),
            comment_key: Set(comment_key),
            content: Set(content),
            is_resolved: Set(false),
            parent_id: Set(parent_id),
            created_at: Set(now),
            updated_at: Set(now),
        };
        doc_node_comments::Entity::insert(model)
            .exec(db)
            .await?;
        doc_node_comments::Entity::find_by_id(id)
            .one(db)
            .await?
            .internal("failed to fetch created comment")
    }

    /// Resolve/unresolve a comment.
    pub async fn resolve(
        db: &DatabaseConnection,
        id: Uuid,
        resolved: bool,
    ) -> Result<bool, AppError> {
        let comment = doc_node_comments::Entity::find_by_id(id)
            .one(db)
            .await?;
        let Some(comment) = comment else {
            return Ok(false);
        };
        let now = chrono::Utc::now().fixed_offset();
        let mut active: doc_node_comments::ActiveModel = comment.into();
        active.is_resolved = Set(resolved);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(true)
    }

    /// Delete a comment.
    pub async fn delete(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let result = doc_node_comments::Entity::delete_by_id(id)
            .exec(db)
            .await?;
        Ok(result.rows_affected > 0)
    }
}
