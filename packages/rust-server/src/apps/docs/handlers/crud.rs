use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use std::sync::Arc;

use crate::AppState;
use crate::apps::docs::models::DocNodeOutput;
use crate::apps::docs::repos::node_repo::DocNodeRepo;
use crate::apps::docs::repos::space_repo::DocSpaceRepo;
use crate::apps::docs::services::local_fs;
use crate::error::{AppError, OptionExt};
use crate::handlers::{ApiResponse, ok, ok_empty};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeInput {
    pub r#type: Option<String>,
    pub title: Option<String>,
    pub parent_path: Option<String>,
    #[serde(alias = "parentId", alias = "parent_id")]
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
pub struct SpaceIdQuery {
    #[serde(alias = "space_id")]
    pub space_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveNodeInput {
    pub new_parent_path: Option<String>,
    #[serde(alias = "parent_id")]
    pub parent_id: Option<String>,
    #[serde(alias = "sort_order")]
    pub sort_order: Option<i32>,
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

pub async fn create_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(input): Json<CreateNodeInput>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    let space_id = parse_space_uuid(&id)?;
    let space = DocSpaceRepo::get_by_id(&state.db, space_id)
        .await?
        .not_found("space not found")?;
    let Some(ref local_path) = space.local_path else {
        return Err(AppError::BadRequest("space has no local_path".into()));
    };

    let node_type = input.r#type.unwrap_or_else(|| "notion".to_string());
    let title = input.title.unwrap_or_else(|| "Untitled".to_string());
    let parent = input.parent_path.as_deref().unwrap_or("");

    if !parent.is_empty() {
        validate_relative_path(parent)?;
    }

    super::validate_node_name(&title)?;
    let sanitized_title = local_fs::sanitize_path_component(&title);

    let parent_full = if parent.is_empty() {
        std::path::PathBuf::from(local_path)
    } else {
        local_fs::resolve_path(local_path, parent)
    };

    let mut existing_titles = std::collections::HashSet::new();
    if let Ok(mut entries) = tokio::fs::read_dir(&parent_full).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if let Ok(meta) = entry.metadata().await {
                let is_dir = meta.is_dir();
                let entry_title = local_fs::title_for_path(&name_str, is_dir);
                existing_titles.insert(entry_title);
            }
        }
    }

    let unique_title = local_fs::unique_title(&sanitized_title, &existing_titles);
    let relative_path = local_fs::compute_relative_path(
        if parent.is_empty() { None } else { Some(parent) },
        &unique_title,
        &node_type,
    );

    let full_path = local_fs::resolve_path(local_path, &relative_path);
    local_fs::create_node_artifact(&full_path, &node_type).await?;

    let content = if node_type == "folder" {
        None
    } else {
        let default_content = local_fs::default_content_for_type(&node_type);
        if node_type == "markdown" {
            Some(serde_json::Value::String(default_content.to_string()))
        } else {
            serde_json::from_str(default_content).ok()
        }
    };

    let meta = tokio::fs::metadata(&full_path)
        .await
        .map_err(|e| AppError::Internal(format!("metadata: {e}")))?;
    let modified = meta.modified().unwrap_or_else(|_| std::time::SystemTime::now());
    let created = meta.created().unwrap_or(modified);
    let parent_id = local_fs::parent_of(&relative_path);

    Ok(ok(DocNodeOutput {
        id: relative_path,
        space_id: space_id.to_string(),
        parent_id,
        r#type: node_type,
        title: unique_title,
        content,
        icon: None,
        cover_image: None,
        tags: vec![],
        is_favorite: false,
        is_pinned: false,
        is_archived: false,
        word_count: 0,
        sort_order: 0,
        last_opened_at: None,
        created_at: chrono::DateTime::<chrono::Utc>::from(created).to_rfc3339(),
        updated_at: chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339(),
    }))
}

