use axum::Json;
use axum::extract::{Path, State};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use super::{parse_uuid, validate_node_name};
use crate::AppState;
use crate::apps::docs::models::DocNodeOutput;
use crate::apps::docs::repos::node_repo::DocNodeRepo;
use crate::apps::docs::repos::space_repo::DocSpaceRepo;
use crate::apps::docs::services::docs_service::DocsService;
use crate::apps::docs::services::local_fs;
use crate::db::entities::docs_nodes;
use crate::error::{AppError, OptionExt};
use crate::handlers::{ApiResponse, ok, ok_empty};
use sea_orm::prelude::Expr;
use sea_orm::*;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeInput {
    pub r#type: Option<String>,
    pub title: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNodeInput {
    pub title: Option<String>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub content: Option<Option<serde_json::Value>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub icon: Option<Option<String>>,
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub cover_image: Option<Option<String>>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveNodeInput {
    pub parent_id: Option<String>,
    pub sort_order: Option<i32>,
}

/// Verify that the parent node exists and is a folder.
async fn verify_parent_is_folder(db: &DatabaseConnection, parent_id: Uuid) -> Result<(), AppError> {
    let parent = docs_nodes::Entity::find_by_id(parent_id)
        .one(db)
        .await?
        .not_found("parent node not found")?;
    if parent.r#type != "folder" {
        return Err(AppError::BadRequest("parent node is not a folder".into()));
    }
    Ok(())
}

/// Check that moving `node_id` under `target_parent_id` does not create a cycle.
async fn check_no_cycle(db: &DatabaseConnection, node_id: Uuid, target_parent_id: Uuid) -> Result<(), AppError> {
    let mut current = Some(target_parent_id);
    while let Some(pid) = current {
        if pid == node_id {
            return Err(AppError::BadRequest("cannot move a node under itself".into()));
        }
        let parent = docs_nodes::Entity::find_by_id(pid).one(db).await?;
        current = parent.and_then(|p| p.parent_id);
    }
    Ok(())
}

/// POST /api/apps/docs/spaces/{id}/nodes
pub async fn create_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<CreateNodeInput>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let space_id = parse_uuid(&id)?;
    let parent_id = input.parent_id.as_deref().map(parse_uuid).transpose()?;
    let node_type = input.r#type.unwrap_or_else(|| "notion".to_string());
    let base_title = input.title.unwrap_or_default();

    if !base_title.is_empty() {
        validate_node_name(&base_title)?;
    }

    if let Some(pid) = parent_id {
        verify_parent_is_folder(&state.db, pid).await?;
    }

    // Resolve space to get local_path.
    let space = DocSpaceRepo::get_by_id(&state.db, space_id)
        .await?
        .not_found("space not found")?;
    let Some(ref local_path) = space.local_path else {
        return Err(AppError::BadRequest(
            "space has no local_path; configure it first".into(),
        ));
    };

    // Compute a unique title (auto-suffix if sibling already has that name).
    let siblings = DocNodeRepo::get_sibling_titles(&state.db, space_id, parent_id, None).await?;
    let title = if base_title.is_empty() {
        let default_title = format!("Untitled {node_type}");
        local_fs::unique_title(&default_title, &siblings)
    } else {
        local_fs::unique_title(&base_title, &siblings)
    };

    // Compute relative_path.
    let parent_relative: Option<String> = if let Some(pid) = parent_id {
        let parent_node = DocNodeRepo::get_by_id(&state.db, pid)
            .await?
            .not_found("parent node not found")?;
        parent_node.relative_path
    } else {
        None
    };
    let relative_path = local_fs::compute_relative_path(parent_relative.as_deref(), &title, &node_type);

    // Create filesystem artifact.
    let full_path = local_fs::resolve_path(local_path, &relative_path);
    local_fs::create_node_artifact(&full_path, &node_type)
        .await
        .inspect_err(|e| {
            tracing::error!("FS create failed for {}: {e}", full_path.display());
        })?;

    // Insert DB row. Roll back file if DB fails.
    let node = DocNodeRepo::create(
        &state.db,
        space_id,
        node_type.clone(),
        title,
        parent_id,
        Some(relative_path.clone()),
    )
    .await
    .inspect_err(|_| {
        let path = full_path.clone();
        let nt = node_type.clone();
        tokio::spawn(async move {
            let _ = local_fs::delete_node_artifact(&path, &nt).await;
        });
    })?;

    Ok(ok(DocNodeOutput::from(node)))
}

