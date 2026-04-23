//! Collaborative editing service — Yjs room manager.
//!
//! Each `doc_node` gets its own Yjs document room. Multiple WebSocket
//! clients can join a room; updates are broadcast to all participants and
//! periodically persisted to PostgreSQL (`docs_nodes.yjs_state`).

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use dashmap::DashMap;
use sea_orm::DatabaseConnection;
use tokio::sync::mpsc;
use uuid::Uuid;
use yrs::encoding::write::Write as YrsWrite;
use yrs::sync::Awareness;
use yrs::sync::protocol::MSG_AWARENESS;
use yrs::updates::encoder::{Encode, Encoder, EncoderV1};
use yrs::{Doc, Options, ReadTxn, Transact};

use crate::db::entities::docs_nodes;
use crate::error::AppError;

/// How long a room stays in memory with no connections before being unloaded.
const ROOM_IDLE_TIMEOUT: Duration = Duration::from_mins(5);

/// Interval for periodic persistence of dirty rooms.
const PERSIST_INTERVAL: Duration = Duration::from_secs(30);

/// Interval for checking idle rooms.
const CLEANUP_INTERVAL: Duration = Duration::from_mins(1);

/// An in-memory collaborative editing room for a single document/sheet.
pub struct CollabRoom {
    pub awareness: tokio::sync::RwLock<Awareness>,
    /// Per-client outbound channels: conn_id → sender.
    clients: tokio::sync::RwLock<HashMap<u64, mpsc::UnboundedSender<Vec<u8>>>>,
    /// Maps conn_id → awareness client_id for broadcasting removal on disconnect.
    awareness_client_ids: tokio::sync::RwLock<HashMap<u64, u64>>,
    /// Fast sync counter (mirrors `clients.len()`).
    client_count: AtomicU32,
    /// Whether the Yjs doc has been modified since last persist.
    dirty: AtomicBool,
    /// Last time a client was active in this room.
    last_activity: std::sync::Mutex<Instant>,
    /// Monotonically increasing connection ID generator.
    next_conn_id: AtomicU64,
}

impl CollabRoom {
    fn new(awareness: Awareness) -> Self {
        Self {
            awareness: tokio::sync::RwLock::new(awareness),
            clients: tokio::sync::RwLock::new(HashMap::new()),
            awareness_client_ids: tokio::sync::RwLock::new(HashMap::new()),
            client_count: AtomicU32::new(0),
            dirty: AtomicBool::new(false),
            last_activity: std::sync::Mutex::new(Instant::now()),
            next_conn_id: AtomicU64::new(1),
        }
    }

    /// Register a new client. Returns (conn_id, receiver for outbound messages).
    pub async fn add_client(&self) -> (u64, mpsc::UnboundedReceiver<Vec<u8>>) {
        let conn_id = self.next_conn_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = mpsc::unbounded_channel();
        self.clients.write().await.insert(conn_id, tx);
        self.client_count.fetch_add(1, Ordering::Relaxed);
        self.touch();
        (conn_id, rx)
    }

    /// Unregister a client by connection ID.
    pub async fn remove_client(&self, conn_id: u64) {
        self.clients.write().await.remove(&conn_id);
        self.client_count.fetch_sub(1, Ordering::Relaxed);
        self.touch();
    }

    /// Associate a connection with its Yjs awareness client ID (set once).
    pub async fn track_awareness_client(&self, conn_id: u64, client_id: u64) {
        use std::collections::hash_map::Entry;
        if let Entry::Vacant(e) = self.awareness_client_ids.write().await.entry(conn_id) {
            e.insert(client_id);
        }
    }

    /// Remove awareness state for a disconnected client and return the
    /// encoded removal message to broadcast to remaining peers.
    pub async fn remove_client_awareness(&self, conn_id: u64) -> Option<Vec<u8>> {
        let client_id = self.awareness_client_ids.write().await.remove(&conn_id)?;

        let awareness = self.awareness.read().await;

        // remove_state sets data=None and increments the clock
        awareness.remove_state(client_id);

        // Encode the removal as a standard awareness message
        let update = awareness.update_with_clients([client_id]).ok()?;
        let mut encoder = EncoderV1::new();
        encoder.write_var(MSG_AWARENESS);
        update.encode(&mut encoder);
        Some(encoder.to_vec())
    }

    pub fn connection_count(&self) -> u32 {
        self.client_count.load(Ordering::Relaxed)
    }

    /// Send a message to a specific client (e.g. protocol replies).
    pub async fn send_to(&self, conn_id: u64, data: Vec<u8>) {
        if let Some(tx) = self.clients.read().await.get(&conn_id) {
            let _ = tx.send(data);
        }
    }