pub async fn get_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<SpaceIdQuery>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    validate_relative_path(&id)?;
    let space_id = parse_space_uuid(&q.space_id)?;
    let space = DocSpaceRepo::get_by_id(&state.db, space_id)
        .await?
        .not_found("space not found")?;
    let Some(ref local_path) = space.local_path else {
        return Err(AppError::BadRequest("space has no local_path".into()));
    };

    let full_path = local_fs::resolve_path(local_path, &id);
    if !full_path.exists() {
        return Err(AppError::NotFound("file not found".into()));
    }

    DocNodeRepo::touch_opened(&state.db, space_id, &id).await?;

    let meta = tokio::fs::metadata(&full_path)
        .await
        .map_err(|e| AppError::Internal(format!("metadata: {e}")))?;
    let is_dir = meta.is_dir();
    let modified = meta.modified().unwrap_or_else(|_| std::time::SystemTime::now());
    let created = meta.created().unwrap_or(modified);

    let node_type = local_fs::type_for_path(&id, is_dir);

    let content = if is_dir {
        None
    } else {
        local_fs::read_node_file(&full_path, &node_type).await.ok()
    };

    let metadata_row = DocNodeRepo::find_by_path(&state.db, space_id, &id).await?;
    let title = local_fs::title_for_path(&id, is_dir);
    let parent_id = local_fs::parent_of(&id);

    Ok(ok(DocNodeOutput {
        id: id.clone(),
        space_id: space_id.to_string(),
        parent_id,
        r#type: node_type,
        title,
        content,
        icon: None,
        cover_image: None,
        tags: vec![],
        is_favorite: metadata_row.as_ref().is_some_and(|m| m.is_favorite),
        is_pinned: false,
        is_archived: false,
        word_count: 0,
        sort_order: 0,
        last_opened_at: metadata_row
            .as_ref()
            .and_then(|m| m.last_opened_at.as_ref().map(chrono::DateTime::to_rfc3339)),
        created_at: chrono::DateTime::<chrono::Utc>::from(created).to_rfc3339(),
        updated_at: chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339(),
    }))
}

pub async fn update_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<SpaceIdQuery>,
    Json(input): Json<UpdateNodeInput>,
) -> Result<Json<ApiResponse<DocNodeOutput>>, AppError> {
    validate_relative_path(&id)?;
    let space_id = parse_space_uuid(&q.space_id)?;
    let space = DocSpaceRepo::get_by_id(&state.db, space_id)
        .await?
        .not_found("space not found")?;
    let Some(ref local_path) = space.local_path else {
        return Err(AppError::BadRequest("space has no local_path".into()));
    };

    let old_full = local_fs::resolve_path(local_path, &id);
    if !old_full.exists() {
        return Err(AppError::NotFound("file not found".into()));
    }

    let was_dir = old_full.is_dir();
    let node_type = local_fs::type_for_path(&id, was_dir);

    let mut final_id = id.clone();

    if let Some(ref new_title) = input.title {
        super::validate_node_name(new_title)?;
        let parent = local_fs::parent_of(&id);
        let ext = local_fs::ext_for_type(&node_type);
        let sanitized = local_fs::sanitize_path_component(new_title);
        let new_filename = if let Some(e) = ext {
            format!("{sanitized}{e}")
        } else {
            sanitized
        };
        let new_rel = if let Some(p) = parent {
            format!("{p}/{new_filename}")
        } else {
            new_filename
        };
        let new_full = local_fs::resolve_path(local_path, &new_rel);
        if new_full != old_full {
            tokio::fs::rename(&old_full, &new_full)
                .await
                .map_err(|e| AppError::Internal(format!("rename: {e}")))?;
            final_id = new_rel.clone();
            if let Some(meta) = DocNodeRepo::find_by_path(&state.db, space_id, &id).await? {
                DocNodeRepo::set_relative_path(&state.db, meta.id, Some(new_rel.clone())).await?;
            }
            if was_dir {
                DocNodeRepo::rebase_relative_path_prefix(&state.db, space_id, &id, &new_rel).await?;
            }
        }
    }

    if let Some(Some(ref content)) = input.content {
        let full_path = local_fs::resolve_path(local_path, &final_id);
        local_fs::write_node_file(&full_path, &node_type, content).await?;
    }

    get_node(State(state), Path(final_id), Query(q)).await
}

pub async fn archive_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<SpaceIdQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    validate_relative_path(&id)?;
    let space_id = parse_space_uuid(&q.space_id)?;
    let space = DocSpaceRepo::get_by_id(&state.db, space_id)
        .await?
        .not_found("space not found")?;
    let Some(ref local_path) = space.local_path else {
        return Err(AppError::BadRequest("space has no local_path".into()));
    };

    let full_path = local_fs::resolve_path(local_path, &id);
    if !full_path.exists() {
        return Err(AppError::NotFound("file not found".into()));
    }

    let trash_base = std::path::PathBuf::from(local_path).join(".trash");
    let trash_path = trash_base.join(&id);
    if let Some(parent) = trash_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Internal(format!("create trash parent: {e}")))?;
    }
    tokio::fs::rename(&full_path, &trash_path)
        .await
        .map_err(|e| AppError::Internal(format!("move to trash: {e}")))?;

    DocNodeRepo::set_archived_by_path(&state.db, space_id, &id, true).await?;

    Ok(ok_empty())
}

