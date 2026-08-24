use sea_orm::prelude::*;
use sea_orm::sea_query::{Expr, OnConflict};
use sea_orm::*;
use std::collections::BTreeSet;
use uuid::Uuid;

use crate::db::entities::docs_node_meta;
use crate::error::AppError;

#[derive(Debug, Default)]
pub struct UpsertDocNodeMetaInput {
    pub is_favorite: Option<bool>,
    pub is_pinned: Option<bool>,
    pub is_archived: Option<bool>,
    pub icon: Option<Option<String>>,
    pub cover_image: Option<Option<String>>,
    pub tags: Option<Vec<String>>,
    pub last_opened_at: Option<Option<chrono::DateTime<chrono::FixedOffset>>>,
    pub sort_order: Option<i32>,
    pub word_count: Option<i32>,
}

pub struct DocNodeMetaRepo;

fn tags_to_json(tags: Vec<String>) -> serde_json::Value {
    serde_json::Value::Array(tags.into_iter().map(serde_json::Value::String).collect())
}

fn tags_from_json(tags: Option<serde_json::Value>) -> Vec<String> {
    tags.and_then(|value| value.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| value.as_str().map(ToOwned::to_owned))
        .collect()
}

impl DocNodeMetaRepo {
    pub async fn find<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
    ) -> Result<Option<docs_node_meta::Model>, AppError> {
        Ok(docs_node_meta::Entity::find_by_id((space_id, rel_path.to_string()))
            .one(db)
            .await?)
    }

    pub async fn find_by_paths<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_paths: &[String],
    ) -> Result<Vec<docs_node_meta::Model>, AppError> {
        if rel_paths.is_empty() {
            return Ok(Vec::new());
        }
        Ok(docs_node_meta::Entity::find()
            .filter(docs_node_meta::Column::SpaceId.eq(space_id))
            .filter(docs_node_meta::Column::RelPath.is_in(rel_paths.iter().cloned()))
            .all(db)
            .await?)
    }

    pub async fn find_by_node_id<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        node_id: Uuid,
    ) -> Result<Option<docs_node_meta::Model>, AppError> {
        Ok(docs_node_meta::Entity::find()
            .filter(docs_node_meta::Column::Id.eq(node_id))
            .filter(docs_node_meta::Column::SpaceId.eq(space_id))
            .one(db)
            .await?)
    }

    pub async fn ensure_paths<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_paths: &[String],
    ) -> Result<Vec<docs_node_meta::Model>, AppError> {
        if rel_paths.is_empty() {
            return Ok(Vec::new());
        }
        let now = chrono::Utc::now().fixed_offset();
        let rows = rel_paths.iter().map(|rel_path| docs_node_meta::ActiveModel {
            id: Set(Uuid::new_v4()),
            space_id: Set(space_id),
            rel_path: Set(rel_path.clone()),
            is_favorite: Set(false),
            is_pinned: Set(false),
            is_archived: Set(false),
            icon: Set(None),
            cover_image: Set(None),
            tags: Set(None),
            last_opened_at: Set(None),
            sort_order: Set(0),
            word_count: Set(0),
            created_at: Set(now),
            updated_at: Set(now),
        });
        docs_node_meta::Entity::insert_many(rows)
            .on_conflict(
                OnConflict::columns([docs_node_meta::Column::SpaceId, docs_node_meta::Column::RelPath])
                    .do_nothing()
                    .to_owned(),
            )
            .try_insert()
            .exec_without_returning(db)
            .await?;
        Self::find_by_paths(db, space_id, rel_paths).await
    }

    pub async fn list_favorites<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
    ) -> Result<Vec<docs_node_meta::Model>, AppError> {
        Ok(docs_node_meta::Entity::find()
            .filter(docs_node_meta::Column::SpaceId.eq(space_id))
            .filter(docs_node_meta::Column::IsFavorite.eq(true))
            .order_by_desc(docs_node_meta::Column::LastOpenedAt)
            .order_by_asc(docs_node_meta::Column::RelPath)
            .all(db)
            .await?)
    }

    pub async fn list_archived<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
    ) -> Result<Vec<docs_node_meta::Model>, AppError> {
        Ok(docs_node_meta::Entity::find()
            .filter(docs_node_meta::Column::SpaceId.eq(space_id))
            .filter(docs_node_meta::Column::IsArchived.eq(true))
            .order_by_desc(docs_node_meta::Column::UpdatedAt)
            .order_by_asc(docs_node_meta::Column::RelPath)
            .all(db)
            .await?)
    }

    pub async fn upsert<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        input: UpsertDocNodeMetaInput,
    ) -> Result<docs_node_meta::Model, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let tags = input.tags.as_ref().map(|tags| tags_to_json(tags.clone()));
        let mut update_columns = vec![docs_node_meta::Column::UpdatedAt];

        if input.is_favorite.is_some() {
            update_columns.push(docs_node_meta::Column::IsFavorite);
        }
        if input.is_pinned.is_some() {
            update_columns.push(docs_node_meta::Column::IsPinned);
        }
        if input.is_archived.is_some() {
            update_columns.push(docs_node_meta::Column::IsArchived);
        }
        if input.icon.is_some() {
            update_columns.push(docs_node_meta::Column::Icon);
        }
        if input.cover_image.is_some() {
            update_columns.push(docs_node_meta::Column::CoverImage);
        }
        if input.tags.is_some() {
            update_columns.push(docs_node_meta::Column::Tags);
        }
        if input.last_opened_at.is_some() {
            update_columns.push(docs_node_meta::Column::LastOpenedAt);
        }
        if input.sort_order.is_some() {
            update_columns.push(docs_node_meta::Column::SortOrder);
        }
        if input.word_count.is_some() {
            update_columns.push(docs_node_meta::Column::WordCount);
        }

        let model = docs_node_meta::ActiveModel {
            id: Set(Uuid::new_v4()),
            space_id: Set(space_id),
            rel_path: Set(rel_path.to_string()),
            is_favorite: Set(input.is_favorite.unwrap_or(false)),
            is_pinned: Set(input.is_pinned.unwrap_or(false)),
            is_archived: Set(input.is_archived.unwrap_or(false)),
            icon: Set(input.icon.unwrap_or(None)),
            cover_image: Set(input.cover_image.unwrap_or(None)),
            tags: Set(tags),
            last_opened_at: Set(input.last_opened_at.unwrap_or(None)),
            sort_order: Set(input.sort_order.unwrap_or(0)),
            word_count: Set(input.word_count.unwrap_or(0)),
            created_at: Set(now),
            updated_at: Set(now),
        };

        Ok(docs_node_meta::Entity::insert(model)
            .on_conflict(
                OnConflict::columns([docs_node_meta::Column::SpaceId, docs_node_meta::Column::RelPath])
                    .update_columns(update_columns)
                    .to_owned(),
            )
            .exec_with_returning(db)
            .await?)
    }

    pub async fn toggle_favorite<C: ConnectionTrait>(db: &C, space_id: Uuid, rel_path: &str) -> Result<bool, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let model = docs_node_meta::ActiveModel {
            id: Set(Uuid::new_v4()),
            space_id: Set(space_id),
            rel_path: Set(rel_path.to_string()),
            is_favorite: Set(true),
            is_pinned: Set(false),
            is_archived: Set(false),
            icon: Set(None),
            cover_image: Set(None),
            tags: Set(None),
            last_opened_at: Set(None),
            sort_order: Set(0),
            word_count: Set(0),
            created_at: Set(now),
            updated_at: Set(now),
        };

        let row = docs_node_meta::Entity::insert(model)
            .on_conflict(
                OnConflict::columns([docs_node_meta::Column::SpaceId, docs_node_meta::Column::RelPath])
                    .value(
                        docs_node_meta::Column::IsFavorite,
                        Expr::cust("NOT docs_node_meta.is_favorite"),
                    )
                    .value(docs_node_meta::Column::UpdatedAt, Expr::current_timestamp())
                    .to_owned(),
            )
            .exec_with_returning(db)
            .await?;
        Ok(row.is_favorite)
    }

    pub async fn set_archived<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        archived: bool,
    ) -> Result<(), AppError> {
        Self::upsert(
            db,
            space_id,
            rel_path,
            UpsertDocNodeMetaInput {
                is_archived: Some(archived),
                ..Default::default()
            },
        )
        .await?;
        Ok(())
    }

    pub async fn update_last_opened<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
    ) -> Result<(), AppError> {
        Self::upsert(
            db,
            space_id,
            rel_path,
            UpsertDocNodeMetaInput {
                last_opened_at: Some(Some(chrono::Utc::now().fixed_offset())),
                ..Default::default()
            },
        )
        .await?;
        Ok(())
    }

    pub async fn rename_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        old_rel: &str,
        new_rel: &str,
    ) -> Result<(), AppError> {
        docs_node_meta::Entity::update_many()
            .filter(docs_node_meta::Column::SpaceId.eq(space_id))
            .filter(docs_node_meta::Column::RelPath.eq(old_rel))
            .col_expr(docs_node_meta::Column::RelPath, Expr::value(new_rel.to_string()))
            .col_expr(docs_node_meta::Column::UpdatedAt, Expr::current_timestamp())
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
            r"UPDATE docs_node_meta
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

    pub async fn delete<C: ConnectionTrait>(db: &C, space_id: Uuid, rel_path: &str) -> Result<bool, AppError> {
        let result = docs_node_meta::Entity::delete_by_id((space_id, rel_path.to_string()))
            .exec(db)
            .await?;
        Ok(result.rows_affected > 0)
    }

    pub async fn list_tags<C: ConnectionTrait>(db: &C, space_id: Uuid) -> Result<Vec<String>, AppError> {
        let rows = docs_node_meta::Entity::find()
            .filter(docs_node_meta::Column::SpaceId.eq(space_id))
            .filter(docs_node_meta::Column::IsArchived.eq(false))
            .all(db)
            .await?;

        let mut tag_set = BTreeSet::new();
        for row in rows {
            tag_set.extend(tags_from_json(row.tags));
        }
        Ok(tag_set.into_iter().collect())
    }
}