    /// Broadcast to all clients except the sender (used for doc updates).
    pub async fn broadcast_except(&self, sender_conn: u64, data: &[u8]) {
        let clients = self.clients.read().await;
        for (&conn_id, tx) in clients.iter() {
            if conn_id != sender_conn {
                let _ = tx.send(data.to_vec());
            }
        }
    }

    /// Broadcast to all clients (used for awareness updates).
    pub async fn broadcast_all(&self, data: &[u8]) {
        let clients = self.clients.read().await;
        for tx in clients.values() {
            let _ = tx.send(data.to_vec());
        }
    }

    pub fn mark_dirty(&self) {
        self.dirty.store(true, Ordering::Relaxed);
        self.touch();
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty.load(Ordering::Relaxed)
    }

    pub fn clear_dirty(&self) {
        self.dirty.store(false, Ordering::Relaxed);
    }

    fn touch(&self) {
        if let Ok(mut last) = self.last_activity.lock() {
            *last = Instant::now();
        }
    }

    fn idle_duration(&self) -> Duration {
        self.last_activity.lock().map_or(Duration::ZERO, |t| t.elapsed())
    }
}

/// Manages all active collaboration rooms.
pub struct CollabService {
    rooms: DashMap<Uuid, Arc<CollabRoom>>,
    /// Prevents concurrent room creation for the same node_id.
    creation_lock: tokio::sync::Mutex<()>,
    db: DatabaseConnection,
}