pub async fn restore_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<SpaceIdQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    validate_relative_path(&id)?;
    let space_id = parse_space_uuid(&q.space_id)?;
    let space = DocSpaceRepo::get_by_id(&state.db, space_id)
        .await?
        .not_found("space not found")?;
    let Some(ref local_path) = space.local_path else {
        return Err(AppError::BadRequest("space has no local_path".into()));
    };

    let trash_base = std::path::PathBuf::from(local_path).join(".trash");
    let trash_path = trash_base.join(&id);
    if !trash_path.exists() {
        return Err(AppError::NotFound("file not in trash".into()));
    }

    let mut final_id = id.clone();
    let mut restore_path = local_fs::resolve_path(local_path, &id);
    if restore_path.exists() {
        let name_part = if let Some(stem) = restore_path.file_stem().and_then(|s| s.to_str()) {
            let ext_part = restore_path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext_part.is_empty() {
                format!("{stem} (restored)")
            } else {
                format!("{stem} (restored).{ext_part}")
            }
        } else {
            let id_name = id.rsplit('/').next().unwrap_or(&id);
            format!("{id_name} (restored)")
        };
        restore_path = restore_path.with_file_name(name_part);
        let parent_path = local_fs::parent_of(&id);
        final_id = if let Some(p) = parent_path {
            let filename = restore_path.file_name().unwrap().to_str().unwrap();
            format!("{p}/{filename}")
        } else {
            restore_path.file_name().unwrap().to_str().unwrap().to_string()
        };
    }

    if let Some(parent) = restore_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Internal(format!("create restore parent: {e}")))?;
    }
    tokio::fs::rename(&trash_path, &restore_path)
        .await
        .map_err(|e| AppError::Internal(format!("restore: {e}")))?;

    if final_id != id
        && let Ok(Some(meta)) = DocNodeRepo::find_by_path(&state.db, space_id, &id).await
    {
        DocNodeRepo::set_relative_path(&state.db, meta.id, Some(final_id.clone())).await?;
    }
    DocNodeRepo::set_archived_by_path(&state.db, space_id, &final_id, false).await?;

    Ok(ok_empty())
}

pub async fn delete_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<SpaceIdQuery>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    validate_relative_path(&id)?;
    let space_id = parse_space_uuid(&q.space_id)?;
    let space = DocSpaceRepo::get_by_id(&state.db, space_id)
        .await?
        .not_found("space not found")?;
    let Some(ref local_path) = space.local_path else {
        return Err(AppError::BadRequest("space has no local_path".into()));
    };

    let trash_base = std::path::PathBuf::from(local_path).join(".trash");
    let trash_path = trash_base.join(&id);
    if !trash_path.exists() {
        return Err(AppError::NotFound("file not in trash".into()));
    }

    if trash_path.is_dir() {
        tokio::fs::remove_dir_all(&trash_path)
            .await
            .map_err(|e| AppError::Internal(format!("delete dir: {e}")))?;
    } else {
        tokio::fs::remove_file(&trash_path)
            .await
            .map_err(|e| AppError::Internal(format!("delete file: {e}")))?;
    }

    DocNodeRepo::delete_by_path(&state.db, space_id, &id).await?;

    Ok(ok_empty())
}

pub async fn move_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<SpaceIdQuery>,
    Json(input): Json<MoveNodeInput>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    validate_relative_path(&id)?;
    let space_id = parse_space_uuid(&q.space_id)?;
    let space = DocSpaceRepo::get_by_id(&state.db, space_id)
        .await?
        .not_found("space not found")?;
    let Some(ref local_path) = space.local_path else {
        return Err(AppError::BadRequest("space has no local_path".into()));
    };

    let MoveNodeInput { new_parent_path, .. } = input;
    let new_parent = new_parent_path.as_deref().unwrap_or("");
    if !new_parent.is_empty() {
        validate_relative_path(new_parent)?;
    }

    let old_full = local_fs::resolve_path(local_path, &id);
    if !old_full.exists() {
        return Err(AppError::NotFound("file not found".into()));
    }
    let was_dir = old_full.is_dir();

    let basename = id.rsplit('/').next().unwrap_or(&id);
    let node_type = local_fs::type_for_path(&id, was_dir);
    let title = local_fs::title_for_path(basename, was_dir);
    let target = local_fs::compute_relative_path(
        if new_parent.is_empty() { None } else { Some(new_parent) },
        &title,
        &node_type,
    );
    validate_relative_path(&target)?;

    let new_full = local_fs::resolve_path(local_path, &target);
    if new_full.exists() {
        return Err(AppError::BadRequest("target already exists".into()));
    }

    if let Some(parent) = new_full.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Internal(format!("create parent: {e}")))?;
    }
    tokio::fs::rename(&old_full, &new_full)
        .await
        .map_err(|e| AppError::Internal(format!("move: {e}")))?;

    if let Some(meta) = DocNodeRepo::find_by_path(&state.db, space_id, &id).await? {
        DocNodeRepo::set_relative_path(&state.db, meta.id, Some(target.clone())).await?;
    }
    if was_dir {
        DocNodeRepo::rebase_relative_path_prefix(&state.db, space_id, &id, &target).await?;
    }

    Ok(ok_empty())
}
