use sea_orm::prelude::*;
use sea_orm::sea_query::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::docs_node_versions;
use crate::error::AppError;
use crate::error::OptionExt;

pub struct DocNodeVersionRepo;

impl DocNodeVersionRepo {
    /// Create a new version snapshot for a VFS-backed doc path.
    pub async fn create<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        title: String,
        content: Option<serde_json::Value>,
        word_count: i32,
    ) -> Result<docs_node_versions::Model, AppError> {
        let max_version = docs_node_versions::Entity::find()
            .filter(docs_node_versions::Column::SpaceId.eq(space_id))
            .filter(docs_node_versions::Column::RelPath.eq(rel_path))
            .order_by_desc(docs_node_versions::Column::Version)
            .one(db)
            .await?
            .map_or(0, |v| v.version);

        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();
        let model = docs_node_versions::ActiveModel {
            id: Set(id),
            space_id: Set(space_id),
            rel_path: Set(rel_path.to_string()),
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
    pub async fn create_if_due<C: ConnectionTrait + TransactionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        title: String,
        content: Option<serde_json::Value>,
        word_count: i32,
    ) -> Result<Option<docs_node_versions::Model>, AppError> {
        let latest = docs_node_versions::Entity::find()
            .filter(docs_node_versions::Column::SpaceId.eq(space_id))
            .filter(docs_node_versions::Column::RelPath.eq(rel_path))
            .order_by_desc(docs_node_versions::Column::Version)
            .one(db)
            .await?;

        let now = chrono::Utc::now().fixed_offset();
        let should_create = match latest {
            Some(ref v) => (now - v.created_at).num_minutes() >= 10,
            None => true,
        };

        if should_create {
            let version = Self::create(db, space_id, rel_path, title, content, word_count).await?;
            Self::delete_old_versions(db, space_id, rel_path, 50).await?;
            Ok(Some(version))
        } else {
            Ok(None)
        }
    }

    /// List all versions for a path (without content), ordered by version DESC.
    pub async fn list<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
    ) -> Result<Vec<docs_node_versions::Model>, AppError> {
        Ok(docs_node_versions::Entity::find()
            .filter(docs_node_versions::Column::SpaceId.eq(space_id))
            .filter(docs_node_versions::Column::RelPath.eq(rel_path))
            .order_by_desc(docs_node_versions::Column::Version)
            .all(db)
            .await?)
    }

    /// Get a single version by ID (with content).
    pub async fn get_by_id<C: ConnectionTrait>(
        db: &C,
        id: Uuid,
    ) -> Result<Option<docs_node_versions::Model>, AppError> {
        Ok(docs_node_versions::Entity::find_by_id(id).one(db).await?)
    }

    /// Keep only the latest N versions for a path, deleting older ones.
    pub async fn delete_old_versions<C: ConnectionTrait + TransactionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        keep_count: usize,
    ) -> Result<u64, AppError> {
        let txn = db.begin().await?;
        let versions = docs_node_versions::Entity::find()
            .filter(docs_node_versions::Column::SpaceId.eq(space_id))
            .filter(docs_node_versions::Column::RelPath.eq(rel_path))
            .order_by_desc(docs_node_versions::Column::Version)
            .all(&txn)
            .await?;

        if versions.len() <= keep_count {
            txn.commit().await?;
            return Ok(0);
        }

        let to_delete: Vec<Uuid> = versions[keep_count..].iter().map(|v| v.id).collect();
        let result = docs_node_versions::Entity::delete_many()
            .filter(docs_node_versions::Column::Id.is_in(to_delete))
            .exec(&txn)
            .await?;
        txn.commit().await?;
        Ok(result.rows_affected)
    }

    pub async fn rename_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        old_rel: &str,
        new_rel: &str,
    ) -> Result<(), AppError> {
        docs_node_versions::Entity::update_many()
            .filter(docs_node_versions::Column::SpaceId.eq(space_id))
            .filter(docs_node_versions::Column::RelPath.eq(old_rel))
            .col_expr(docs_node_versions::Column::RelPath, Expr::value(new_rel.to_string()))
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
            r"UPDATE docs_node_versions
               SET rel_path = $3 || substring(rel_path from char_length($2) + 1)
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
