use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::doc_spaces;
use crate::error::AppError;

pub struct DocSpaceRepo;

pub struct UpdateSpaceParams {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub avatar: Option<Option<serde_json::Value>>,
    pub description: Option<Option<String>>,
    pub sort_order: Option<i32>,
}

impl DocSpaceRepo {
    pub async fn list_all(
        db: &DatabaseConnection,
    ) -> Result<Vec<doc_spaces::Model>, AppError> {
        Ok(doc_spaces::Entity::find()
            .order_by_asc(doc_spaces::Column::SortOrder)
            .order_by_asc(doc_spaces::Column::CreatedAt)
            .all(db)
            .await?)
    }

    pub async fn get_by_id(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<Option<doc_spaces::Model>, AppError> {
        Ok(doc_spaces::Entity::find_by_id(id).one(db).await?)
    }

    pub async fn create(
        db: &DatabaseConnection,
        name: String,
        slug: Option<String>,
        avatar: Option<serde_json::Value>,
        description: Option<String>,
    ) -> Result<doc_spaces::Model, AppError> {
        use crate::error::OptionExt;

        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();

        let max_order = doc_spaces::Entity::find()
            .order_by_desc(doc_spaces::Column::SortOrder)
            .one(db)
            .await?
            .map_or(0, |s| s.sort_order + 1);

        let model = doc_spaces::ActiveModel {
            id: Set(id),
            name: Set(name),
            slug: Set(slug),
            avatar: Set(avatar),
            description: Set(description),
            s3_synced: Set(true),
            sort_order: Set(max_order),
            created_at: Set(Some(now)),
            updated_at: Set(Some(now)),
        };
        doc_spaces::Entity::insert(model).exec(db).await?;

        doc_spaces::Entity::find_by_id(id)
            .one(db)
            .await?
            .internal("failed to fetch created doc space")
    }

    pub async fn update(
        db: &DatabaseConnection,
        id: Uuid,
        params: UpdateSpaceParams,
    ) -> Result<Option<doc_spaces::Model>, AppError> {
        let space = doc_spaces::Entity::find_by_id(id).one(db).await?;
        let Some(space) = space else {
            return Ok(None);
        };

        let now = chrono::Utc::now().fixed_offset();
        let mut active: doc_spaces::ActiveModel = space.into();

        if let Some(n) = params.name {
            active.name = Set(n);
        }
        if let Some(s) = params.slug {
            active.slug = Set(Some(s));
        }
        if let Some(a) = params.avatar {
            active.avatar = Set(a);
        }
        if let Some(d) = params.description {
            active.description = Set(d);
        }
        if let Some(o) = params.sort_order {
            active.sort_order = Set(o);
        }
        active.updated_at = Set(Some(now));

        let updated = active.update(db).await?;
        Ok(Some(updated))
    }

    /// List all spaces with s3_synced enabled and a valid slug.
    pub async fn list_synced(
        db: &DatabaseConnection,
    ) -> Result<Vec<doc_spaces::Model>, AppError> {
        Ok(doc_spaces::Entity::find()
            .filter(doc_spaces::Column::S3Synced.eq(true))
            .filter(doc_spaces::Column::Slug.is_not_null())
            .all(db)
            .await?)
    }

    pub async fn delete(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let result = doc_spaces::Entity::delete_by_id(id).exec(db).await?;
        Ok(result.rows_affected > 0)
    }
}
