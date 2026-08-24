//! `SeaORM` Entity for vfs table

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(schema_name = "public", table_name = "vfs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(column_type = "Text")]
    pub name: String,
    #[sea_orm(column_type = "Text")]
    pub r#type: String,
    #[sea_orm(column_type = "JsonBinary", nullable)]
    pub config: Option<Json>,
    pub sort_order: i32,
    pub last_scan_at: Option<DateTimeWithTimeZone>,
    pub created_at: Option<DateTimeWithTimeZone>,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::docs_spaces::Entity")]
    DocsSpaces,
}

impl Related<super::docs_spaces::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DocsSpaces.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{DbBackend, EntityTrait, QueryTrait};

    #[test]
    fn entity_queries_public_schema() {
        let statement = Entity::find_by_id(Uuid::nil()).build(DbBackend::Postgres);

        assert!(statement.to_string().contains(r#""public"."vfs""#));
    }
}
