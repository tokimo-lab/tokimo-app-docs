//! `SeaORM` Entity for users table

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(schema_name = "docs", table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(column_type = "Text")]
    pub name: String,
    #[sea_orm(column_type = "Text", unique)]
    pub email: String,
    #[sea_orm(column_type = "Text")]
    pub password_hash: String,
    pub last_login_at: Option<DateTimeWithTimeZone>,
    pub created_at: Option<DateTimeWithTimeZone>,
    pub otp_enabled: bool,
    #[sea_orm(column_type = "Text", nullable)]
    pub otp_secret: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::docs_node_comments::Entity")]
    DocsNodeComments,
    #[sea_orm(has_one = "super::docs_whiteboard_user_libraries::Entity")]
    DocsWhiteboardUserLibraries,
}

impl Related<super::docs_node_comments::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DocsNodeComments.def()
    }
}

impl Related<super::docs_whiteboard_user_libraries::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DocsWhiteboardUserLibraries.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
