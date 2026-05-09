use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use dashmap::DashMap;
use sea_orm::DatabaseConnection;
use tokio::sync::mpsc;
use yrs::encoding::write::Write as YrsWrite;
use yrs::sync::Awareness;
use yrs::sync::protocol::MSG_AWARENESS;
use yrs::updates::encoder::{Encode, Encoder, EncoderV1};
use yrs::{Doc, Options, ReadTxn, Transact};

use crate::error::AppError;

const ROOM_IDLE_TIMEOUT: Duration = Duration::from_mins(5);
const PERSIST_INTERVAL: Duration = Duration::from_secs(30);
const CLEANUP_INTERVAL: Duration = Duration::from_mins(1);

pub struct CollabRoom {
    pub awareness: tokio::sync::RwLock<Awareness>,
    clients: tokio::sync::RwLock<HashMap<u64, mpsc::UnboundedSender<Vec<u8>>>>,
    awareness_client_ids: tokio::sync::RwLock<HashMap<u64, u64>>,
    client_count: AtomicU32,
    dirty: AtomicBool,
    last_activity: std::sync::Mutex<Instant>,
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
    pub async fn add_client(&self) -> (u64, mpsc::UnboundedReceiver<Vec<u8>>) {
        let id = self.next_conn_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = mpsc::unbounded_channel();
        self.clients.write().await.insert(id, tx);
        self.client_count.fetch_add(1, Ordering::Relaxed);
        self.touch();
        (id, rx)
    }
    pub async fn remove_client(&self, conn_id: u64) {
        self.clients.write().await.remove(&conn_id);
        self.client_count.fetch_sub(1, Ordering::Relaxed);
        self.touch();
    }
    pub async fn track_awareness_client(&self, conn_id: u64, client_id: u64) {
        self.awareness_client_ids
            .write()
            .await
            .entry(conn_id)
            .or_insert(client_id);
    }
    pub async fn remove_client_awareness(&self, conn_id: u64) -> Option<Vec<u8>> {
        let client_id = self.awareness_client_ids.write().await.remove(&conn_id)?;
        let awareness = self.awareness.read().await;
        awareness.remove_state(client_id);
        let update = awareness.update_with_clients([client_id]).ok()?;
        let mut enc = EncoderV1::new();
        enc.write_var(MSG_AWARENESS);
        update.encode(&mut enc);
        Some(enc.to_vec())
    }
    pub fn connection_count(&self) -> u32 {
        self.client_count.load(Ordering::Relaxed)
    }
    pub async fn send_to(&self, conn_id: u64, data: Vec<u8>) {
        if let Some(tx) = self.clients.read().await.get(&conn_id) {
            let _ = tx.send(data);
        }
    }
    pub async fn broadcast_except(&self, sender_conn: u64, data: &[u8]) {
        for (&id, tx) in self.clients.read().await.iter() {
            if id != sender_conn {
                let _ = tx.send(data.to_vec());
            }
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

pub struct CollabService {
    rooms: DashMap<String, Arc<CollabRoom>>,
    creation_lock: tokio::sync::Mutex<()>,
}
impl CollabService {
    pub fn new(_db: DatabaseConnection) -> Self {
        Self {
            rooms: DashMap::new(),
            creation_lock: tokio::sync::Mutex::new(()),
        }
    }
    pub async fn get_or_create_room(
        &self,
        key: String,
        yjs_state: Option<Vec<u8>>,
    ) -> Result<Arc<CollabRoom>, AppError> {
        if let Some(room) = self.rooms.get(&key) {
            return Ok(Arc::clone(room.value()));
        }
        let _guard = self.creation_lock.lock().await;
        if let Some(room) = self.rooms.get(&key) {
            return Ok(Arc::clone(room.value()));
        }
        let doc = Self::create_doc(&key, yjs_state.as_deref());
        let room = Arc::new(CollabRoom::new(Awareness::new(doc)));
        self.rooms.insert(key, Arc::clone(&room));
        Ok(room)
    }
    fn create_doc(key: &str, yjs_state: Option<&[u8]>) -> Doc {
        let mut bytes = [0u8; 8];
        for (i, b) in key.as_bytes().iter().take(8).enumerate() {
            bytes[i] = *b;
        }
        let doc = Doc::with_options(Options {
            client_id: u64::from_le_bytes(bytes),
            skip_gc: true,
            ..Default::default()
        });
        if let Some(state) = yjs_state.filter(|s| !s.is_empty())
            && let Ok(update) = yrs::updates::decoder::Decode::decode_v1(state)
        {
            let mut txn = doc.transact_mut();
            let _ = txn.apply_update(update);
        }
        doc
    }
    pub async fn encode_room_state(&self, room: &CollabRoom) -> Vec<u8> {
        let awareness = room.awareness.read().await;
        let doc = awareness.doc();
        let txn = doc.transact();
        txn.encode_state_as_update_v1(&yrs::StateVector::default())
    }
    pub fn persist_dirty_rooms(&self) {
        for entry in &self.rooms {
            entry.value().clear_dirty();
        }
    }
    pub fn cleanup_idle_rooms(&self) {
        let keys: Vec<String> = self
            .rooms
            .iter()
            .filter(|e| e.value().connection_count() == 0 && e.value().idle_duration() > ROOM_IDLE_TIMEOUT)
            .map(|e| e.key().clone())
            .collect();
        for key in keys {
            self.rooms.remove(&key);
        }
    }
    pub fn start_background_tasks(self: &Arc<Self>) {
        let service = Arc::clone(self);
        tokio::spawn(async move {
            let mut p = tokio::time::interval(PERSIST_INTERVAL);
            let mut c = tokio::time::interval(CLEANUP_INTERVAL);
            loop {
                tokio::select! { _ = p.tick() => service.persist_dirty_rooms(), _ = c.tick() => service.cleanup_idle_rooms() }
            }
        });
    }
    pub fn on_last_client_disconnect(&self, _key: String) {}
    pub fn invalidate_room(&self, key: String, _force: bool) -> Result<(), AppError> {
        self.rooms.remove(&key);
        Ok(())
    }
}
