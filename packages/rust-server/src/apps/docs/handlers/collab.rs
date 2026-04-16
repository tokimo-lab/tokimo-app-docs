//! WebSocket handler for Yjs collaborative editing.
//!
//! Each connection joins a document room identified by `node_id`.
//! Binary frames carry y-sync protocol messages (sync + awareness).

use std::sync::Arc;

use axum::{
    extract::{
        Path, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use uuid::Uuid;
use yrs::encoding::read::Read as YrsRead;
use yrs::sync::awareness::AwarenessUpdate;
use yrs::sync::protocol::{DefaultProtocol, MSG_AWARENESS, Protocol};
use yrs::updates::decoder::{Decode, DecoderV1};
use yrs::updates::encoder::{Encode, Encoder};

use crate::AppState;
use crate::apps::docs::services::collab::CollabRoom;
use crate::error::AppError;
use crate::handlers::user::AuthUser;

/// GET /api/apps/docs/collab/{node_id} — upgrade to WebSocket.
pub async fn collab_ws(
    State(state): State<Arc<AppState>>,
    AuthUser(auth): AuthUser,
    Path(node_id): Path<Uuid>,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse, AppError> {
    let user_id: Uuid = auth
        .user_id
        .parse()
        .map_err(|_| AppError::Internal("invalid user_id".into()))?;

    // Verify the node exists
    {
        use crate::db::entities::doc_nodes;
        use sea_orm::*;
        doc_nodes::Entity::find_by_id(node_id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("node not found".into()))?;
    }

    Ok(ws.on_upgrade(move |socket| handle_collab_session(state, user_id, node_id, socket)))
}

async fn handle_collab_session(state: Arc<AppState>, user_id: Uuid, node_id: Uuid, socket: WebSocket) {
    let room = match state.collab.get_or_create_room(node_id).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("collab: failed to create room for {node_id}: {e}");
            return;
        }
    };

    let (conn_id, mut rx) = room.add_client().await;
    tracing::debug!(
        "collab: user {user_id} joined room {node_id} (conn={conn_id}, clients: {})",
        room.connection_count()
    );

    let (mut ws_sink, mut ws_stream) = socket.split();

    // Send initial sync: SyncStep1 + current awareness state
    if let Err(e) = send_initial_sync(&room, conn_id).await {
        tracing::warn!("collab: failed to queue initial sync for {user_id}: {e}");
        room.remove_client(conn_id).await;
        return;
    }

    // Spawn send task: outbound channel → WebSocket sink
    let send_task = tokio::spawn(async move {
        while let Some(data) = rx.recv().await {
            if ws_sink.send(Message::Binary(data.into())).await.is_err() {
                break;
            }
        }
    });

    // Process incoming binary frames
    let room_ref = &room;
    while let Some(Ok(msg)) = ws_stream.next().await {
        match msg {
            Message::Binary(data) => {
                handle_incoming_message(room_ref, conn_id, &data, node_id, user_id).await;
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // Client disconnected — broadcast awareness removal before unregistering
    if let Some(removal_msg) = room.remove_client_awareness(conn_id).await {
        room.broadcast_except(conn_id, &removal_msg).await;
    }
    room.remove_client(conn_id).await;
    let remaining = room.connection_count();
    tracing::debug!("collab: user {user_id} left room {node_id} (clients: {remaining})");

    if remaining == 0 {
        state.collab.on_last_client_disconnect(node_id).await;
    }

    send_task.abort();
}

/// Send initial sync messages: SyncStep1 (our state vector) to the new client.
async fn send_initial_sync(room: &CollabRoom, conn_id: u64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let awareness = room.awareness.read().await;
    let protocol = DefaultProtocol;

    // Encode SyncStep1 (server → client: "here's my state vector, send me what I'm missing")
    let mut encoder = yrs::updates::encoder::EncoderV1::new();
    protocol.start(&awareness, &mut encoder)?;
    let init_msg = encoder.to_vec();
    drop(awareness);

    room.send_to(conn_id, init_msg).await;
    Ok(())
}

/// Handle an incoming binary Yjs protocol message from a client.
///
/// Message routing:
/// - SyncStep1 → reply with SyncStep2 to sender only
/// - SyncStep2/Update → apply to doc, forward raw bytes to all OTHER clients
/// - Awareness → apply, forward raw bytes to ALL clients
async fn handle_incoming_message(room: &CollabRoom, conn_id: u64, data: &[u8], node_id: Uuid, user_id: Uuid) {
    let protocol = DefaultProtocol;

    // Use Protocol::handle to process the message (applies updates internally)
    let awareness = room.awareness.read().await;
    let replies = match protocol.handle(&awareness, data) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("collab: protocol error in room {node_id} from {user_id}: {e}");
            return;
        }
    };
    drop(awareness);

    // Send protocol replies (e.g. SyncStep2) to the sender only
    for reply in &replies {
        let encoded = reply.encode_v1();
        room.send_to(conn_id, encoded).await;
    }

    // Forward the raw incoming message to other clients for doc sync.
    // SyncStep1 is harmless for others (they'd just reply with SyncStep2
    // which the server handles), but wasteful. For simplicity, forward
    // all messages. The main cost is the SyncStep1 echo which is rare
    // (only on initial connect).
    room.broadcast_except(conn_id, data).await;

    // Track awareness client ID for removal on disconnect.
    // Parse the message tag to check if it's an awareness update.
    if let Some(client_id) = parse_awareness_client_id(data) {
        room.track_awareness_client(conn_id, client_id).await;
    }

    // Mark dirty if we received a message that could modify the doc
    // (SyncStep2, Update, or Awareness)
    if !replies.is_empty() || data.len() > 1 {
        room.mark_dirty();
    }
}

/// Extract the awareness client ID from a single-client awareness update.
/// Returns `None` if the message is not awareness or contains multiple clients.
fn parse_awareness_client_id(data: &[u8]) -> Option<u64> {
    let mut decoder = DecoderV1::from(data);
    let tag: u8 = decoder.read_var().ok()?;
    if tag != MSG_AWARENESS {
        return None;
    }
    let update = AwarenessUpdate::decode(&mut decoder).ok()?;
    // Only trust single-client updates (a client's own state)
    if update.clients.len() != 1 {
        return None;
    }
    update.clients.keys().next().copied()
}
