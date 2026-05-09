use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;

use crate::AppState;
use crate::apps::docs::models::DocNodeListItem;
use crate::apps::docs::repos::node_repo::DocNodeRepo;
use crate::apps::docs::repos::space_repo::DocSpaceRepo;
use crate::apps::docs::services::local_fs;
use crate::db::entities::docs_nodes;
use crate::error::{AppError, OptionExt};
use crate::handlers::{ApiResponse, ok};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListNodesQuery {
    pub path: Option<String>,
    pub tab: Option<String>,
    pub page: Option<u64>,
    pub page_size: Option<u64>,
    pub parent_id: Option<String>,
    pub r#type: Option<String>,
    pub archived: Option<bool>,
    pub favorites_only: Option<bool>,
    pub search: Option<String>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
    pub tags: Option<String>,
}

fn parse_space_uuid(id: &str) -> Result<uuid::Uuid, AppError> {
    uuid::Uuid::parse_str(id).map_err(|_| AppError::BadRequest(format!("invalid space UUID: {id}")))
}

fn validate_relative_path(path: &str) -> Result<(), AppError> {
    if path.starts_with('/') || path.starts_with('\\') {
        return Err(AppError::BadRequest("absolute paths not allowed".into()));
    }
    if path.contains("..") {
        return Err(AppError::BadRequest(".. not allowed in paths".into()));
    }
    Ok(())
}

fn normalize_relative_path(path: &str) -> String {
    path.replace('\\', "/").trim_matches('/').to_string()
}

fn rebase_relative_path(subpath: Option<&str>, relative_path: &str) -> String {
    let relative_path = normalize_relative_path(relative_path);
    let Some(subpath) = subpath else {
        return relative_path;
    };
    let subpath = normalize_relative_path(subpath);
    match (subpath.is_empty(), relative_path.is_empty()) {
        (true, _) => relative_path,
        (_, true) => subpath,
        _ => format!("{subpath}/{relative_path}"),
    }
}

fn format_last_opened_at(meta: Option<&docs_nodes::Model>) -> Option<String> {
    meta.and_then(|m| m.last_opened_at.as_ref().map(chrono::DateTime::to_rfc3339))
}

async fn load_meta_map<C: sea_orm::ConnectionTrait>(
    db: &C,
    space_id: uuid::Uuid,
    paths: &[String],
) -> Result<HashMap<String, docs_nodes::Model>, AppError> {
    let rows = DocNodeRepo::find_by_paths(db, space_id, paths).await?;
    Ok(rows
        .into_iter()
        .filter_map(|row| {
            let path = row.relative_path.clone()?;
            Some((path, row))
        })
        .collect())
}

