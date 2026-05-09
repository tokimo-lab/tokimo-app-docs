use serde::Serialize;
use ts_rs::TS;

use crate::db::entities::{docs_node_attachments, docs_node_versions, docs_nodes, docs_spaces};

/// Doc space output
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocSpaceOutput {
    pub id: String,
    pub name: String,
    pub avatar: Option<serde_json::Value>,
    pub description: Option<String>,
    pub local_path: Option<String>,
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
            local_path: m.local_path,
            sort_order: m.sort_order,
            created_at: m.created_at.map(|d| d.to_rfc3339()),
            updated_at: m.updated_at.map(|d| d.to_rfc3339()),
        }
    }
}

/// Node list item (Phase 3: built from filesystem walk, sidebar/tree — no content)
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeListItem {
    pub id: String,
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

/// Full node detail (includes content)
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeOutput {
    pub id: String,
    pub space_id: String,
    pub parent_id: Option<String>,
    pub r#type: String,
    pub title: String,
    pub content: Option<serde_json::Value>,
    pub icon: Option<String>,
    pub cover_image: Option<String>,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub word_count: i32,
    pub sort_order: i32,
    pub last_opened_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<docs_nodes::Model> for DocNodeOutput {
    fn from(m: docs_nodes::Model) -> Self {
        Self {
            id: m.id.to_string(),
            space_id: m.space_id.to_string(),
            parent_id: m.parent_id.map(|id| id.to_string()),
            r#type: m.r#type,
            title: m.title,
            content: m.content,
            icon: m.icon,
            cover_image: m.cover_image,
            tags: m.tags.unwrap_or_default(),
            is_favorite: m.is_favorite,
            is_pinned: m.is_pinned,
            is_archived: m.is_archived,
            word_count: m.word_count,
            sort_order: m.sort_order,
            last_opened_at: m.last_opened_at.map(|d| d.to_rfc3339()),
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}

/// Version list item (without content)
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeVersionOutput {
    pub id: String,
    pub node_id: String,
    pub version: i32,
    pub title: String,
    pub word_count: i32,
    pub created_at: String,
}

impl From<docs_node_versions::Model> for DocNodeVersionOutput {
    fn from(m: docs_node_versions::Model) -> Self {
        Self {
            id: m.id.to_string(),
            node_id: m.node_id.to_string(),
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
    pub node_id: String,
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
            node_id: m.node_id.to_string(),
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
    pub node_id: String,
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
    pub node_id: String,
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
            node_id: m.node_id.to_string(),
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
