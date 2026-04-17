use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::docs_spaces;
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
    pub async fn list_all(db: &DatabaseConnection) -> Result<Vec<docs_spaces::Model>, AppError> {
        Ok(docs_spaces::Entity::find()
            .order_by_asc(docs_spaces::Column::SortOrder)
            .order_by_asc(docs_spaces::Column::CreatedAt)
            .all(db)
            .await?)
    }

    pub async fn get_by_id(db: &DatabaseConnection, id: Uuid) -> Result<Option<docs_spaces::Model>, AppError> {
        Ok(docs_spaces::Entity::find_by_id(id).one(db).await?)
    }

    pub async fn create(
        db: &DatabaseConnection,
        name: String,
        slug: Option<String>,
        avatar: Option<serde_json::Value>,
        description: Option<String>,
    ) -> Result<docs_spaces::Model, AppError> {
        use crate::error::OptionExt;

        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();

        let max_order = docs_spaces::Entity::find()
            .order_by_desc(docs_spaces::Column::SortOrder)
            .one(db)
            .await?
            .map_or(0, |s| s.sort_order + 1);

        let model = docs_spaces::ActiveModel {
            id: Set(id),
            name: Set(name),
            slug: Set(slug),
            avatar: Set(avatar),
            description: Set(description),
            sort_order: Set(max_order),
            created_at: Set(Some(now)),
            updated_at: Set(Some(now)),
        };
        docs_spaces::Entity::insert(model).exec(db).await?;

        docs_spaces::Entity::find_by_id(id)
            .one(db)
            .await?
            .internal("failed to fetch created doc space")
    }

    pub async fn update(
        db: &DatabaseConnection,
        id: Uuid,
        params: UpdateSpaceParams,
    ) -> Result<Option<docs_spaces::Model>, AppError> {
        let space = docs_spaces::Entity::find_by_id(id).one(db).await?;
        let Some(space) = space else {
            return Ok(None);
        };

        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs_spaces::ActiveModel = space.into();

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

    /// List all spaces with a valid slug (for VFS mounting).
    pub async fn list_with_slug(db: &DatabaseConnection) -> Result<Vec<docs_spaces::Model>, AppError> {
        Ok(docs_spaces::Entity::find()
            .filter(docs_spaces::Column::Slug.is_not_null())
            .all(db)
            .await?)
    }

    pub async fn delete(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let result = docs_spaces::Entity::delete_by_id(id).exec(db).await?;
        Ok(result.rows_affected > 0)
    }
}
