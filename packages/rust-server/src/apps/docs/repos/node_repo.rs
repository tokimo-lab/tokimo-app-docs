use sea_orm::prelude::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::apps::docs::models::DocNodeListItem;
use crate::db::entities::doc_nodes;
use crate::db::pagination::{Page, PageInput};
use crate::error::AppError;
use crate::error::OptionExt;

/// Input for listing doc nodes.
#[derive(Debug)]
pub struct ListDocNodesInput {
    pub space_id: Uuid,
    pub page: PageInput,
    pub sort_by: String,
    pub sort_dir: String,
    pub search: Option<String>,
    pub parent_id: Option<Option<Uuid>>,
    pub node_type: Option<String>,
    pub favorites_only: bool,
    pub tags_filter: Option<Vec<String>>,
    pub archived: bool,
}

/// Input for updating a doc node (all fields optional).
#[derive(Debug)]
pub struct UpdateDocNodeInput {
    pub title: Option<String>,
    pub content: Option<Option<serde_json::Value>>,
    pub icon: Option<Option<String>>,
    pub cover_image: Option<Option<String>>,
    pub word_count: Option<i32>,
    pub search_text: Option<String>,
    pub tags: Option<Vec<String>>,
}

pub struct DocNodeRepo;

impl DocNodeRepo {
    /// List nodes with pagination, sorting, search, and filtering.
    pub async fn list(db: &DatabaseConnection, input: ListDocNodesInput) -> Result<Page<DocNodeListItem>, AppError> {
        let mut query = doc_nodes::Entity::find().filter(doc_nodes::Column::SpaceId.eq(input.space_id));

        if let Some(pid) = input.parent_id {
            if let Some(id) = pid {
                query = query.filter(doc_nodes::Column::ParentId.eq(id));
            } else {
                query = query.filter(doc_nodes::Column::ParentId.is_null());
            }
        }

        if let Some(t) = input.node_type {
            query = query.filter(doc_nodes::Column::Type.eq(t));
        }

        if input.favorites_only {
            query = query.filter(doc_nodes::Column::IsFavorite.eq(true));
        }

        query = query.filter(doc_nodes::Column::IsArchived.eq(input.archived));

        if let Some(term) = input.search
            && !term.is_empty()
        {
            let pattern = format!("%{term}%");
            let sql = format!(
                "(title ILIKE '{}' OR search_text ILIKE '{}')",
                pattern.replace('\'', "''"),
                pattern.replace('\'', "''")
            );
            query = query.filter(Expr::cust(sql));
        }

        if let Some(tags) = input.tags_filter {
            for tag in tags {
                let escaped = tag.replace('\'', "''");
                let sql = format!("'{escaped}' = ANY(tags)");
                query = query.filter(Expr::cust(sql));
            }
        }

        let order = if input.sort_dir.eq_ignore_ascii_case("asc") {
            Order::Asc
        } else {
            Order::Desc
        };

        query = match input.sort_by.as_str() {
            "title" => query.order_by(doc_nodes::Column::Title, order),
            "createdAt" | "created" => query.order_by(doc_nodes::Column::CreatedAt, order),
            "wordCount" => query.order_by(doc_nodes::Column::WordCount, order),
            "sortOrder" => query.order_by(doc_nodes::Column::SortOrder, order),
            _ => query.order_by(doc_nodes::Column::UpdatedAt, order),
        };

        let total = query.clone().count(db).await? as i64;
        let items = query
            .into_partial_model::<DocNodeListItem>()
            .paginate(db, input.page.page_size)
            .fetch_page(input.page.page.saturating_sub(1))
            .await?;

        Ok(Page::new(items, total, &input.page))
    }

    /// Get all unique tags for a space's nodes.
    pub async fn list_tags(db: &DatabaseConnection, space_id: Uuid) -> Result<Vec<String>, AppError> {
        let nodes = doc_nodes::Entity::find()
            .filter(doc_nodes::Column::SpaceId.eq(space_id))
            .filter(doc_nodes::Column::IsArchived.eq(false))
            .all(db)
            .await?;

        let mut tag_set = std::collections::BTreeSet::new();
        for node in nodes {
            if let Some(tags) = node.tags {
                for tag in tags {
                    tag_set.insert(tag);
                }
            }
        }
        Ok(tag_set.into_iter().collect())
    }

    /// Get a single node by ID (full model with content).
    pub async fn get_by_id(db: &DatabaseConnection, id: Uuid) -> Result<Option<doc_nodes::Model>, AppError> {
        Ok(doc_nodes::Entity::find_by_id(id).one(db).await?)
    }

    /// Create a new node. Calculates `sort_order` as max+1 among siblings.
    pub async fn create(
        db: &DatabaseConnection,
        space_id: Uuid,
        node_type: String,
        title: String,
        parent_id: Option<Uuid>,
    ) -> Result<doc_nodes::Model, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();

        let max_order = doc_nodes::Entity::find()
            .filter(doc_nodes::Column::SpaceId.eq(space_id))
            .filter(if let Some(pid) = parent_id {
                doc_nodes::Column::ParentId.eq(pid)
            } else {
                doc_nodes::Column::ParentId.is_null()
            })
            .order_by_desc(doc_nodes::Column::SortOrder)
            .one(db)
            .await?
            .map_or(0, |n| n.sort_order + 1);