pub async fn list_nodes(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<ListNodesQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let space_id = parse_space_uuid(&id)?;
    let space = DocSpaceRepo::get_by_id(&state.db, space_id)
        .await?
        .not_found("space not found")?;
    let Some(ref local_path) = space.local_path else {
        return Err(AppError::BadRequest("space has no local_path".into()));
    };

    let tab = q.tab.as_deref().unwrap_or_else(|| {
        if q.favorites_only.unwrap_or(false) {
            "favorites"
        } else if q.archived.unwrap_or(false) {
            "archived"
        } else {
            "all"
        }
    });
    let page = q.page.unwrap_or(1);
    let page_size = q.page_size.unwrap_or(50);

    let items = match tab {
        "favorites" => {
            let metadata_list = DocNodeRepo::list_favorites(&state.db, space_id).await?;
            let mut result = Vec::new();
            for meta in metadata_list {
                if let Some(ref rel_path) = meta.relative_path {
                    let full_path = local_fs::resolve_path(local_path, rel_path);
                    if let Ok(fs_meta) = tokio::fs::metadata(&full_path).await {
                        let is_dir = fs_meta.is_dir();
                        let node_type = local_fs::type_for_path(rel_path, is_dir);
                        let title = local_fs::title_for_path(rel_path, is_dir);
                        let parent_id = local_fs::parent_of(rel_path);
                        let modified = fs_meta.modified().ok().map(chrono::DateTime::<chrono::Utc>::from);
                        let modified_str = modified
                            .as_ref()
                            .map_or_else(|| chrono::Utc::now().to_rfc3339(), chrono::DateTime::to_rfc3339);
                        let created_str = meta.created_at.to_rfc3339();

                        result.push(DocNodeListItem {
                            id: rel_path.clone(),
                            space_id: space_id.to_string(),
                            parent_id,
                            r#type: node_type,
                            title,
                            icon: None,
                            tags: None,
                            is_favorite: meta.is_favorite,
                            is_pinned: false,
                            is_archived: meta.is_archived,
                            word_count: 0,
                            sort_order: 0,
                            last_opened_at: meta.last_opened_at.as_ref().map(chrono::DateTime::to_rfc3339),
                            created_at: created_str,
                            updated_at: modified_str,
                        });
                    }
                }
            }
            result
        }
        "archived" => {
            let entries = local_fs::walk_trash(&std::path::PathBuf::from(local_path)).await?;
            let paths: Vec<String> = entries
                .iter()
                .filter_map(|e| e.relative_path.strip_prefix(".trash/").map(normalize_relative_path))
                .collect();
            let meta_map = load_meta_map(&state.db, space_id, &paths).await?;
            let mut result = Vec::new();
            for entry in entries {
                let rel_without_trash = normalize_relative_path(
                    entry
                        .relative_path
                        .strip_prefix(".trash/")
                        .unwrap_or(&entry.relative_path),
                );
                let node_type = local_fs::type_for_path(&rel_without_trash, entry.is_dir);
                let title = local_fs::title_for_path(&rel_without_trash, entry.is_dir);
                let parent_id = local_fs::parent_of(&rel_without_trash);
                let meta = meta_map.get(&rel_without_trash);
                let modified_str = entry
                    .modified
                    .as_ref()
                    .map_or_else(|| chrono::Utc::now().to_rfc3339(), chrono::DateTime::to_rfc3339);
                let created_str = meta.map_or_else(|| chrono::Utc::now().to_rfc3339(), |m| m.created_at.to_rfc3339());

                result.push(DocNodeListItem {
                    id: rel_without_trash.clone(),
                    space_id: space_id.to_string(),
                    parent_id,
                    r#type: node_type,
                    title,
                    icon: None,
                    tags: None,
                    is_favorite: meta.is_some_and(|m| m.is_favorite),
                    is_pinned: false,
                    is_archived: true,
                    word_count: 0,
                    sort_order: 0,
                    last_opened_at: format_last_opened_at(meta),
                    created_at: created_str,
                    updated_at: modified_str,
                });
            }
            result
        }
        _ => {
            let subpath = q.path.as_deref().or(q.parent_id.as_deref());
            if let Some(sub) = subpath {
                validate_relative_path(sub)?;
            }
            let normalized_subpath = subpath.map(normalize_relative_path);
            let walk_root = if let Some(ref sub) = normalized_subpath {
                std::path::PathBuf::from(local_path).join(sub)
            } else {
                std::path::PathBuf::from(local_path)
            };
            let entries = local_fs::walk_tree(&walk_root).await?;
            let paths: Vec<String> = entries
                .iter()
                .map(|entry| rebase_relative_path(normalized_subpath.as_deref(), &entry.relative_path))
                .collect();
            let meta_map = load_meta_map(&state.db, space_id, &paths).await?;
            let mut result = Vec::new();
            for (idx, entry) in entries.iter().enumerate() {
                let full_rel = &paths[idx];
                let node_type = local_fs::type_for_path(full_rel, entry.is_dir);
                let title = local_fs::title_for_path(full_rel, entry.is_dir);
                let parent_id = local_fs::parent_of(full_rel);
                let meta = meta_map.get(full_rel);
                let modified_str = entry
                    .modified
                    .as_ref()
                    .map_or_else(|| chrono::Utc::now().to_rfc3339(), chrono::DateTime::to_rfc3339);
                let created_str = meta.map_or_else(|| chrono::Utc::now().to_rfc3339(), |m| m.created_at.to_rfc3339());

                result.push(DocNodeListItem {
                    id: full_rel.clone(),
                    space_id: space_id.to_string(),
                    parent_id,
                    r#type: node_type,
                    title,
                    icon: None,
                    tags: None,
                    is_favorite: meta.is_some_and(|m| m.is_favorite),
                    is_pinned: false,
                    is_archived: meta.is_some_and(|m| m.is_archived),
                    word_count: 0,
                    sort_order: 0,
                    last_opened_at: format_last_opened_at(meta),
                    created_at: created_str,
                    updated_at: modified_str,
                });
            }
            result
        }
    };

    let total = items.len() as i64;
    let start = page.saturating_sub(1).saturating_mul(page_size) as usize;
    let items = items
        .into_iter()
        .skip(start)
        .take(page_size as usize)
        .collect::<Vec<_>>();
    Ok(ok(serde_json::json!({
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    })))
}

pub async fn list_node_tags(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<String>,
) -> Result<Json<ApiResponse<Vec<String>>>, AppError> {
    Ok(ok(vec![]))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleFavoriteQuery {
    #[serde(alias = "space_id")]
    pub space_id: String,
}

pub async fn toggle_favorite(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<ToggleFavoriteQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    validate_relative_path(&id)?;
    let space_id = parse_space_uuid(&q.space_id)?;
    let new_state = DocNodeRepo::toggle_favorite_by_path(&state.db, space_id, &id).await?;
    Ok(ok(serde_json::json!({ "isFavorite": new_state })))
}

pub async fn toggle_pin(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    Ok(ok(serde_json::json!({ "isPinned": false })))
}