/// GET /api/apps/docs/nodes/{id}
pub async fn get_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let node = DocNodeRepo::get_by_id(&state.db, node_id)
        .await?
        .not_found("node not found")?;

    let mut output = DocNodeOutput::from(node.clone());

    // For non-archived file-backed nodes, read content from disk.
    if !node.is_archived
        && node.r#type != "folder"
        && let Some(ref rel_path) = node.relative_path
        && let Ok(Some(space)) = DocSpaceRepo::get_by_id(&state.db, node.space_id).await
        && let Some(ref local_path) = space.local_path
    {
        let full_path = local_fs::resolve_path(local_path, rel_path);
        match local_fs::read_node_file(&full_path, &node.r#type).await {
            Ok(content) => output.content = Some(content),
            Err(e) => {
                tracing::warn!("Could not read node file {}: {e}", full_path.display());
                // content stays as DB value (likely None for non-archived)
            }
        }
    }
    // Archived nodes: content is already in DB (set by archive_node), output.content is correct.

    Ok(ok(output))
}

/// PATCH /api/apps/docs/nodes/{id}
pub async fn update_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<UpdateNodeInput>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let node_id = parse_uuid(&id)?;

    // Load node and space upfront.
    let node = DocNodeRepo::get_by_id(&state.db, node_id)
        .await?
        .not_found("node not found")?;
    let space = DocSpaceRepo::get_by_id(&state.db, node.space_id)
        .await?
        .not_found("space not found")?;

    let in_file_mode =
        !node.is_archived && node.relative_path.is_some() && space.local_path.is_some() && node.r#type != "folder";

    // ── Title rename ──────────────────────────────────────────────────────────
    if let Some(ref new_title) = input.title {
        if !new_title.is_empty() {
            validate_node_name(new_title)?;
        }
        if !new_title.is_empty() && *new_title != node.title {
            let siblings =
                DocNodeRepo::get_sibling_titles(&state.db, node.space_id, node.parent_id, Some(node_id)).await?;
            if siblings.contains(new_title.as_str()) {
                return Err(AppError::BadRequest(format!(
                    "a node named \"{new_title}\" already exists in this location"
                )));
            }

            // Rename filesystem artifact and cascade-update relative_paths.
            if let (Some(old_rel), Some(local_path)) = (&node.relative_path, &space.local_path) {
                let old_full = local_fs::resolve_path(local_path, old_rel);
                // Compute new relative_path: replace only the file name stem (last segment).
                let new_rel = rename_last_segment(old_rel, new_title, &node.r#type);
                let new_full = local_fs::resolve_path(local_path, &new_rel);

                local_fs::move_node_artifact(&old_full, &new_full).await?;

                // Cascade: update relative_path for this node and all descendants.
                let txn = state.db.begin().await?;
                DocNodeRepo::set_relative_path(&txn, node_id, Some(new_rel.clone())).await?;

                if node.r#type == "folder" {
                    let descendants = DocNodeRepo::get_descendants(&state.db, node_id).await?;
                    let path_updates: Vec<(Uuid, Option<String>)> = descendants
                        .iter()
                        .filter_map(|d| {
                            let old_p = d.relative_path.as_deref()?;
                            let new_p = local_fs::rebase_path(old_rel, &new_rel, old_p);
                            Some((d.id, Some(new_p)))
                        })
                        .collect();
                    DocNodeRepo::bulk_set_relative_paths(&txn, &path_updates).await?;
                }
                txn.commit().await?;
            }
        }
    }

    // ── Content write (file-backed) ───────────────────────────────────────────
    if let Some(Some(ref content)) = input.content
        && in_file_mode
    {
        let rel_path = node.relative_path.as_deref().unwrap();
        let local_path = space.local_path.as_deref().unwrap();
        let full_path = local_fs::resolve_path(local_path, rel_path);

        local_fs::write_node_file(&full_path, &node.r#type, content).await?;

        // Update word_count / search_text in DB (content itself stays on disk).
        let wc = DocsService::count_words(content);
        let st = DocsService::extract_text(content);
        DocNodeRepo::update_word_count(&state.db, node_id, wc, Some(st)).await?;
    }

    // ── Non-file fields: delegate to DocsService (handles versioning) ─────────
    // For file-backed nodes, pass content=None so DocsService doesn't write it to DB.
    let db_content = if in_file_mode { None } else { input.content };

    let node = DocsService::update_node_with_version(
        &state.db,
        node_id,
        input.title,
        db_content,
        input.icon,
        input.cover_image,
        input.tags,
    )
    .await?;

    Ok(ok(DocNodeOutput::from(node)))
}

