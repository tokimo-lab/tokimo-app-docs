//! SeaORM entities for docs app

pub mod docs_base_records;
pub mod docs_node_attachments;
pub mod docs_node_comments;
pub mod docs_node_meta;
pub mod docs_node_versions;
pub mod docs_node_view_ctxs;
pub mod docs_spaces;
pub mod docs_whiteboard_user_libraries;
pub mod users;
pub mod vfs;

use serde::Serialize;
use ts_rs::TS;

fn tags_from_json(tags: Option<serde_json::Value>) -> Vec<String> {
    tags.and_then(|value| value.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| value.as_str().map(ToOwned::to_owned))
        .collect()
}

/// Doc space output
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocSpaceOutput {
    pub id: String,
    pub name: String,
    pub avatar: Option<serde_json::Value>,
    pub description: Option<String>,
    pub vfs_id: Option<String>,
    pub root_path: Option<String>,
    pub source_name: Option<String>,
    pub source_type: Option<String>,
    pub sort_order: i32,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl From<docs_spaces::Model> for DocSpaceOutput {
    fn from(m: docs_spaces::Model) -> Self {
        Self {
            id: m.id.to_string(),
            name: m.name,
            avatar: m.avatar,
            description: m.description,
            vfs_id: m.vfs_id.map(|id| id.to_string()),
            root_path: m.root_path,
            source_name: None,
            source_type: None,
            sort_order: m.sort_order,
            created_at: m.created_at.map(|d| d.to_rfc3339()),
            updated_at: m.updated_at.map(|d| d.to_rfc3339()),
        }
    }
}

/// Node list item (metadata enriched onto VFS nodes; content comes from VFS)
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeListItem {
    pub rel_path: String,
    pub space_id: String,
    pub parent_id: Option<String>,
    pub r#type: String,
    pub title: String,
    pub icon: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub word_count: i32,
    pub sort_order: i32,
    pub last_opened_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Temporary compatibility stub; B3 will redesign node detail around VFS file reads.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeOutput {
    pub space_id: String,
    pub rel_path: String,
    pub title: String,
    pub r#type: String,
}

/// Version list item (without content)
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeVersionOutput {
    pub id: String,
    pub space_id: String,
    pub rel_path: String,
    pub version: i32,
    pub title: String,
    pub word_count: i32,
    pub created_at: String,
}

impl From<docs_node_versions::Model> for DocNodeVersionOutput {
    fn from(m: docs_node_versions::Model) -> Self {
        Self {
            id: m.id.to_string(),
            space_id: m.space_id.to_string(),
            rel_path: m.rel_path,
            version: m.version,
            title: m.title,
            word_count: m.word_count,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}

/// Version detail (includes content for preview/restore)
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeVersionDetailOutput {
    pub id: String,
    pub space_id: String,
    pub rel_path: String,
    pub version: i32,
    pub title: String,
    pub content: Option<serde_json::Value>,
    pub word_count: i32,
    pub created_at: String,
}

impl From<docs_node_versions::Model> for DocNodeVersionDetailOutput {
    fn from(m: docs_node_versions::Model) -> Self {
        Self {
            id: m.id.to_string(),
            space_id: m.space_id.to_string(),
            rel_path: m.rel_path,
            version: m.version,
            title: m.title,
            content: m.content,
            word_count: m.word_count,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}

/// Comment output (with nested replies)
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeCommentOutput {
    pub id: String,
    pub space_id: String,
    pub rel_path: String,
    pub user_id: String,
    pub user_name: String,
    pub comment_key: String,
    pub content: String,
    pub is_resolved: bool,
    pub parent_id: Option<String>,
    pub replies: Vec<DocNodeCommentOutput>,
    pub created_at: String,
    pub updated_at: String,
}

/// Attachment output
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeAttachmentOutput {
    pub id: String,
    pub space_id: String,
    pub rel_path: String,
    pub storage_key: String,
    pub file_name: String,
    pub file_type: String,
    #[ts(type = "number")]
    pub file_size: i32,
    pub is_binary: Option<bool>,
    pub detected_mime: Option<String>,
    pub file_category: Option<String>,
    pub text_encoding: Option<String>,
    pub detected_language: Option<String>,
    pub created_at: String,
}

impl From<docs_node_attachments::Model> for DocNodeAttachmentOutput {
    fn from(m: docs_node_attachments::Model) -> Self {
        Self {
            id: m.id.to_string(),
            space_id: m.space_id.to_string(),
            rel_path: m.rel_path,
            storage_key: m.storage_key,
            file_name: m.file_name,
            file_type: m.file_type,
            file_size: m.file_size,
            is_binary: m.is_binary,
            detected_mime: m.detected_mime,
            file_category: m.file_category,
            text_encoding: m.text_encoding,
            detected_language: m.detected_language,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeMetaOutput {
    pub space_id: String,
    pub rel_path: String,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub icon: Option<String>,
    pub cover_image: Option<String>,
    pub tags: Vec<String>,
    pub last_opened_at: Option<String>,
    pub sort_order: i32,
    pub word_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<docs_node_meta::Model> for DocNodeMetaOutput {
    fn from(m: docs_node_meta::Model) -> Self {
        Self {
            space_id: m.space_id.to_string(),
            rel_path: m.rel_path,
            is_favorite: m.is_favorite,
            is_pinned: m.is_pinned,
            is_archived: m.is_archived,
            icon: m.icon,
            cover_image: m.cover_image,
            tags: tags_from_json(m.tags),
            last_opened_at: m.last_opened_at.map(|d| d.to_rfc3339()),
            sort_order: m.sort_order,
            word_count: m.word_count,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}
