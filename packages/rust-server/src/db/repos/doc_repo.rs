use sea_orm::prelude::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::db::entities::{doc_folders, docs};
use crate::db::models::doc::{DocFolderOutput, DocListItem};
use crate::db::pagination::{Page, PageInput};
use crate::error::AppError;

pub struct DocRepo;

impl DocRepo {
    /// List docs with pagination, sorting, search, and filtering.
    pub async fn list(
        db: &DatabaseConnection,
        app_id: Uuid,
        page: &PageInput,
        sort_by: &str,
        sort_dir: &str,
        search: Option<&str>,
        folder_id: Option<Uuid>,
        favorites_only: bool,
    ) -> Result<Page<DocListItem>, AppError> {
        let mut query = docs::Entity::find().filter(docs::Column::AppId.eq(app_id));

        // Filter by folder (None = root docs without folder)
        if let Some(fid) = folder_id {
            query = query.filter(docs::Column::FolderId.eq(fid));
        }

        if favorites_only {
            query = query.filter(docs::Column::IsFavorite.eq(true));
        }

        // Exclude archived by default
        query = query.filter(docs::Column::IsArchived.eq(false));

        if let Some(term) = search {
            if !term.is_empty() {
                query = query.filter(docs::Column::Title.contains(term));
            }
        }

        let order = if sort_dir.eq_ignore_ascii_case("asc") {
            Order::Asc
        } else {
            Order::Desc
        };

        query = match sort_by {
            "title" => query.order_by(docs::Column::Title, order),
            "createdAt" => query.order_by(docs::Column::CreatedAt, order),
            "wordCount" => query.order_by(docs::Column::WordCount, order),
            // default: updatedAt
            _ => query.order_by(docs::Column::UpdatedAt, order),
        };

        let total = query.clone().count(db).await? as i64;
        let items = query
            .into_partial_model::<DocListItem>()
            .paginate(db, page.page_size)
            .fetch_page(page.page.saturating_sub(1))
            .await?;

        Ok(Page::new(items, total, page))
    }

    /// Get a single doc by ID (full model with content).
    pub async fn get_by_id(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<Option<docs::Model>, AppError> {
        Ok(docs::Entity::find_by_id(id).one(db).await?)
    }

    /// Create a new doc.
    pub async fn create(
        db: &DatabaseConnection,
        app_id: Uuid,
        title: String,
        folder_id: Option<Uuid>,
    ) -> Result<docs::Model, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();
        let model = docs::ActiveModel {
            id: Set(id),
            app_id: Set(app_id),
            folder_id: Set(folder_id),
            title: Set(title),
            content: Set(None),
            icon: Set(None),
            cover_image: Set(None),
            is_favorite: Set(false),
            is_pinned: Set(false),
            is_archived: Set(false),
            word_count: Set(0),
            created_at: Set(now),
            updated_at: Set(now),
        };
        docs::Entity::insert(model).exec(db).await?;
        // Re-fetch the inserted row
        docs::Entity::find_by_id(id)
            .one(db)
            .await?
            .ok_or_else(|| AppError::Internal("failed to fetch created doc".into()))
    }

    /// Update doc fields. Returns updated model.
    pub async fn update(
        db: &DatabaseConnection,
        id: Uuid,
        title: Option<String>,
        content: Option<Option<serde_json::Value>>,
        icon: Option<Option<String>>,
        cover_image: Option<Option<String>>,
        word_count: Option<i32>,
    ) -> Result<Option<docs::Model>, AppError> {
        let doc = docs::Entity::find_by_id(id).one(db).await?;
        let Some(doc) = doc else {
            return Ok(None);
        };

        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs::ActiveModel = doc.into();

        if let Some(t) = title {
            active.title = Set(t);
        }
        if let Some(c) = content {
            active.content = Set(c);
        }
        if let Some(i) = icon {
            active.icon = Set(i);
        }
        if let Some(ci) = cover_image {
            active.cover_image = Set(ci);
        }
        if let Some(wc) = word_count {
            active.word_count = Set(wc);
        }
        active.updated_at = Set(now);

        let updated = active.update(db).await?;
        Ok(Some(updated))
    }

    /// Delete a doc by ID.
    pub async fn delete(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let result = docs::Entity::delete_by_id(id).exec(db).await?;
        Ok(result.rows_affected > 0)
    }