/// DELETE /api/apps/docs/nodes/{id} — soft delete (archive)
pub async fn archive_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let node = DocNodeRepo::get_by_id(&state.db, node_id)
        .await?
        .not_found("node not found")?;
    let space = DocSpaceRepo::get_by_id(&state.db, node.space_id)
        .await?
        .not_found("space not found")?;

    // Collect node + all descendants.
    let mut all_nodes = vec![node.clone()];
    all_nodes.extend(DocNodeRepo::get_descendants(&state.db, node_id).await?);

    // For each non-folder node, read file content.
    let mut content_map: Vec<(Uuid, Option<serde_json::Value>)> = Vec::new();
    for n in &all_nodes {
        let content = if n.r#type == "folder" {
            None
        } else if let (Some(rp), Some(lp)) = (&n.relative_path, &space.local_path) {
            let full_path = local_fs::resolve_path(lp, rp);
            match local_fs::read_node_file(&full_path, &n.r#type).await {
                Ok(c) => Some(c),
                Err(e) => {
                    tracing::warn!("archive: could not read {}: {e}", full_path.display());
                    None
                }
            }
        } else {
            n.content.clone()
        };
        content_map.push((n.id, content));
    }

    // Persist archived state + content in DB (transaction).
    let txn = state.db.begin().await?;
    for (nid, content) in &content_map {
        DocNodeRepo::archive_with_content(&txn, *nid, content.clone()).await?;
    }
    txn.commit().await?;

    // Delete filesystem artifact (root node; folder deletion is recursive).
    if let (Some(rp), Some(lp)) = (&node.relative_path, &space.local_path) {
        let full_path = local_fs::resolve_path(lp, rp);
        if let Err(e) = local_fs::delete_node_artifact(&full_path, &node.r#type).await {
            tracing::warn!("archive: FS delete failed for {}: {e}", full_path.display());
        }
    }

    Ok(ok_empty())
}

/// PATCH /api/apps/docs/nodes/{id}/restore
pub async fn restore_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let node = DocNodeRepo::get_by_id(&state.db, node_id)
        .await?
        .not_found("node not found")?;

    if !node.is_archived {
        return Err(AppError::BadRequest("node is not archived".into()));
    }

    let space = DocSpaceRepo::get_by_id(&state.db, node.space_id)
        .await?
        .not_found("space not found")?;

    // Collect node + all descendants.
    let mut all_nodes = vec![node.clone()];
    all_nodes.extend(DocNodeRepo::get_descendants(&state.db, node_id).await?);

    // Write each non-folder node back to its file (or adjusted path on conflict).
    // Then update DB.
    let txn = state.db.begin().await?;
    for n in &all_nodes {
        let final_rel = if n.r#type == "folder" {
            // Folder: ensure directory exists.
            if let (Some(rp), Some(lp)) = (&n.relative_path, &space.local_path) {
                let full_path = local_fs::resolve_path(lp, rp);
                if let Err(e) = tokio::fs::create_dir_all(&full_path).await {
                    tracing::warn!("restore: mkdir failed for {}: {e}", full_path.display());
                }
            }
            n.relative_path.clone()
        } else if let (Some(rp), Some(lp), Some(content)) = (&n.relative_path, &space.local_path, &n.content) {
            let full_path = local_fs::resolve_path(lp, rp);
            let (final_path, final_rel) = if full_path.exists() {
                // Conflict: insert " (restored)" before extension.
                let new_rel = add_restored_suffix(rp, &n.r#type);
                let new_full = local_fs::resolve_path(lp, &new_rel);
                (new_full, new_rel)
            } else {
                (full_path, rp.clone())
            };
            if let Err(e) = local_fs::write_node_file(&final_path, &n.r#type, content).await {
                tracing::warn!("restore: write failed for {}: {e}", final_path.display());
            }
            Some(final_rel)
        } else {
            n.relative_path.clone()
        };

        DocNodeRepo::restore_node(&txn, n.id, final_rel).await?;
    }
    txn.commit().await?;

    Ok(ok_empty())
}

/// DELETE /api/apps/docs/nodes/{id}/permanent — hard delete
pub async fn delete_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let deleted = DocNodeRepo::delete(&state.db, node_id).await?;
    if !deleted {
        return Err(AppError::NotFound("node not found".into()));
    }

    // Clean up attachment storage files in background.
    let storage = state.storage.clone();
    let prefix = format!("docs/attachments/{node_id}/");
    tokio::spawn(async move {
        if let Ok(objects) = storage.list(Some(&prefix)).await {
            for obj in objects {
                if let Err(e) = storage.delete(&obj.key).await {
                    tracing::warn!("Failed to delete attachment file {obj_key}: {e}", obj_key = obj.key);
                }
            }
        }
    });

    Ok(ok_empty())
}