impl CollabService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self {
            rooms: DashMap::new(),
            creation_lock: tokio::sync::Mutex::new(()),
            db,
        }
    }

    /// Get or create a room for the given doc node.
    ///
    /// On first access, loads `yjs_state` from PostgreSQL and initializes the
    /// Yjs document. Subsequent calls return the cached room.
    pub async fn get_or_create_room(&self, node_id: Uuid) -> Result<Arc<CollabRoom>, AppError> {
        // Fast path: room already exists
        if let Some(room) = self.rooms.get(&node_id) {
            return Ok(Arc::clone(room.value()));
        }

        // Slow path: acquire creation lock, double-check, then load from DB
        let _guard = self.creation_lock.lock().await;
        if let Some(room) = self.rooms.get(&node_id) {
            return Ok(Arc::clone(room.value()));
        }

        let yjs_state = self.load_yjs_state(node_id).await?;
        let doc = Self::create_doc(node_id, yjs_state.as_deref());
        let awareness = Awareness::new(doc);
        let room = Arc::new(CollabRoom::new(awareness));
        self.rooms.insert(node_id, Arc::clone(&room));
        Ok(room)
    }

    /// Persist all dirty rooms to PostgreSQL.
    pub async fn persist_dirty_rooms(&self) {
        let dirty_rooms: Vec<(Uuid, Arc<CollabRoom>)> = self
            .rooms
            .iter()
            .filter(|entry| entry.value().is_dirty())
            .map(|entry| (*entry.key(), Arc::clone(entry.value())))
            .collect();

        for (node_id, room) in dirty_rooms {
            if let Err(e) = self.persist_room(node_id, &room).await {
                tracing::error!("collab: failed to persist room {node_id}: {e}");
            }
        }
    }

    /// Persist a single room's Yjs state to PostgreSQL.
    pub async fn persist_room(&self, node_id: Uuid, room: &CollabRoom) -> Result<(), AppError> {
        let state = {
            let awareness = room.awareness.read().await;
            let doc = awareness.doc();
            let txn = doc.transact();
            txn.encode_state_as_update_v1(&yrs::StateVector::default())
        };

        self.save_yjs_state(node_id, &state).await?;
        room.clear_dirty();
        tracing::debug!("collab: persisted room {node_id} ({} bytes)", state.len());
        Ok(())
    }

    /// Remove idle rooms (no connections for `ROOM_IDLE_TIMEOUT`).
    /// Persists state before removal.
    pub async fn cleanup_idle_rooms(&self) {
        let idle_rooms: Vec<Uuid> = self
            .rooms
            .iter()
            .filter(|entry| {
                let room = entry.value();
                room.connection_count() == 0 && room.idle_duration() > ROOM_IDLE_TIMEOUT
            })
            .map(|entry| *entry.key())
            .collect();

        for node_id in idle_rooms {
            if let Some((_, room)) = self.rooms.remove(&node_id) {
                if room.is_dirty()
                    && let Err(e) = self.persist_room(node_id, &room).await
                {
                    tracing::error!("collab: failed to persist idle room {node_id}: {e}");
                }
                tracing::debug!("collab: unloaded idle room {node_id}");
            }
        }
    }

    /// Start background tasks for persistence and cleanup.
    pub fn start_background_tasks(self: &Arc<Self>) {
        let service = Arc::clone(self);
        tokio::spawn(async move {
            let mut persist_interval = tokio::time::interval(PERSIST_INTERVAL);
            let mut cleanup_interval = tokio::time::interval(CLEANUP_INTERVAL);
            persist_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            cleanup_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            loop {
                tokio::select! {
                    _ = persist_interval.tick() => {
                        service.persist_dirty_rooms().await;
                    }
                    _ = cleanup_interval.tick() => {
                        service.cleanup_idle_rooms().await;
                    }
                }
            }
        });
    }

    /// Called when the last client disconnects from a room.
    /// Immediately persists the room state.
    pub async fn on_last_client_disconnect(&self, node_id: Uuid) {
        if let Some(room) = self.rooms.get(&node_id)
            && room.is_dirty()
            && let Err(e) = self.persist_room(node_id, &room).await
        {
            tracing::error!("collab: failed to persist on last disconnect {node_id}: {e}");
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    fn create_doc(node_id: Uuid, yjs_state: Option<&[u8]>) -> Doc {
        let client_id = u64::from_le_bytes({
            let bytes = node_id.as_bytes();
            let mut buf = [0u8; 8];
            buf.copy_from_slice(&bytes[..8]);
            buf
        });
        let opts = Options {
            client_id,
            skip_gc: true,
            ..Default::default()
        };

        let doc = Doc::with_options(opts);

        if let Some(state) = yjs_state
            && !state.is_empty()
        {
            match yrs::updates::decoder::Decode::decode_v1(state) {
                Ok(update) => {
                    let mut txn = doc.transact_mut();
                    if let Err(e) = txn.apply_update(update) {
                        tracing::error!("collab: failed to apply stored state for {node_id}: {e}");
                    }
                }
                Err(e) => {
                    tracing::error!("collab: failed to decode stored state for {node_id}: {e}");
                }
            }
        }

        doc
    }

    async fn load_yjs_state(&self, node_id: Uuid) -> Result<Option<Vec<u8>>, AppError> {
        use sea_orm::*;

        let result = docs_nodes::Entity::find_by_id(node_id).one(&self.db).await?;

        Ok(result.and_then(|m| m.yjs_state))
    }

    async fn save_yjs_state(&self, node_id: Uuid, state: &[u8]) -> Result<(), AppError> {
        use sea_orm::sea_query::Expr;
        use sea_orm::*;

        docs_nodes::Entity::update_many()
            .col_expr(docs_nodes::Column::YjsState, Expr::value(state.to_vec()))
            .filter(docs_nodes::Column::Id.eq(node_id))
            .exec(&self.db)
            .await?;

        Ok(())
    }

    /// Invalidate any cached Y.Doc for the given node and clear `yjs_state` in DB.
    ///
    /// Called after the node's `content` was updated through a non-collab
    /// channel (e.g. VFS / REST PATCH), so that the next collab session loads
    /// a fresh empty Y.Doc which the client will re-seed from the new `content`.
    ///
    /// If the room is currently active (has connected clients), it is left
    /// alone; connected clients keep editing against the in-memory doc and
    /// will overwrite whatever was written externally on the next persist
    /// cycle. Choosing not to disrupt live sessions is intentional — the
    /// common case is one editor at a time, and losing live edits would be
    /// worse than briefly diverging from the shell-written content.
    /// Invalidate any cached Y.Doc for the given node and clear `yjs_state` in DB.
    ///
    /// If `force` is false and the room has active connections, this is a no-op:
    /// dropping a live room would disconnect editors and their subsequent writes
    /// will overwrite whatever was written externally on the next persist
    /// cycle. Choosing not to disrupt live sessions is intentional — the
    /// common case is one editor at a time, and losing live edits would be
    /// worse than briefly diverging from the shell-written content.
    ///
    /// `force=true` bypasses the live-connection check and is used by VFS writes
    /// because the filesystem is the authoritative source — otherwise stale
    /// cached Y.Doc state overrides freshly-synced content (e.g. attachment
    /// enrichment fields) the next time the client syncs.
    pub async fn invalidate_room(&self, node_id: Uuid, force: bool) -> Result<(), AppError> {
        use sea_orm::sea_query::Expr;
        use sea_orm::*;

        if !force && let Some(entry) = self.rooms.get(&node_id)
            && entry.value().connection_count() > 0
        {
            tracing::debug!(
                "collab: skip invalidate for active room {node_id} ({} clients)",
                entry.value().connection_count()
            );
            return Ok(());
        }
        self.rooms.remove(&node_id);

        docs_nodes::Entity::update_many()
            .col_expr(docs_nodes::Column::YjsState, Expr::value(Option::<Vec<u8>>::None))
            .filter(docs_nodes::Column::Id.eq(node_id))
            .exec(&self.db)
            .await?;

        tracing::debug!("collab: invalidated room {node_id} (external content update)");
        Ok(())
    }
}
