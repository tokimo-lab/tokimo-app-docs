use sea_orm::entity::prelude::DateTimeWithTimeZone;
use sea_orm::DerivePartialModel;
use serde::Serialize;
use ts_rs::TS;
use uuid::Uuid;

use crate::db::entities::{doc_folders, docs};

/// Doc list item (sidebar / list view — no content)
#[derive(Debug, Clone, Serialize, DerivePartialModel, TS)]
#[sea_orm(entity = "docs::Entity")]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocListItem {
    #[ts(type = "string")]
    pub id: Uuid,
    #[ts(type = "string")]
    pub app_id: Uuid,
    #[ts(type = "string | null")]
    pub folder_id: Option<Uuid>,
    pub title: String,
    pub icon: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub word_count: i32,
    #[ts(type = "string")]
    pub created_at: DateTimeWithTimeZone,
    #[ts(type = "string")]
    pub updated_at: DateTimeWithTimeZone,
}

/// Full doc detail (includes content JSON)
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocOutput {
    pub id: String,
    pub app_id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub content: Option<serde_json::Value>,
    pub icon: Option<String>,
    pub cover_image: Option<String>,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub word_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<docs::Model> for DocOutput {
    fn from(m: docs::Model) -> Self {
        Self {
            id: m.id.to_string(),
            app_id: m.app_id.to_string(),
            folder_id: m.folder_id.map(|id| id.to_string()),
            title: m.title,
            content: m.content,
            icon: m.icon,
            cover_image: m.cover_image,
            tags: m.tags.unwrap_or_default(),
            is_favorite: m.is_favorite,
            is_pinned: m.is_pinned,
            is_archived: m.is_archived,
            word_count: m.word_count,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}

/// Doc folder output
#[derive(Debug, Clone, Serialize, DerivePartialModel, TS)]
#[sea_orm(entity = "doc_folders::Entity")]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocFolderOutput {
    #[ts(type = "string")]
    pub id: Uuid,
    #[ts(type = "string")]
    pub app_id: Uuid,
    #[ts(type = "string | null")]
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub icon: Option<String>,
    pub sort_order: i32,
    #[ts(type = "string")]
    pub created_at: DateTimeWithTimeZone,
    #[ts(type = "string")]
    pub updated_at: DateTimeWithTimeZone,
}

/// Doc comment output
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DocCommentOutput {
    pub id: String,
    pub doc_id: String,
    pub user_id: String,
    pub user_name: String,
    pub comment_key: String,
    pub content: String,
    pub is_resolved: bool,
    pub parent_id: Option<String>,
    pub replies: Vec<DocCommentOutput>,
    pub created_at: String,
    pub updated_at: String,
}
