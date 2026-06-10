//! Re-export all model types from db/entities for convenience.
//!
//! The original monolith code used `crate::apps::docs::models::*` paths.
//! In the standalone app, models live in `db::entities::mod.rs`.
//! This module re-exports them for backward compatibility.

pub use crate::db::entities::{
    DocNodeAttachmentOutput, DocNodeCommentOutput, DocNodeListItem, DocNodeMetaOutput, DocNodeOutput,
    DocNodeVersionDetailOutput, DocNodeVersionOutput, DocSpaceOutput,
};
