use sea_orm::prelude::Expr;
use sea_orm::*;
use std::collections::HashSet;
use uuid::Uuid;

use crate::apps::docs::models::DocNodeListItem;
use crate::db::entities::docs_nodes;
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
        let mut query = docs_nodes::Entity::find().filter(docs_nodes::Column::SpaceId.eq(input.space_id));

        if let Some(pid) = input.parent_id {
            if let Some(id) = pid {
                query = query.filter(docs_nodes::Column::ParentId.eq(id));
            } else {
                query = query.filter(docs_nodes::Column::ParentId.is_null());
            }
        }

        if let Some(t) = input.node_type {
            query = query.filter(docs_nodes::Column::Type.eq(t));
        }

        if input.favorites_only {
            query = query.filter(docs_nodes::Column::IsFavorite.eq(true));
        }

        query = query.filter(docs_nodes::Column::IsArchived.eq(input.archived));

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
            "title" => query.order_by(docs_nodes::Column::Title, order),
            "createdAt" | "created" => query.order_by(docs_nodes::Column::CreatedAt, order),
            "wordCount" => query.order_by(docs_nodes::Column::WordCount, order),
            "sortOrder" => query.order_by(docs_nodes::Column::SortOrder, order),
            _ => query.order_by(docs_nodes::Column::UpdatedAt, order),
        };

        let total = query.clone().count(db).await? as i64;
        let models = query
            .paginate(db, input.page.page_size)
            .fetch_page(input.page.page.saturating_sub(1))
            .await?;

        let items = models
            .into_iter()
            .map(|m: docs_nodes::Model| DocNodeListItem {
                id: m.id.to_string(),
                space_id: m.space_id.to_string(),
                parent_id: m.parent_id.map(|p| p.to_string()),
                r#type: m.r#type,
                title: m.title,
                icon: m.icon,
                tags: m.tags,
                is_favorite: m.is_favorite,
                is_pinned: m.is_pinned,
                is_archived: m.is_archived,
                word_count: m.word_count,
                sort_order: m.sort_order,
                last_opened_at: m.last_opened_at.as_ref().map(chrono::DateTime::to_rfc3339),
                created_at: m.created_at.to_rfc3339(),
                updated_at: m.updated_at.to_rfc3339(),
            })
            .collect();

        Ok(Page::new(items, total, &input.page))
    }

    /// Get all unique tags for a space's nodes.
    pub async fn list_tags(db: &DatabaseConnection, space_id: Uuid) -> Result<Vec<String>, AppError> {
        let nodes = docs_nodes::Entity::find()
            .filter(docs_nodes::Column::SpaceId.eq(space_id))
            .filter(docs_nodes::Column::IsArchived.eq(false))
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
    pub async fn get_by_id(db: &DatabaseConnection, id: Uuid) -> Result<Option<docs_nodes::Model>, AppError> {
        Ok(docs_nodes::Entity::find_by_id(id).one(db).await?)
    }

    /// Create a new node. Calculates `sort_order` as max+1 among siblings.
    pub async fn create(
        db: &DatabaseConnection,
        space_id: Uuid,
        node_type: String,
        title: String,
        parent_id: Option<Uuid>,
        relative_path: Option<String>,
    ) -> Result<docs_nodes::Model, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();

        let max_order = docs_nodes::Entity::find()
            .filter(docs_nodes::Column::SpaceId.eq(space_id))
            .filter(if let Some(pid) = parent_id {
                docs_nodes::Column::ParentId.eq(pid)
            } else {
                docs_nodes::Column::ParentId.is_null()
            })
            .order_by_desc(docs_nodes::Column::SortOrder)
            .one(db)
            .await?
            .map_or(0, |n| n.sort_order + 1);

        let model = docs_nodes::ActiveModel {
            id: Set(id),
            space_id: Set(space_id),
            parent_id: Set(parent_id),
            r#type: Set(node_type),
            title: Set(title),
            content: Set(None),
            relative_path: Set(relative_path),
            icon: Set(None),
            cover_image: Set(None),
            tags: Set(Some(vec![])),
            search_text: Set(None),
            is_favorite: Set(false),
            is_pinned: Set(false),
            is_archived: Set(false),
            word_count: Set(0),
            sort_order: Set(max_order),
            last_opened_at: Set(None),
            yjs_state: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        };
        docs_nodes::Entity::insert(model).exec(db).await?;
        docs_nodes::Entity::find_by_id(id)
            .one(db)
            .await?
            .internal("failed to fetch created node")
    }

    /// Update node fields. Returns updated model.
    pub async fn update(
        db: &DatabaseConnection,
        id: Uuid,
        input: UpdateDocNodeInput,
    ) -> Result<Option<docs_nodes::Model>, AppError> {
        let node = docs_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(None);
        };

        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs_nodes::ActiveModel = node.into();

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
        let node = docs_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(false);
        };
        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs_nodes::ActiveModel = node.into();
        active.is_archived = Set(archived);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(true)
    }

    /// Permanent delete. Reparents children to deleted node's parent.
    pub async fn delete(db: &DatabaseConnection, id: Uuid) -> Result<bool, AppError> {
        let node = docs_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(false);
        };

        docs_nodes::Entity::update_many()
            .col_expr(docs_nodes::Column::ParentId, Expr::value(node.parent_id))
            .filter(docs_nodes::Column::ParentId.eq(id))
            .exec(db)
            .await?;

        docs_nodes::Entity::delete_by_id(id).exec(db).await?;
        Ok(true)
    }

    /// Toggle favorite status. Returns new state.
    pub async fn toggle_favorite(db: &DatabaseConnection, id: Uuid) -> Result<Option<bool>, AppError> {
        let node = docs_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(None);
        };
        let new_state = !node.is_favorite;
        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs_nodes::ActiveModel = node.into();
        active.is_favorite = Set(new_state);
        active.updated_at = Set(now);
        active.update(db).await?;
        Ok(Some(new_state))
    }

    /// Toggle pin status. Returns new state.
    pub async fn toggle_pin(db: &DatabaseConnection, id: Uuid) -> Result<Option<bool>, AppError> {
        let node = docs_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(None);
        };
        let new_state = !node.is_pinned;
        let now = chrono::Utc::now().fixed_offset();
        let mut active: docs_nodes::ActiveModel = node.into();
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
        let node = docs_nodes::Entity::find_by_id(id).one(db).await?;
        let Some(node) = node else {
            return Ok(false);
        };
        let now = chrono::Utc::now().fixed_offset();

        if let Some(order) = sort_order {
            let txn = db.begin().await?;
            docs_nodes::Entity::update_many()
                .filter(
                    if let Some(pid) = parent_id {
                        docs_nodes::Column::ParentId.eq(pid)
                    } else {
                        docs_nodes::Column::ParentId.is_null()
                    }
                    .and(docs_nodes::Column::Id.ne(id))
                    .and(docs_nodes::Column::SortOrder.gte(order)),
                )
                .col_expr(
                    docs_nodes::Column::SortOrder,
                    Expr::col(docs_nodes::Column::SortOrder).add(1),
                )
                .exec(&txn)
                .await?;

            let mut active: docs_nodes::ActiveModel = node.into();
            active.parent_id = Set(parent_id);
            active.sort_order = Set(order);
            active.updated_at = Set(now);
            active.update(&txn).await?;
            txn.commit().await?;
        } else {
            let mut active: docs_nodes::ActiveModel = node.into();
            active.parent_id = Set(parent_id);
            active.updated_at = Set(now);
            active.update(db).await?;
        }
        Ok(true)
    }

    /// Get all non-archived sibling titles for uniqueness checking.
    pub async fn get_sibling_titles(
        db: &DatabaseConnection,
        space_id: Uuid,
        parent_id: Option<Uuid>,
        exclude_id: Option<Uuid>,
    ) -> Result<HashSet<String>, AppError> {
        let mut q = docs_nodes::Entity::find()
            .filter(docs_nodes::Column::SpaceId.eq(space_id))
            .filter(docs_nodes::Column::IsArchived.eq(false));
        q = if let Some(pid) = parent_id {
            q.filter(docs_nodes::Column::ParentId.eq(pid))
        } else {
            q.filter(docs_nodes::Column::ParentId.is_null())
        };
        if let Some(eid) = exclude_id {
            q = q.filter(docs_nodes::Column::Id.ne(eid));
        }
        let nodes = q.all(db).await?;
        Ok(nodes.into_iter().map(|n| n.title).collect())
    }

    /// Recursively collect all descendant nodes (BFS) for a given parent node.
    pub async fn get_descendants(db: &DatabaseConnection, node_id: Uuid) -> Result<Vec<docs_nodes::Model>, AppError> {
        let mut result = Vec::new();
        let mut frontier = vec![node_id];
        while !frontier.is_empty() {
            let children = docs_nodes::Entity::find()
                .filter(docs_nodes::Column::ParentId.is_in(frontier))
                .all(db)
                .await?;
            frontier = children.iter().map(|n| n.id).collect();
            result.extend(children);
        }
        Ok(result)
    }

    /// Update only `relative_path` (and `updated_at`) for a node.
    pub async fn set_relative_path<C: ConnectionTrait>(
        db: &C,
        id: Uuid,
        relative_path: Option<String>,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().fixed_offset();
        docs_nodes::Entity::update_many()
            .filter(docs_nodes::Column::Id.eq(id))
            .col_expr(docs_nodes::Column::RelativePath, Expr::value(relative_path))
            .col_expr(docs_nodes::Column::UpdatedAt, Expr::value(now))
            .exec(db)
            .await?;
        Ok(())
    }

    /// Bulk-update `relative_path` for a list of (id, new_path) pairs within a transaction.
    pub async fn bulk_set_relative_paths<C: ConnectionTrait>(
        db: &C,
        updates: &[(Uuid, Option<String>)],
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().fixed_offset();
        for (id, new_path) in updates {
            docs_nodes::Entity::update_many()
                .filter(docs_nodes::Column::Id.eq(*id))
                .col_expr(docs_nodes::Column::RelativePath, Expr::value(new_path.clone()))
                .col_expr(docs_nodes::Column::UpdatedAt, Expr::value(now))
                .exec(db)
                .await?;
        }
        Ok(())
    }

    /// Rebase descendant metadata paths from one folder prefix to another.
    pub async fn rebase_relative_path_prefix<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        old_prefix: &str,
        new_prefix: &str,
    ) -> Result<(), AppError> {
        let old_descendant_prefix = format!("{old_prefix}/");
        let new_descendant_prefix = format!("{new_prefix}/");
        let rows = docs_nodes::Entity::find()
            .filter(docs_nodes::Column::SpaceId.eq(space_id))
            .filter(docs_nodes::Column::RelativePath.starts_with(&old_descendant_prefix))
            .all(db)
            .await?;
        let updates: Vec<_> = rows
            .into_iter()
            .filter_map(|row| {
                let relative_path = row.relative_path?;
                let suffix = relative_path.strip_prefix(&old_descendant_prefix)?;
                Some((row.id, Some(format!("{new_descendant_prefix}{suffix}"))))
            })
            .collect();
        Self::bulk_set_relative_paths(db, &updates).await
    }

    /// Archive a node together with pre-read content (for file-backed nodes).
    ///
    /// Sets `is_archived = true` and stores `content` (the file's content read before deletion).
    pub async fn archive_with_content<C: ConnectionTrait>(
        db: &C,
        id: Uuid,
        content: Option<serde_json::Value>,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().fixed_offset();
        docs_nodes::Entity::update_many()
            .filter(docs_nodes::Column::Id.eq(id))
            .col_expr(docs_nodes::Column::IsArchived, Expr::value(true))
            .col_expr(docs_nodes::Column::Content, Expr::value(content))
            .col_expr(docs_nodes::Column::UpdatedAt, Expr::value(now))
            .exec(db)
            .await?;
        Ok(())
    }

    /// Restore a node: clear archived state, clear content, optionally update relative_path.
    pub async fn restore_node<C: ConnectionTrait>(
        db: &C,
        id: Uuid,
        new_relative_path: Option<String>,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let mut stmt = docs_nodes::Entity::update_many()
            .filter(docs_nodes::Column::Id.eq(id))
            .col_expr(docs_nodes::Column::IsArchived, Expr::value(false))
            .col_expr(
                docs_nodes::Column::Content,
                Expr::value(Option::<serde_json::Value>::None),
            )
            .col_expr(docs_nodes::Column::UpdatedAt, Expr::value(now));
        if let Some(rp) = new_relative_path {
            stmt = stmt.col_expr(docs_nodes::Column::RelativePath, Expr::value(rp));
        }
        stmt.exec(db).await?;
        Ok(())
    }

    /// Update only the title (and updated_at) of a node.
    pub async fn set_title<C: ConnectionTrait>(db: &C, id: Uuid, title: String) -> Result<(), AppError> {
        let now = chrono::Utc::now().fixed_offset();
        docs_nodes::Entity::update_many()
            .filter(docs_nodes::Column::Id.eq(id))
            .col_expr(docs_nodes::Column::Title, Expr::value(title))
            .col_expr(docs_nodes::Column::UpdatedAt, Expr::value(now))
            .exec(db)
            .await?;
        Ok(())
    }

    /// Update word_count and search_text (used after writing content to file).
    pub async fn update_word_count<C: ConnectionTrait>(
        db: &C,
        id: Uuid,
        word_count: i32,
        search_text: Option<String>,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().fixed_offset();
        docs_nodes::Entity::update_many()
            .filter(docs_nodes::Column::Id.eq(id))
            .col_expr(docs_nodes::Column::WordCount, Expr::value(word_count))
            .col_expr(docs_nodes::Column::SearchText, Expr::value(search_text))
            .col_expr(docs_nodes::Column::UpdatedAt, Expr::value(now))
            .exec(db)
            .await?;
        Ok(())
    }
}