/// PATCH /api/apps/docs/nodes/{id}/move
pub async fn move_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<MoveNodeInput>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let node_id = parse_uuid(&id)?;
    let new_parent_id = input.parent_id.as_deref().map(parse_uuid).transpose()?;

    if let Some(pid) = new_parent_id {
        verify_parent_is_folder(&state.db, pid).await?;
        check_no_cycle(&state.db, node_id, pid).await?;
    }

    let node = DocNodeRepo::get_by_id(&state.db, node_id)
        .await?
        .not_found("node not found")?;

    if new_parent_id != node.parent_id && !node.title.is_empty() {
        let siblings = DocNodeRepo::get_sibling_titles(&state.db, node.space_id, new_parent_id, Some(node_id)).await?;
        if siblings.contains(node.title.as_str()) {
            return Err(AppError::BadRequest(format!(
                "a node named \"{}\" already exists in the target location",
                node.title
            )));
        }
    }

    // Compute new relative_path.
    let space = DocSpaceRepo::get_by_id(&state.db, node.space_id)
        .await?
        .not_found("space not found")?;

    if let (Some(old_rel), Some(local_path)) = (&node.relative_path, &space.local_path) {
        let new_parent_rel: Option<String> = if let Some(pid) = new_parent_id {
            DocNodeRepo::get_by_id(&state.db, pid)
                .await?
                .and_then(|p| p.relative_path)
        } else {
            None
        };

        let new_rel = local_fs::compute_relative_path(new_parent_rel.as_deref(), &node.title, &node.r#type);

        // Move the filesystem artifact.
        let old_full = local_fs::resolve_path(local_path, old_rel);
        let new_full = local_fs::resolve_path(local_path, &new_rel);
        local_fs::move_node_artifact(&old_full, &new_full).await?;

        // DB: update parent_id, sort_order, and relative_paths (node + descendants).
        let txn = state.db.begin().await?;

        // sort_order shift (same logic as before).
        if let Some(order) = input.sort_order {
            docs_nodes::Entity::update_many()
                .filter(
                    if let Some(pid) = new_parent_id {
                        docs_nodes::Column::ParentId.eq(pid)
                    } else {
                        docs_nodes::Column::ParentId.is_null()
                    }
                    .and(docs_nodes::Column::Id.ne(node_id))
                    .and(docs_nodes::Column::SortOrder.gte(order)),
                )
                .col_expr(
                    docs_nodes::Column::SortOrder,
                    Expr::col(docs_nodes::Column::SortOrder).add(1),
                )
                .exec(&txn)
                .await?;
        }

        // Update this node.
        let now = chrono::Utc::now().fixed_offset();
        {
            let mut stmt = docs_nodes::Entity::update_many()
                .filter(docs_nodes::Column::Id.eq(node_id))
                .col_expr(docs_nodes::Column::ParentId, Expr::value(new_parent_id))
                .col_expr(docs_nodes::Column::RelativePath, Expr::value(new_rel.clone()))
                .col_expr(docs_nodes::Column::UpdatedAt, Expr::value(now));
            if let Some(order) = input.sort_order {
                stmt = stmt.col_expr(docs_nodes::Column::SortOrder, Expr::value(order));
            }
            stmt.exec(&txn).await?;
        }

        // Cascade relative_path for descendants.
        let descendants = DocNodeRepo::get_descendants(&state.db, node_id).await?;
        let path_updates: Vec<(Uuid, Option<String>)> = descendants
            .iter()
            .filter_map(|d| {
                let old_p = d.relative_path.as_deref()?;
                let new_p = local_fs::rebase_path(old_rel, &new_rel, old_p);
                Some((d.id, Some(new_p)))
            })
            .collect();
        DocNodeRepo::bulk_set_relative_paths(&txn, &path_updates).await?;

        txn.commit().await?;
    } else {
        // No file mode: just update parent_id / sort_order in DB.
        let moved = DocNodeRepo::move_node(&state.db, node_id, new_parent_id, input.sort_order).await?;
        if !moved {
            return Err(AppError::NotFound("node not found".into()));
        }
    }

    Ok(ok_empty())
}

// ── helpers ──────────────────────────────────────────────────────────────────

/// Replace the last path segment's stem with `new_title`, keeping parent dirs and extension.
///
/// e.g. `"a/b/old.tknotion.json"` + `"new"` + `"notion"` → `"a/b/new.tknotion.json"`
fn rename_last_segment(old_rel: &str, new_title: &str, node_type: &str) -> String {
    let parent = if let Some(pos) = old_rel.rfind('/') {
        &old_rel[..=pos]
    } else {
        ""
    };
    local_fs::compute_relative_path(
        if parent.is_empty() {
            None
        } else {
            Some(parent.trim_end_matches('/'))
        },
        new_title,
        node_type,
    )
}

/// Add `" (restored)"` before the file extension for conflict resolution.
///
/// e.g. `"a/b.tknotion.json"` → `"a/b (restored).tknotion.json"`
fn add_restored_suffix(rel_path: &str, node_type: &str) -> String {
    if let Some(ext) = local_fs::ext_for_type(node_type)
        && let Some(stem) = rel_path.strip_suffix(ext)
    {
        return format!("{stem} (restored){ext}");
    }
    format!("{rel_path} (restored)")
}
