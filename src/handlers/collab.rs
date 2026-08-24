use axum::extract::{
    Path, Query, State,
    ws::{Message, WebSocket, WebSocketUpgrade},
};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::sync::Arc;
use ts_rs::TS;
use uuid::Uuid;
use yrs::encoding::read::Read as YrsRead;
use yrs::sync::awareness::AwarenessUpdate;
use yrs::sync::protocol::{DefaultProtocol, MSG_AWARENESS, Protocol};
use yrs::updates::decoder::{Decode, DecoderV1};
use yrs::updates::encoder::{Encode, Encoder};

use super::{get_space, parse_uuid};
use crate::db::repos::node_meta_repo::{DocNodeMetaRepo, UpsertDocNodeMetaInput};
use crate::error::AppError;
use crate::handlers::AppCtx;
use crate::handlers::user::AuthUser;
use crate::services::collab::CollabRoom;
use crate::services::path_utils;

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct CollabQuery {
    pub node_id: Option<String>,
    pub rel_path: Option<String>,
}

pub async fn collab_ws(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(auth): AuthUser,
    Path(space_id): Path<String>,
    Query(q): Query<CollabQuery>,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse, AppError> {
    open_collab(ctx, auth, space_id, q, ws).await
}

pub async fn collab_ws_room(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(auth): AuthUser,
    Path((space_id, _room)): Path<(String, String)>,
    Query(q): Query<CollabQuery>,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse, AppError> {
    open_collab(ctx, auth, space_id, q, ws).await
}

async fn open_collab(
    ctx: Arc<AppCtx>,
    auth: Uuid,
    space_id: String,
    q: CollabQuery,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse, AppError> {
    let user_id: Uuid = auth;
    get_space(&ctx, &space_id).await?;
    let parsed_space_id = parse_uuid(&space_id)?;
    let meta = if let Some(node_id) = q.node_id.as_deref() {
        DocNodeMetaRepo::find_by_node_id(&ctx.db, parsed_space_id, parse_uuid(node_id)?)
            .await?
            .ok_or_else(|| AppError::NotFound("document not found".into()))?
    } else {
        let rel_path = q
            .rel_path
            .as_deref()
            .ok_or_else(|| AppError::BadRequest("nodeId or relPath is required".into()))?;
        path_utils::validate_relative_path(rel_path)?;
        DocNodeMetaRepo::upsert(&ctx.db, parsed_space_id, rel_path, UpsertDocNodeMetaInput::default()).await?
    };
    Ok(ws.on_upgrade(move |socket| handle_collab_session(ctx, user_id, meta.id, socket)))
}

async fn handle_collab_session(ctx: Arc<AppCtx>, user_id: Uuid, node_id: Uuid, socket: WebSocket) {
    let key = node_id.to_string();
    let room = match ctx.collab.get_or_create_room(node_id).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("collab: failed to create room {key}: {e}");
            return;
        }
    };
    let (conn_id, mut rx) = room.add_client().await;
    tracing::debug!("collab: user {user_id} joined room {key} (conn={conn_id})");
    let (mut ws_sink, mut ws_stream) = socket.split();
    if let Err(e) = send_initial_sync(&room, conn_id).await {
        tracing::warn!("collab: initial sync failed: {e}");
        room.remove_client(conn_id).await;
        return;
    }
    let send_task = tokio::spawn(async move {
        while let Some(data) = rx.recv().await {
            if ws_sink.send(Message::Binary(data.into())).await.is_err() {
                break;
            }
        }
    });
    while let Some(Ok(msg)) = ws_stream.next().await {
        match msg {
            Message::Binary(data) => handle_incoming_message(&ctx, &room, conn_id, &data, &key, user_id).await,
            Message::Close(_) => break,
            _ => {}
        }
    }
    if let Some(removal_msg) = room.remove_client_awareness(conn_id).await {
        room.broadcast_except(conn_id, &removal_msg).await;
    }
    room.remove_client(conn_id).await;
    if room.connection_count() == 0
        && room.is_dirty()
        && let Err(error) = ctx.collab.persist_room(&room).await
    {
        tracing::error!(%error, "collab: disconnect persistence failed for room {key}");
    }
    send_task.abort();
}

async fn send_initial_sync(room: &CollabRoom, conn_id: u64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let awareness = room.awareness.read().await;
    let protocol = DefaultProtocol;
    let mut encoder = yrs::updates::encoder::EncoderV1::new();
    protocol.start(&awareness, &mut encoder)?;
    room.send_to(conn_id, encoder.to_vec()).await;
    Ok(())
}
async fn handle_incoming_message(ctx: &AppCtx, room: &CollabRoom, conn_id: u64, data: &[u8], key: &str, user_id: Uuid) {
    if room.is_invalidated() {
        return;
    }
    let awareness = room.awareness.read().await;
    let replies = match DefaultProtocol.handle(&awareness, data) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("collab: protocol error in room {key} from {user_id}: {e}");
            return;
        }
    };
    drop(awareness);
    for reply in &replies {
        room.send_to(conn_id, reply.encode_v1()).await;
    }
    if let Some(client_id) = parse_awareness_client_id(data) {
        room.track_awareness_client(conn_id, client_id).await;
        room.broadcast_except(conn_id, data).await;
    } else if is_document_update(data) {
        room.mark_dirty();
        if let Err(error) = ctx.collab.persist_room(room).await {
            tracing::error!(%error, "collab: refused to broadcast unpersisted update for room {key}");
            return;
        }
        room.broadcast_except(conn_id, data).await;
    }
}

fn is_document_update(data: &[u8]) -> bool {
    let mut decoder = DecoderV1::from(data);
    let outer: u8 = match decoder.read_var() {
        Ok(value) => value,
        Err(_) => return false,
    };
    if outer != yrs::sync::protocol::MSG_SYNC {
        return false;
    }
    let inner: u8 = match decoder.read_var() {
        Ok(value) => value,
        Err(_) => return false,
    };
    matches!(
        inner,
        yrs::sync::protocol::MSG_SYNC_STEP_2 | yrs::sync::protocol::MSG_SYNC_UPDATE
    )
}
fn parse_awareness_client_id(data: &[u8]) -> Option<u64> {
    let mut decoder = DecoderV1::from(data);
    let tag: u8 = decoder.read_var().ok()?;
    if tag != MSG_AWARENESS {
        return None;
    }
    let update = AwarenessUpdate::decode(&mut decoder).ok()?;
    if update.clients.len() != 1 {
        return None;
    }
    update.clients.keys().next().copied()
}