impl DocNodeRepo {
    /// Find metadata by (space_id, relative_path).
    pub async fn find_by_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        relative_path: &str,
    ) -> Result<Option<docs_nodes::Model>, AppError> {
        Ok(docs_nodes::Entity::find()
            .filter(docs_nodes::Column::SpaceId.eq(space_id))
            .filter(docs_nodes::Column::RelativePath.eq(relative_path))
            .one(db)
            .await?)
    }

    /// List favorites for a space (returns metadata only).
    /// Orders by last opened desc, then RelativePath asc.
    pub async fn list_favorites<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
    ) -> Result<Vec<docs_nodes::Model>, AppError> {
        Ok(docs_nodes::Entity::find()
            .filter(docs_nodes::Column::SpaceId.eq(space_id))
            .filter(docs_nodes::Column::IsFavorite.eq(true))
            .order_by_desc(docs_nodes::Column::LastOpenedAt)
            .order_by_asc(docs_nodes::Column::RelativePath)
            .all(db)
            .await?)
    }

    /// Toggle favorite status by path, creating metadata row if needed.
    pub async fn toggle_favorite_by_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        relative_path: &str,
    ) -> Result<bool, AppError> {
        let now = chrono::Utc::now().fixed_offset();

        let id = Uuid::new_v4();
        let node = docs_nodes::Entity::insert(docs_nodes::ActiveModel {
            id: Set(id),
            space_id: Set(space_id),
            parent_id: Set(None),
            r#type: Set("unknown".to_string()),
            title: Set(String::new()),
            content: Set(None),
            relative_path: Set(Some(relative_path.to_string())),
            icon: Set(None),
            cover_image: Set(None),
            tags: Set(None),
            search_text: Set(None),
            is_favorite: Set(true),
            is_pinned: Set(false),
            is_archived: Set(false),
            word_count: Set(0),
            sort_order: Set(0),
            last_opened_at: Set(None),
            yjs_state: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        })
        .on_conflict(
            sea_orm::sea_query::OnConflict::columns([docs_nodes::Column::SpaceId, docs_nodes::Column::RelativePath])
                .value(docs_nodes::Column::IsFavorite, Expr::cust("NOT docs_nodes.is_favorite"))
                .value(docs_nodes::Column::UpdatedAt, Expr::current_timestamp())
                .to_owned(),
        )
        .exec_with_returning(db)
        .await?;

        Ok(node.is_favorite)
    }

    /// Set archived status by path, creating metadata row if needed.
    pub async fn set_archived_by_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        relative_path: &str,
        archived: bool,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();
        docs_nodes::Entity::insert(docs_nodes::ActiveModel {
            id: Set(id),
            space_id: Set(space_id),
            parent_id: Set(None),
            r#type: Set("unknown".to_string()),
            title: Set(String::new()),
            content: Set(None),
            relative_path: Set(Some(relative_path.to_string())),
            icon: Set(None),
            cover_image: Set(None),
            tags: Set(None),
            search_text: Set(None),
            is_favorite: Set(false),
            is_pinned: Set(false),
            is_archived: Set(archived),
            word_count: Set(0),
            sort_order: Set(0),
            last_opened_at: Set(None),
            yjs_state: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        })
        .on_conflict(
            sea_orm::sea_query::OnConflict::columns([docs_nodes::Column::SpaceId, docs_nodes::Column::RelativePath])
                .update_columns([docs_nodes::Column::IsArchived])
                .value(docs_nodes::Column::UpdatedAt, Expr::current_timestamp())
                .to_owned(),
        )
        .exec(db)
        .await?;
        Ok(())
    }

    /// Delete metadata by path.
    pub async fn delete_by_path<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        relative_path: &str,
    ) -> Result<bool, AppError> {
        let result = docs_nodes::Entity::delete_many()
            .filter(docs_nodes::Column::SpaceId.eq(space_id))
            .filter(docs_nodes::Column::RelativePath.eq(relative_path))
            .exec(db)
            .await?;
        Ok(result.rows_affected > 0)
    }

    /// Touch metadata for a path, creating row if needed (updates `last_opened_at` and `updated_at`).
    pub async fn touch_opened<C: ConnectionTrait>(db: &C, space_id: Uuid, relative_path: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let id = Uuid::new_v4();
        docs_nodes::Entity::insert(docs_nodes::ActiveModel {
            id: Set(id),
            space_id: Set(space_id),
            parent_id: Set(None),
            r#type: Set("unknown".to_string()),
            title: Set(String::new()),
            content: Set(None),
            relative_path: Set(Some(relative_path.to_string())),
            icon: Set(None),
            cover_image: Set(None),
            tags: Set(None),
            search_text: Set(None),
            is_favorite: Set(false),
            is_pinned: Set(false),
            is_archived: Set(false),
            word_count: Set(0),
            sort_order: Set(0),
            last_opened_at: Set(Some(now)),
            yjs_state: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        })
        .on_conflict(
            sea_orm::sea_query::OnConflict::columns([docs_nodes::Column::SpaceId, docs_nodes::Column::RelativePath])
                .value(docs_nodes::Column::LastOpenedAt, Expr::current_timestamp())
                .value(docs_nodes::Column::UpdatedAt, Expr::current_timestamp())
                .to_owned(),
        )
        .exec(db)
        .await?;
        Ok(())
    }

    /// Batch load metadata by paths (for N+1 avoidance).
    pub async fn find_by_paths<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        paths: &[String],
    ) -> Result<Vec<docs_nodes::Model>, AppError> {
        if paths.is_empty() {
            return Ok(Vec::new());
        }
        Ok(docs_nodes::Entity::find()
            .filter(docs_nodes::Column::SpaceId.eq(space_id))
            .filter(docs_nodes::Column::RelativePath.is_in(paths.iter().cloned()))
            .all(db)
            .await?)
    }
}