    /// Toggle favorite status. Returns new state.
    pub async fn toggle_favorite(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<Option<bool>, AppError> {
        let doc = docs::Entity::find_by_id(id).one(db).await?;
        let Some(doc) = doc else {
            return Ok(None);
        };
        let new_state = !doc.is_favorite;
        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs::ActiveModel = doc.into();
        active.is_favorite = Set(new_state);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(Some(new_state))
    }

    /// Toggle pin status. Returns new state.
    pub async fn toggle_pin(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<Option<bool>, AppError> {
        let doc = docs::Entity::find_by_id(id).one(db).await?;
        let Some(doc) = doc else {
            return Ok(None);
        };
        let new_state = !doc.is_pinned;
        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs::ActiveModel = doc.into();
        active.is_pinned = Set(new_state);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(Some(new_state))
    }

    /// Move doc to a folder (or to root if folder_id is None).
    pub async fn move_to_folder(
        db: &DatabaseConnection,
        id: Uuid,
        folder_id: Option<Uuid>,
    ) -> Result<bool, AppError> {
        let doc = docs::Entity::find_by_id(id).one(db).await?;
        let Some(doc) = doc else {
            return Ok(false);
        };
        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs::ActiveModel = doc.into();
        active.folder_id = Set(folder_id);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(true)
    }

    /// Archive a doc.
    pub async fn archive(
        db: &DatabaseConnection,
        id: Uuid,
        archived: bool,
    ) -> Result<bool, AppError> {
        let doc = docs::Entity::find_by_id(id).one(db).await?;
        let Some(doc) = doc else {
            return Ok(false);
        };
        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs::ActiveModel = doc.into();
        active.is_archived = Set(archived);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(true)
    }
}

pub struct DocFolderRepo;

impl DocFolderRepo {
    /// List all folders for an app (flat list, frontend builds tree).
    pub async fn list(
        db: &DatabaseConnection,
        app_id: Uuid,
    ) -> Result<Vec<DocFolderOutput>, AppError> {
        let folders = doc_folders::Entity::find()
            .filter(doc_folders::Column::AppId.eq(app_id))
            .order_by_asc(doc_folders::Column::SortOrder)
            .order_by_asc(doc_folders::Column::Name)
            .into_partial_model::<DocFolderOutput>()
            .all(db)
            .await?;
        Ok(folders)
    }

    /// Create a new folder.
    pub async fn create(
        db: &DatabaseConnection,
        app_id: Uuid,
        name: String,
        parent_id: Option<Uuid>,
        icon: Option<String>,
    ) -> Result<doc_folders::Model, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();

        // Determine sort_order: max + 1 among siblings
        let max_order = doc_folders::Entity::find()
            .filter(doc_folders::Column::AppId.eq(app_id))
            .filter(if let Some(pid) = parent_id {
                doc_folders::Column::ParentId.eq(pid)
            } else {
                doc_folders::Column::ParentId.is_null()
            })
            .order_by_desc(doc_folders::Column::SortOrder)
            .one(db)
            .await?
            .map(|f| f.sort_order + 1)
            .unwrap_or(0);

        let model = doc_folders::ActiveModel {
            id: Set(id),
            app_id: Set(app_id),
            parent_id: Set(parent_id),
            name: Set(name),
            icon: Set(icon),
            sort_order: Set(max_order),
            created_at: Set(now),
            updated_at: Set(now),
        };
        doc_folders::Entity::insert(model).exec(db).await?;
        doc_folders::Entity::find_by_id(id)
            .one(db)
            .await?
            .ok_or_else(|| AppError::Internal("failed to fetch created folder".into()))
    }

    /// Update folder fields.
    pub async fn update(
        db: &DatabaseConnection,
        id: Uuid,
        name: Option<String>,
        icon: Option<Option<String>>,
        sort_order: Option<i32>,
    ) -> Result<Option<doc_folders::Model>, AppError> {
        let folder = doc_folders::Entity::find_by_id(id).one(db).await?;
        let Some(folder) = folder else {
            return Ok(None);
        };

        let now = chrono::Utc::now().fixed_offset();
        let mut active: doc_folders::ActiveModel = folder.into();

        if let Some(n) = name {
            active.name = Set(n);
        }
        if let Some(i) = icon {
            active.icon = Set(i);
        }
        if let Some(s) = sort_order {
            active.sort_order = Set(s);
        }
        active.updated_at = Set(now);

        let updated = active.update(db).await?;
        Ok(Some(updated))
    }

    /// Delete a folder. Moves child docs to root (folder_id = NULL).
    pub async fn delete(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let folder = doc_folders::Entity::find_by_id(id).one(db).await?;
        if folder.is_none() {
            return Ok(false);
        }

        // Move child docs to root
        docs::Entity::update_many()
            .col_expr(docs::Column::FolderId, Expr::value(Option::<Uuid>::None))
            .filter(docs::Column::FolderId.eq(id))
            .exec(db)
            .await?;

        // Move child folders to root
        doc_folders::Entity::update_many()
            .col_expr(
                doc_folders::Column::ParentId,
                Expr::value(Option::<Uuid>::None),
            )
            .filter(doc_folders::Column::ParentId.eq(id))
            .exec(db)
            .await?;

        doc_folders::Entity::delete_by_id(id).exec(db).await?;
        Ok(true)
    }
}
