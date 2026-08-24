//! `SeaORM` Entity for durable Yjs document snapshots.

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(schema_name = "docs", table_name = "docs_collab_states")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub node_id: Uuid,
    pub yjs_state: Vec<u8>,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::docs_node_meta::Entity",
        from = "Column::NodeId",
        to = "super::docs_node_meta::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    DocsNodeMeta,
}

impl Related<super::docs_node_meta::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DocsNodeMeta.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
