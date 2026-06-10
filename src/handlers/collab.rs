use axum::extract::{
    Path, Query, State,
    ws::{Message, WebSocket, WebSocketUpgrade},
};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;
use yrs::encoding::read::Read as YrsRead;
use yrs::sync::awareness::AwarenessUpdate;
use yrs::sync::protocol::{DefaultProtocol, MSG_AWARENESS, Protocol};
use yrs::updates::decoder::{Decode, DecoderV1};
use yrs::updates::encoder::{Encode, Encoder};

use super::{ensure_space_vfs, get_space, parse_uuid};
use crate::error::AppError;
use crate::handlers::AppCtx;
use crate::handlers::user::AuthUser;
use crate::services::collab::CollabRoom;
use crate::services::path_utils;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollabQuery {
    pub rel_path: String,
}

pub async fn collab_ws(
    State(ctx): State<Arc<AppCtx>>,
    AuthUser(auth): AuthUser,
    Path(space_id): Path<String>,
    Query(q): Query<CollabQuery>,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse, AppError> {
    let user_id: Uuid = auth;
    let space = get_space(&ctx, &space_id).await?;
    let (vfs, root_path) = ensure_space_vfs(&ctx, &space).await?;
    let path = path_utils::vfs_path(&root_path, &q.rel_path);
    let initial = vfs.read_bytes(&path, 0, None).await.ok();
    let key = format!("{}:{}", parse_uuid(&space_id)?, q.rel_path);
    Ok(ws.on_upgrade(move |socket| handle_collab_session(ctx, user_id, key, path, initial, socket)))
}

async fn handle_collab_session(
    ctx: Arc<AppCtx>,
    user_id: Uuid,
    key: String,
    path: std::path::PathBuf,
    initial: Option<Vec<u8>>,
    socket: WebSocket,
) {
    let room = match ctx.collab.get_or_create_room(key.clone(), initial).await {
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
            Message::Binary(data) => handle_incoming_message(&room, conn_id, &data, &key, user_id).await,
            Message::Close(_) => break,
            _ => {}
        }
    }
    if let Some(removal_msg) = room.remove_client_awareness(conn_id).await {
        room.broadcast_except(conn_id, &removal_msg).await;
    }
    room.remove_client(conn_id).await;
    if room.connection_count() == 0 && room.is_dirty() {
        let bytes = ctx.collab.encode_room_ctx(&room).await;
        let _ = ctx
            .sources
            .ensure_vfs("local")
            .await
            .map_err(AppError::Internal)
            .map(|_| ());
        tracing::debug!(
            "collab: room {key} dirty ctx size {} for path {}",
            bytes.len(),
            path.display()
        );
        room.clear_dirty();
        ctx.collab.on_last_client_disconnect(key);
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
async fn handle_incoming_message(room: &CollabRoom, conn_id: u64, data: &[u8], key: &str, user_id: Uuid) {
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
    room.broadcast_except(conn_id, data).await;
    if let Some(client_id) = parse_awareness_client_id(data) {
        room.track_awareness_client(conn_id, client_id).await;
    } else if !replies.is_empty() || data.len() > 1 {
        room.mark_dirty();
    }
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
