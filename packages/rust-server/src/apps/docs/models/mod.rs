use sea_orm::entity::prelude::DateTimeWithTimeZone;
use sea_orm::DerivePartialModel;
use serde::Serialize;
use ts_rs::TS;
use uuid::Uuid;

use crate::db::entities::{doc_node_versions, doc_nodes};

/// Node list item (sidebar/tree — no content)
#[derive(Debug, Clone, Serialize, DerivePartialModel, TS)]
#[sea_orm(entity = "doc_nodes::Entity")]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeListItem {
    #[ts(type = "string")]
    pub id: Uuid,
    #[ts(type = "string")]
    pub app_id: Uuid,
    #[ts(type = "string | null")]
    pub parent_id: Option<Uuid>,
    pub r#type: String,
    pub title: String,
    pub icon: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub word_count: i32,
    pub sort_order: i32,
    #[ts(type = "string")]
    pub created_at: DateTimeWithTimeZone,
    #[ts(type = "string")]
    pub updated_at: DateTimeWithTimeZone,
}

/// Full node detail (includes content)
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocNodeOutput {
    pub id: String,
    pub app_id: String,
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
    pub created_at: String,
    pub updated_at: String,
}

impl From<doc_nodes::Model> for DocNodeOutput {
    fn from(m: doc_nodes::Model) -> Self {
        Self {
            id: m.id.to_string(),
            app_id: m.app_id.to_string(),
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

impl From<doc_node_versions::Model> for DocNodeVersionOutput {
    fn from(m: doc_node_versions::Model) -> Self {
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

impl From<doc_node_versions::Model> for DocNodeVersionDetailOutput {
    fn from(m: doc_node_versions::Model) -> Self {
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
