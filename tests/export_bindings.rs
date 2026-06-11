//! ts-rs type export — run with `cargo test -p tokimo-app-docs -- export_bindings`
//! Generates TypeScript types to `ui/src/generated/rust-types/`.
//!
//! Set `TS_RS_EXPORT_DIR=apps/tokimo-app-docs/ui/src/generated/rust-types` when running
//! from the workspace root.

use ts_rs::TS;

// ── Entity output types (db/entities/mod.rs) ────────────────────
use tokimo_app_docs::db::entities::{
    DocNodeAttachmentOutput, DocNodeCommentOutput, DocNodeListItem, DocNodeMetaOutput, DocNodeOutput,
    DocNodeVersionDetailOutput, DocNodeVersionOutput, DocSpaceOutput,
};

// ── handlers::space ─────────────────────────────────────────────
use tokimo_app_docs::handlers::space::{CreateSpaceInput, UpdateSpaceInput};

// ── handlers::crud ──────────────────────────────────────────────
use tokimo_app_docs::handlers::crud::{CreateNodeInput, MoveNodeQuery, NodeQuery, UpdateNodeInput};

// ── handlers::browse ────────────────────────────────────────────
use tokimo_app_docs::handlers::browse::{ListNodesQuery, RelPathQuery as BrowseRelPathQuery};

// ── handlers::comments ──────────────────────────────────────────
use tokimo_app_docs::handlers::comments::{
    CreateCommentInput, RelPathQuery as CommentsRelPathQuery, ResolveCommentInput,
};

// ── handlers::collab ────────────────────────────────────────────
use tokimo_app_docs::handlers::collab::CollabQuery;

// ── handlers::versions ──────────────────────────────────────────
use tokimo_app_docs::handlers::versions::RelPathQuery as VersionsRelPathQuery;

// ── handlers::view_state ────────────────────────────────────────
use tokimo_app_docs::handlers::view_state::{PutViewStateBody, RelPathQuery as ViewStateRelPathQuery};

// ── handlers::view_ctx ──────────────────────────────────────────
use tokimo_app_docs::handlers::view_ctx::ViewCtxOutput;

// ── handlers::base_records ──────────────────────────────────────
use tokimo_app_docs::handlers::base_records::{
    BaseRecordOutput, BatchDeleteInput, BatchDeleteOutput, CreateRecordInput, UpdateRecordInput,
};

// ── handlers::base_meta ─────────────────────────────────────────
use tokimo_app_docs::handlers::base_meta::{BaseMetaOutput, RelPathQuery as BaseMetaRelPathQuery, UpdateBaseMetaInput};

// ── handlers::whiteboard_library ────────────────────────────────
use tokimo_app_docs::handlers::whiteboard_library::{LibraryAuthor, LibraryCatalogItem, SaveUserLibraryBody};

#[test]
fn export_bindings() {
    // Force ts-rs to generate bindings by calling export_all on each type.
    // This ensures the #[ts(export)] attribute triggers file generation.
    DocSpaceOutput::export_all(&Default::default()).unwrap();
    DocNodeListItem::export_all(&Default::default()).unwrap();
    DocNodeOutput::export_all(&Default::default()).unwrap();
    DocNodeVersionOutput::export_all(&Default::default()).unwrap();
    DocNodeVersionDetailOutput::export_all(&Default::default()).unwrap();
    DocNodeCommentOutput::export_all(&Default::default()).unwrap();
    DocNodeAttachmentOutput::export_all(&Default::default()).unwrap();
    DocNodeMetaOutput::export_all(&Default::default()).unwrap();

    CreateSpaceInput::export_all(&Default::default()).unwrap();
    UpdateSpaceInput::export_all(&Default::default()).unwrap();

    CreateNodeInput::export_all(&Default::default()).unwrap();
    NodeQuery::export_all(&Default::default()).unwrap();
    UpdateNodeInput::export_all(&Default::default()).unwrap();
    MoveNodeQuery::export_all(&Default::default()).unwrap();

    ListNodesQuery::export_all(&Default::default()).unwrap();
    BrowseRelPathQuery::export_all(&Default::default()).unwrap();

    CommentsRelPathQuery::export_all(&Default::default()).unwrap();
    CreateCommentInput::export_all(&Default::default()).unwrap();
    ResolveCommentInput::export_all(&Default::default()).unwrap();

    CollabQuery::export_all(&Default::default()).unwrap();

    VersionsRelPathQuery::export_all(&Default::default()).unwrap();

    PutViewStateBody::export_all(&Default::default()).unwrap();
    ViewStateRelPathQuery::export_all(&Default::default()).unwrap();

    ViewCtxOutput::export_all(&Default::default()).unwrap();

    BaseRecordOutput::export_all(&Default::default()).unwrap();
    BatchDeleteOutput::export_all(&Default::default()).unwrap();
    CreateRecordInput::export_all(&Default::default()).unwrap();
    UpdateRecordInput::export_all(&Default::default()).unwrap();
    BatchDeleteInput::export_all(&Default::default()).unwrap();

    BaseMetaOutput::export_all(&Default::default()).unwrap();
    UpdateBaseMetaInput::export_all(&Default::default()).unwrap();
    BaseMetaRelPathQuery::export_all(&Default::default()).unwrap();

    LibraryCatalogItem::export_all(&Default::default()).unwrap();
    LibraryAuthor::export_all(&Default::default()).unwrap();
    SaveUserLibraryBody::export_all(&Default::default()).unwrap();
}
