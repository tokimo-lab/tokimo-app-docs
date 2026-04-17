use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::docs_node_versions;
use crate::error::AppError;
use crate::error::OptionExt;

pub struct DocNodeVersionRepo;

impl DocNodeVersionRepo {
    /// Create a new version snapshot for a node.
    pub async fn create(
        db: &DatabaseConnection,
        node_id: Uuid,
        title: String,
        content: Option<serde_json::Value>,
        word_count: i32,
    ) -> Result<docs_node_versions::Model, AppError> {
        let max_version = docs_node_versions::Entity::find()
            .filter(docs_node_versions::Column::NodeId.eq(node_id))
            .order_by_desc(docs_node_versions::Column::Version)
            .one(db)
            .await?
            .map_or(0, |v| v.version);

        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();
        let model = docs_node_versions::ActiveModel {
            id: Set(id),
            node_id: Set(node_id),
            version: Set(max_version + 1),
            title: Set(title),
            content: Set(content),
            word_count: Set(word_count),
            created_at: Set(now),
        };
        docs_node_versions::Entity::insert(model).exec(db).await?;
        docs_node_versions::Entity::find_by_id(id)
            .one(db)
            .await?
            .internal("failed to fetch created version")
    }

    /// Create a version only if enough time has passed since the last one (10 minutes).
    pub async fn create_if_due(
        db: &DatabaseConnection,
        node_id: Uuid,
        title: String,
        content: Option<serde_json::Value>,
        word_count: i32,
    ) -> Result<Option<docs_node_versions::Model>, AppError> {
        let latest = docs_node_versions::Entity::find()
            .filter(docs_node_versions::Column::NodeId.eq(node_id))
            .order_by_desc(docs_node_versions::Column::Version)
            .one(db)
            .await?;

        let now = chrono::Utc::now().fixed_offset();
        let should_create = match latest {
            Some(ref v) => {
                let elapsed = now - v.created_at;
                elapsed.num_minutes() >= 10
            }
            None => true,
        };

        if should_create {
            let version = Self::create(db, node_id, title, content, word_count).await?;
            Self::delete_old_versions(db, node_id, 50).await?;
            Ok(Some(version))
        } else {
            Ok(None)
        }
    }

    /// List all versions for a node (without content), ordered by version DESC.
    pub async fn list(db: &DatabaseConnection, node_id: Uuid) -> Result<Vec<docs_node_versions::Model>, AppError> {
        let versions = docs_node_versions::Entity::find()
            .filter(docs_node_versions::Column::NodeId.eq(node_id))
            .order_by_desc(docs_node_versions::Column::Version)
            .all(db)
            .await?;
        Ok(versions)
    }

    /// Get a single version by ID (with content).
    pub async fn get_by_id(db: &DatabaseConnection, id: Uuid) -> Result<Option<docs_node_versions::Model>, AppError> {
        Ok(docs_node_versions::Entity::find_by_id(id).one(db).await?)
    }

    /// Keep only the latest N versions for a node, deleting older ones.
    pub async fn delete_old_versions(
        db: &DatabaseConnection,
        node_id: Uuid,
        keep_count: usize,
    ) -> Result<u64, AppError> {
        let versions = docs_node_versions::Entity::find()
            .filter(docs_node_versions::Column::NodeId.eq(node_id))
            .order_by_desc(docs_node_versions::Column::Version)
            .all(db)
            .await?;

        if versions.len() <= keep_count {
            return Ok(0);
        }

        let to_delete: Vec<Uuid> = versions[keep_count..].iter().map(|v| v.id).collect();
        let result = docs_node_versions::Entity::delete_many()
            .filter(docs_node_versions::Column::Id.is_in(to_delete))
            .exec(db)
            .await?;
        Ok(result.rows_affected)
    }
}