        let model = doc_nodes::ActiveModel {
            id: Set(id),
            space_id: Set(space_id),
            parent_id: Set(parent_id),
            r#type: Set(node_type),
            title: Set(title),
            content: Set(None),
            icon: Set(None),
            cover_image: Set(None),
            tags: Set(Some(vec![])),
            search_text: Set(None),
            is_favorite: Set(false),
            is_pinned: Set(false),
            is_archived: Set(false),
            word_count: Set(0),
            sort_order: Set(max_order),
            yjs_state: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        };
        doc_nodes::Entity::insert(model).exec(db).await?;
        doc_nodes::Entity::find_by_id(id)
            .one(db)
            .await?
            .internal("failed to fetch created node")
    }

    /// Update node fields. Returns updated model.
    pub async fn update(
        db: &DatabaseConnection,
        id: Uuid,
        input: UpdateDocNodeInput,
    ) -> Result<Option<doc_nodes::Model>, AppError> {
        let node = doc_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(None);
        };

        let now = chrono::Utc::now().fixed_offset();
        let mut active: doc_nodes::ActiveModel = node.into();

        if let Some(t) = input.title {
            active.title = Set(t);
        }
        if let Some(c) = input.content {
            active.content = Set(c);
        }
        if let Some(i) = input.icon {
            active.icon = Set(i);
        }
        if let Some(ci) = input.cover_image {
            active.cover_image = Set(ci);
        }
        if let Some(wc) = input.word_count {
            active.word_count = Set(wc);
        }
        if let Some(st) = input.search_text {
            active.search_text = Set(Some(st));
        }
        if let Some(t) = input.tags {
            active.tags = Set(Some(t));
        }
        active.updated_at = Set(now);

        let updated = active.update(db).await?;
        Ok(Some(updated))
    }

    /// Archive a node (soft delete).
    pub async fn archive(db: &DatabaseConnection, id: Uuid, archived: bool) -> Result<bool, AppError> {
        let node = doc_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(false);
        };
        let now = chrono::Utc::now().fixed_offset();
        let mut active: doc_nodes::ActiveModel = node.into();
        active.is_archived = Set(archived);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(true)
    }

    /// Permanent delete. Reparents children to deleted node's parent.
    pub async fn delete(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let node = doc_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(false);
        };

        doc_nodes::Entity::update_many()
            .col_expr(doc_nodes::Column::ParentId, Expr::value(node.parent_id))
            .filter(doc_nodes::Column::ParentId.eq(id))
            .exec(db)
            .await?;

        doc_nodes::Entity::delete_by_id(id).exec(db).await?;
        Ok(true)
    }

    /// Toggle favorite status. Returns new state.
    pub async fn toggle_favorite(db: &DatabaseConnection, id: Uuid) -> Result<Option<bool>, AppError> {
        let node = doc_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(None);
        };
        let new_state = !node.is_favorite;
        let now = chrono::Utc::now().fixed_offset();
        let mut active: doc_nodes::ActiveModel = node.into();
        active.is_favorite = Set(new_state);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(Some(new_state))
    }

    /// Toggle pin status. Returns new state.
    pub async fn toggle_pin(db: &DatabaseConnection, id: Uuid) -> Result<Option<bool>, AppError> {
        let node = doc_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(None);
        };
        let new_state = !node.is_pinned;
        let now = chrono::Utc::now().fixed_offset();
        let mut active: doc_nodes::ActiveModel = node.into();
        active.is_pinned = Set(new_state);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(Some(new_state))
    }

    /// Move node to a new parent (or to root if `parent_id` is None).
    pub async fn move_node(
        db: &DatabaseConnection,
        id: Uuid,
        parent_id: Option<Uuid>,
        sort_order: Option<i32>,
    ) -> Result<bool, AppError> {
        let node = doc_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(false);
        };
        let now = chrono::Utc::now().fixed_offset();

        if let Some(order) = sort_order {
            let txn = db.begin().await?;
            doc_nodes::Entity::update_many()
                .filter(
                    if let Some(pid) = parent_id {
                        doc_nodes::Column::ParentId.eq(pid)
                    } else {
                        doc_nodes::Column::ParentId.is_null()
                    }
                    .and(doc_nodes::Column::Id.ne(id))
                    .and(doc_nodes::Column::SortOrder.gte(order)),
                )
                .col_expr(
                    doc_nodes::Column::SortOrder,
                    Expr::col(doc_nodes::Column::SortOrder).add(1),
                )
                .exec(&txn)
                .await?;

            let mut active: doc_nodes::ActiveModel = node.into();
            active.parent_id = Set(parent_id);
            active.sort_order = Set(order);
            active.updated_at = Set(now);
            active.update(&txn).await?;
            txn.commit().await?;
        } else {
            let mut active: doc_nodes::ActiveModel = node.into();
            active.parent_id = Set(parent_id);
            active.updated_at = Set(now);
            active.update(db).await?;
        }
        Ok(true)
    }
}
