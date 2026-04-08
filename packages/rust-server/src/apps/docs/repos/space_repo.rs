use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::doc_spaces;
use crate::error::AppError;

pub struct DocSpaceRepo;

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
        icon: Option<String>,
        color: Option<String>,
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
            icon: Set(icon),
            color: Set(color),
            description: Set(description),
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
        name: Option<String>,
        icon: Option<Option<String>>,
        color: Option<Option<String>>,
        description: Option<Option<String>>,
        sort_order: Option<i32>,
    ) -> Result<Option<doc_spaces::Model>, AppError> {
        let space = doc_spaces::Entity::find_by_id(id).one(db).await?;
        let Some(space) = space else {
            return Ok(None);
        };

        let now = chrono::Utc::now().fixed_offset();
        let mut active: doc_spaces::ActiveModel = space.into();

        if let Some(n) = name {
            active.name = Set(n);
        }
        if let Some(i) = icon {
            active.icon = Set(i);
        }
        if let Some(c) = color {
            active.color = Set(c);
        }
        if let Some(d) = description {
            active.description = Set(d);
        }
        if let Some(o) = sort_order {
            active.sort_order = Set(o);
        }
        active.updated_at = Set(Some(now));

        let updated = active.update(db).await?;
        Ok(Some(updated))
    }

    pub async fn delete(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let result = doc_spaces::Entity::delete_by_id(id).exec(db).await?;
        Ok(result.rows_affected > 0)
    }
}
