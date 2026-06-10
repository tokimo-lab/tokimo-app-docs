use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;

use super::{ensure_space_vfs, get_space, parse_uuid, vfs_err};
use crate::AppState;
use crate::apps::docs::models::DocNodeListItem;
use crate::apps::docs::repos::node_meta_repo::{DocNodeMetaRepo, UpsertDocNodeMetaInput};
use crate::apps::docs::services::path_utils;
use crate::db::entities::docs_node_meta;
use crate::error::AppError;
use crate::handlers::{ApiResponse, ok};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListNodesQuery {
    pub path: Option<String>,
    pub tab: Option<String>,
    pub page: Option<u64>,
    pub page_size: Option<u64>,
    pub search: Option<String>,
    pub tags: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelPathQuery {
    pub rel_path: String,
}

fn tags_from_json(value: Option<serde_json::Value>) -> Option<Vec<String>> {
    let tags: Vec<String> = value
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|v| v.as_str().map(ToOwned::to_owned))
        .collect();
    (!tags.is_empty()).then_some(tags)
}

fn meta_map(rows: Vec<docs_node_meta::Model>) -> HashMap<String, docs_node_meta::Model> {
    rows.into_iter().map(|m| (m.rel_path.clone(), m)).collect()
}

fn to_item(
    space_id: uuid::Uuid,
    rel_path: String,
    is_dir: bool,
    modified: Option<chrono::DateTime<chrono::Utc>>,
    meta: Option<&docs_node_meta::Model>,
) -> DocNodeListItem {
    let node_type = path_utils::type_for_path(&rel_path, is_dir).to_string();
    DocNodeListItem {
        rel_path: rel_path.clone(),
        space_id: space_id.to_string(),
        parent_id: path_utils::parent_of(&rel_path),
        r#type: node_type,
        title: path_utils::title_for_path(&rel_path, is_dir),
        icon: meta.and_then(|m| m.icon.clone()),
        tags: meta.and_then(|m| tags_from_json(m.tags.clone())),
        is_favorite: meta.is_some_and(|m| m.is_favorite),
        is_pinned: meta.is_some_and(|m| m.is_pinned),
        is_archived: meta.is_some_and(|m| m.is_archived),
        word_count: meta.map_or(0, |m| m.word_count),
        sort_order: meta.map_or(0, |m| m.sort_order),
        last_opened_at: meta.and_then(|m| m.last_opened_at.map(|d| d.to_rfc3339())),
        created_at: meta.map_or_else(|| chrono::Utc::now().to_rfc3339(), |m| m.created_at.to_rfc3339()),
        updated_at: modified.map_or_else(
            || meta.map_or_else(|| chrono::Utc::now().to_rfc3339(), |m| m.updated_at.to_rfc3339()),
            |d| d.to_rfc3339(),
        ),
    }
}

pub async fn list_nodes(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<ListNodesQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let space = get_space(&state, &id).await?;
    let (vfs, root_path) = ensure_space_vfs(&state, &space).await?;
    let page = q.page.unwrap_or(1);
    let page_size = q.page_size.unwrap_or(50);
    let tab = q.tab.as_deref().unwrap_or("all");
    let mut raw: Vec<(String, bool, Option<chrono::DateTime<chrono::Utc>>)> = Vec::new();

    match tab {
        "favorites" => {
            for meta in DocNodeMetaRepo::list_favorites(&state.db, space_id).await? {
                let path = path_utils::vfs_path(&root_path, &meta.rel_path);
                if let Ok(info) = vfs.stat(&path).await {
                    raw.push((meta.rel_path, info.is_dir, info.modified));
                }
            }
        }
        "archived" => {
            let trash_path = path_utils::vfs_path(&root_path, ".trash");
            if let Ok(entries) = vfs.list(&trash_path).await {
                for entry in entries {
                    let rel = format!(".trash/{}", entry.name);
                    raw.push((rel, entry.is_dir, entry.modified));
                }
            }
        }
        _ => {
            let sub = q.path.as_deref().unwrap_or("");
            path_utils::validate_relative_path(sub)?;
            let dir = path_utils::vfs_path(&root_path, sub);
            let entries = vfs.list(&dir).await.map_err(vfs_err)?;
            for entry in entries {
                if entry.name.starts_with('.') {
                    continue;
                }
                let rel = if sub.is_empty() {
                    entry.name
                } else {
                    format!("{}/{}", path_utils::normalize_rel_path(sub), entry.name)
                };
                raw.push((rel, entry.is_dir, entry.modified));
            }
        }
    }

    if let Some(search) = q.search.as_ref().filter(|s| !s.trim().is_empty()) {
        let needle = search.to_lowercase();
        raw.retain(|(p, is_dir, _)| path_utils::title_for_path(p, *is_dir).to_lowercase().contains(&needle));
    }
    let paths: Vec<String> = raw
        .iter()
        .map(|(p, _, _)| p.trim_start_matches(".trash/").to_string())
        .collect();
    let meta = meta_map(DocNodeMetaRepo::find_by_paths(&state.db, space_id, &paths).await?);
    let mut items: Vec<DocNodeListItem> = raw
        .into_iter()
        .map(|(p, d, m)| {
            let meta_key = p.trim_start_matches(".trash/").to_string();
            to_item(space_id, p, d, m, meta.get(&meta_key))
        })
        .collect();
    if let Some(tags) = q.tags.as_ref().filter(|s| !s.trim().is_empty()) {
        let required: Vec<&str> = tags.split(',').map(str::trim).filter(|s| !s.is_empty()).collect();
        items.retain(|item| {
            item.tags
                .as_ref()
                .is_some_and(|tags| required.iter().all(|tag| tags.iter().any(|t| t == tag)))
        });
    }
    let total = items.len() as i64;
    let start = page.saturating_sub(1).saturating_mul(page_size) as usize;
    let items = items
        .into_iter()
        .skip(start)
        .take(page_size as usize)
        .collect::<Vec<_>>();
    Ok(ok(
        serde_json::json!({"items":items,"total":total,"page":page,"pageSize":page_size}),
    ))
}

pub async fn list_node_tags(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<String>>>, AppError> {
    Ok(ok(DocNodeMetaRepo::list_tags(&state.db, parse_uuid(&id)?).await?))
}

pub async fn toggle_favorite(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    path_utils::validate_relative_path(&q.rel_path)?;
    let new_state = DocNodeMetaRepo::toggle_favorite(&state.db, parse_uuid(&id)?, &q.rel_path).await?;
    Ok(ok(serde_json::json!({"isFavorite": new_state})))
}

pub async fn toggle_pin(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<RelPathQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    path_utils::validate_relative_path(&q.rel_path)?;
    let row = DocNodeMetaRepo::find(&state.db, parse_uuid(&id)?, &q.rel_path).await?;
    let new_state = !row.is_some_and(|m| m.is_pinned);
    DocNodeMetaRepo::upsert(
        &state.db,
        parse_uuid(&id)?,
        &q.rel_path,
        UpsertDocNodeMetaInput {
            is_pinned: Some(new_state),
            ..Default::default()
        },
    )
    .await?;
    Ok(ok(serde_json::json!({"isPinned": new_state})))
}
