use anyhow::{Context, Result};
use std::collections::{BTreeMap, HashMap};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, watch, RwLock};

use crate::auth::{SyncClaims, JwtValidator};
use crate::config::CadenceConfig;
use crate::merge::{MergeResult, MergeRouter};
use crate::peer_status::{PeerTracker, PeerTransport};
use crate::primary_reader::PrimaryDbReader;
use crate::protocol::{self, SyncMessage};
use crate::schema::{self, SchemaFingerprint};
use crate::state::{FieldChange, RowChange, SyncPayload, SyncState};
use crate::storage::{CatchupCheckpoint, MetadataBackend};
use crate::stream::{IrohSyncRead, IrohSyncWrite, SyncRead, SyncWrite};
use crate::token::TokenStore;
use crate::transport;

/// The sync engine orchestrates the sync protocol between peers.
pub struct SyncEngine {
    config: Arc<CadenceConfig>,
    state: Arc<SyncState>,
    storage: Arc<dyn MetadataBackend>,
    primary_reader: Arc<dyn PrimaryDbReader>,
    jwt_validator: Arc<JwtValidator>,
    peer_id: String,
    local_schema: SchemaFingerprint,
    token_store: Arc<TokenStore>,
    peers: RwLock<Vec<String>>,
    peer_tracker: Arc<PeerTracker>,
    peer_change_tx: watch::Sender<Vec<String>>,
}

impl SyncEngine {
    pub fn new(
        config: Arc<CadenceConfig>,
        state: Arc<SyncState>,
        storage: Arc<dyn MetadataBackend>,
        primary_reader: Arc<dyn PrimaryDbReader>,
        jwt_validator: Arc<JwtValidator>,
        peer_id: String,
        local_schema: SchemaFingerprint,
        token_store: Arc<TokenStore>,
        peer_tracker: Arc<PeerTracker>,
    ) -> (Self, watch::Receiver<Vec<String>>) {
        let (peer_change_tx, peer_change_rx) = watch::channel(Vec::new());
        let engine = Self {
            config,
            state,
            storage,
            primary_reader,
            jwt_validator,
            peer_id,
            local_schema,
            token_store,
            peers: RwLock::new(Vec::new()),
            peer_tracker,
            peer_change_tx,
        };
        (engine, peer_change_rx)
    }

    /// Get a reference to the peer tracker.
    pub fn peer_tracker(&self) -> &Arc<PeerTracker> {
        &self.peer_tracker
    }

    /// Get a reference to the storage backend.
    pub fn storage(&self) -> &Arc<dyn MetadataBackend> {
        &self.storage
    }

    /// Get this node's peer ID.
    pub fn peer_id(&self) -> &str {
        &self.peer_id
    }

    /// Compute the full sync status, merging tracker snapshots with configured peers.
    ///
    /// Configured peers that are not yet in the tracker (i.e., not yet connected)
    /// appear as `Disconnected` placeholder entries with `last_error = "Not connected"`.
    pub async fn status_snapshot(&self) -> crate::peer_status::SyncStatus {
        let tracked = self.peer_tracker.snapshot();
        let tracked_keys = self.peer_tracker.keys();
        let configured = self.get_peers().await;

        // Build a set of addresses covered by the tracker.
        // ConnectionManager uses keys like "out:<addr>", so we check both
        // the raw address field and the key with "out:" stripped.
        let mut tracked_addresses: std::collections::HashSet<String> =
            tracked.iter().map(|p| p.address.clone()).collect();
        for key in &tracked_keys {
            if let Some(addr) = key.strip_prefix("out:") {
                tracked_addresses.insert(addr.to_string());
            }
        }

        // Start with the tracker entries, then append placeholders for configured peers
        // whose address is not represented in the tracker.
        let mut all_peers: Vec<crate::peer_status::PeerStatusSnapshot> = tracked.clone();
        for addr in &configured {
            if !tracked_addresses.contains(addr.as_str()) {
                all_peers.push(crate::peer_status::placeholder_peer_snapshot(addr));
            }
        }

        let connected = tracked
            .iter()
            .filter(|p| {
                matches!(
                    p.state,
                    crate::peer_status::PeerState::Syncing | crate::peer_status::PeerState::Live
                )
            })
            .count();

        crate::peer_status::SyncStatus {
            lamport: self.state.lamport(),
            local_seq: self.state.local_seq(),
            connected_peers: connected,
            total_peers: all_peers.len(),
            peers: all_peers,
        }
    }

    // ── Token API ────────────────────────────────────────────────

    /// Set the peer's JWT token for authenticating with remote peers.
    pub async fn set_peer_token(&self, jwt: String) -> Result<SyncClaims> {
        self.token_store.set_token(jwt).await
    }

    /// Get the current peer JWT string.
    pub async fn peer_token(&self) -> Option<String> {
        self.token_store.token().await
    }

    /// Get the current peer's parsed claims.
    pub async fn peer_claims(&self) -> Option<SyncClaims> {
        self.token_store.claims().await
    }

    /// Clear the peer token.
    pub async fn clear_peer_token(&self) {
        self.token_store.clear().await;
    }

    // ── Peers API ───────────────────────────────────────────────

    /// Set the peers list. Persists to storage and updates in-memory state.
    pub async fn set_peers(&self, peers: Vec<String>) -> Result<()> {
        self.storage.set_peers(&peers).await?;
        let _ = self.peer_change_tx.send(peers.clone());
        *self.peers.write().await = peers;
        Ok(())
    }

    /// Get the current peers list.
    pub async fn get_peers(&self) -> Vec<String> {
        self.peers.read().await.clone()
    }

    /// Clear the peers list.
    pub async fn clear_peers(&self) -> Result<()> {
        self.storage.set_peers(&[]).await?;
        let _ = self.peer_change_tx.send(vec![]);
        *self.peers.write().await = Vec::new();
        Ok(())
    }

    /// Load peers from storage into memory.
    pub async fn load_peers_from_storage(&self) -> Result<()> {
        let peers = self.storage.get_peers().await?;
        let _ = self.peer_change_tx.send(peers.clone());
        *self.peers.write().await = peers;
        Ok(())
    }

    // ── Sync protocol (transport-agnostic) ─────────────────────

    /// Handle an incoming sync session over any bidirectional stream.
    pub async fn handle_incoming_stream(
        &self,
        send: &mut dyn SyncWrite,
        recv: &mut dyn SyncRead,
        change_rx: broadcast::Receiver<Vec<RowChange>>,
        session_key: &str,
        transport_type: PeerTransport,
    ) -> Result<()> {
        // 1. Receive Hello (includes remote's watermark for us)
        let hello_bytes = transport::read_message(recv).await?;
        let hello_msg: SyncMessage = protocol::decode_message_raw(&hello_bytes)?;

        let (jwt, remote_peer_id, remote_schema, remote_since_seq, resume_after_seq) = match hello_msg {
            SyncMessage::Hello {
                jwt,
                peer_id,
                schema_fingerprint,
                since_seq,
                resume_after_seq,
            } => (jwt, peer_id, schema_fingerprint, since_seq, resume_after_seq),
            _ => anyhow::bail!("Expected Hello message"),
        };

        // 2. Validate JWT
        let claims = self.jwt_validator.validate(&jwt).await?;

        // Register peer as syncing
        self.peer_tracker.register(session_key, &remote_peer_id, "inbound", transport_type);
        self.peer_tracker.set_syncing(session_key);

        // 3. Compare schemas
        let schema_compat = schema::compare_schemas(&self.local_schema, &remote_schema);

        // 4. Send HelloAck (includes our watermark for the remote)
        let our_since_seq = self.state.get_watermark(&remote_peer_id);
        self.peer_tracker.set_watermarks(session_key, remote_since_seq, our_since_seq);

        // Compute catch-up total estimate before sending HelloAck.
        // For since_seq == 0 (initial sync), we read all rows, apply scope filtering,
        // and count the result. This gives an accurate estimate instead of an inflated
        // unfiltered COUNT(*) which confuses the client's progress display.
        let catch_up_total = if remote_since_seq == 0 {
            let mut total = 0u64;
            for collection in self.config.collections.keys() {
                let rows = self.primary_reader.read_all_rows(collection, &self.state).await
                    .unwrap_or_default();
                let filtered = self.filter_changes(rows, &claims);
                total += filtered.len() as u64;
            }
            total
        } else {
            let catchup_changes = self.storage.query_since(remote_since_seq).await?;
            let catchup_filtered = self.filter_changes(catchup_changes, &claims);
            catchup_filtered.len() as u64
        };
        self.peer_tracker.set_send_total(session_key, catch_up_total);

        let ack = SyncMessage::HelloAck {
            peer_id: self.peer_id.clone(),
            ok: true,
            schema_compatibility: schema_compat.clone(),
            since_seq: our_since_seq,
            catch_up_total,
        };
        let ack_bytes = protocol::encode_message_raw(&ack)?;
        transport::write_message(send, &ack_bytes).await?;

        // 5. Persistent full-duplex sync
        let last_acked_seq = Arc::new(AtomicU64::new(0));

        let (send_result, recv_result) = tokio::join!(
            self.send_changes_streaming(
                send,
                remote_since_seq,
                resume_after_seq,
                &claims,
                &schema_compat,
                change_rx,
                last_acked_seq.clone(),
                session_key,
                &remote_peer_id,
            ),
            self.receive_and_merge_streaming(
                recv,
                &claims,
                &remote_peer_id,
                last_acked_seq.clone(),
                session_key,
            ),
        );

        // On completion/error, gracefully close
        let error_msg = match (&send_result, &recv_result) {
            (Err(e), _) => {
                tracing::warn!("Send task ended with error: {}", e);
                Some(format!("{}", e))
            }
            (_, Err(e)) => {
                tracing::warn!("Receive task ended with error: {}", e);
                Some(format!("{}", e))
            }
            _ => None,
        };
        self.peer_tracker.set_disconnected(session_key, error_msg);

        // Try to finish the send stream
        let _ = send.finish();

        // Return first error if any
        send_result.or(recv_result)
    }

    /// Initiate sync with a remote peer over any bidirectional stream.
    pub async fn initiate_sync_stream(
        &self,
        send: &mut dyn SyncWrite,
        recv: &mut dyn SyncRead,
        jwt: &str,
        change_rx: broadcast::Receiver<Vec<RowChange>>,
        session_key: &str,
        transport_type: PeerTransport,
    ) -> Result<()> {
        // Extract address from session_key (only if it has the "out:" prefix from ConnectionManager)
        // This ensures we don't use test session keys like "test" as addresses.
        let address = session_key.strip_prefix("out:");

        // Look up peer_id from address (learned from previous connections)
        // Only attempt lookup if we have a real address from the session_key
        let peer_id_hint = match address {
            Some(addr) => self.storage.get_peer_id_by_address(addr).await.ok().flatten(),
            None => None,
        };

        // Determine since_seq from watermark (set only after initial catchup completes).
        // Checkpoint is sent separately as resume_after_seq so the server still takes
        // the full snapshot path but skips records the client already has.
        let (since_seq, resume_after_seq) = match &peer_id_hint {
            Some(pid) => {
                let watermark = self.state.get_watermark(pid);
                if watermark > 0 {
                    // Completed initial catchup before — use watermark for incremental sync
                    (watermark, None)
                } else {
                    // Initial catchup: check for a resume checkpoint
                    let checkpoint_seq = self.storage
                        .get_catchup_checkpoint(pid).await.ok().flatten()
                        .filter(|cp| !cp.is_complete)
                        .map(|cp| {
                            tracing::info!(
                                "Resuming initial catchup for peer {} from checkpoint seq {}",
                                pid, cp.last_seq
                            );
                            cp.last_seq
                        });
                    (0, checkpoint_seq)
                }
            }
            None => (0, None),
        };

        // 1. Send Hello with resume point
        let hello = SyncMessage::Hello {
            jwt: jwt.to_string(),
            peer_id: self.peer_id.clone(),
            schema_fingerprint: self.local_schema.clone(),
            since_seq,
            resume_after_seq,
        };
        let hello_bytes = protocol::encode_message_raw(&hello)?;
        transport::write_message(send, &hello_bytes).await?;

        // 2. Receive HelloAck
        let ack_bytes = transport::read_message(recv).await?;
        let ack_msg: SyncMessage = protocol::decode_message_raw(&ack_bytes)?;

        let (remote_peer_id, schema_compat, remote_since_seq, catch_up_total) = match ack_msg {
            SyncMessage::HelloAck {
                peer_id,
                ok,
                schema_compatibility,
                since_seq,
                catch_up_total,
            } => {
                if !ok {
                    anyhow::bail!("Remote peer rejected connection");
                }
                (peer_id, schema_compatibility, since_seq, catch_up_total)
            }
            _ => anyhow::bail!("Expected HelloAck message"),
        };

        // Save address → peer_id mapping for future connections (only if we have a real address)
        if let Some(addr) = address {
            if let Err(e) = self.storage.set_peer_address_mapping(addr, &remote_peer_id).await {
                tracing::warn!("Failed to save peer address mapping: {}", e);
            }
        }

        // Register peer as syncing
        self.peer_tracker.register(session_key, &remote_peer_id, session_key, transport_type);
        self.peer_tracker.set_syncing(session_key);
        self.peer_tracker.set_watermarks(session_key, remote_since_seq, 0);

        // Set recv total from HelloAck
        if catch_up_total > 0 {
            self.peer_tracker.set_recv_total(session_key, catch_up_total);
        }

        // Compute our send total
        let claims = self.jwt_validator.validate(jwt).await?;
        let our_catchup = self.storage.query_since(remote_since_seq).await?;
        let our_catchup_filtered = self.filter_changes(our_catchup, &claims);
        let our_send_total = our_catchup_filtered.len() as u64;
        self.peer_tracker.set_send_total(session_key, our_send_total);

        // 3. Persistent full-duplex sync
        let last_acked_seq = Arc::new(AtomicU64::new(0));

        let (send_result, recv_result) = tokio::join!(
            self.send_changes_streaming(
                send,
                remote_since_seq,
                None, // initiator doesn't receive resume_after_seq from remote
                &claims,
                &schema_compat,
                change_rx,
                last_acked_seq.clone(),
                session_key,
                &remote_peer_id,
            ),
            self.receive_and_merge_streaming(
                recv,
                &claims,
                &remote_peer_id,
                last_acked_seq.clone(),
                session_key,
            ),
        );

        let error_msg = match (&send_result, &recv_result) {
            (Err(e), _) => {
                tracing::warn!("Send task ended with error: {}", e);
                Some(format!("{}", e))
            }
            (_, Err(e)) => {
                tracing::warn!("Receive task ended with error: {}", e);
                Some(format!("{}", e))
            }
            _ => None,
        };
        self.peer_tracker.set_disconnected(session_key, error_msg);

        let _ = send.finish();

        send_result.or(recv_result)
    }

    // ── Convenience wrappers for Iroh connections ──────────────

    /// Handle an incoming Iroh QUIC connection (server side).
    pub async fn handle_incoming(
        &self,
        conn: iroh::endpoint::Connection,
        change_rx: broadcast::Receiver<Vec<RowChange>>,
        session_key: &str,
    ) -> Result<()> {
        let (send, recv) = conn
            .accept_bi()
            .await
            .context("Failed to accept bidirectional stream")?;

        let mut send = IrohSyncWrite(send);
        let mut recv = IrohSyncRead(recv);
        self.handle_incoming_stream(&mut send, &mut recv, change_rx, session_key, PeerTransport::Quic)
            .await
    }

    /// Initiate sync over an Iroh QUIC connection (client side).
    pub async fn initiate_sync(
        &self,
        conn: iroh::endpoint::Connection,
        jwt: &str,
        change_rx: broadcast::Receiver<Vec<RowChange>>,
        session_key: &str,
    ) -> Result<()> {
        let (send, recv) = conn
            .open_bi()
            .await
            .context("Failed to open bidirectional stream")?;

        let mut send = IrohSyncWrite(send);
        let mut recv = IrohSyncRead(recv);
        self.initiate_sync_stream(&mut send, &mut recv, jwt, change_rx, session_key, PeerTransport::Quic)
            .await
    }

    // ── Internal streaming methods ─────────────────────────────

    /// Send changes in a persistent streaming loop.
    /// `remote_peer_id` is used for echo suppression — changes originating from the
    /// connected peer are not sent back.
    async fn send_changes_streaming(
        &self,
        send: &mut dyn SyncWrite,
        since_seq: u64,
        resume_after_seq: Option<u64>,
        claims: &SyncClaims,
        _schema_compat: &BTreeMap<String, schema::SchemaCompatibility>,
        mut change_rx: broadcast::Receiver<Vec<RowChange>>,
        _last_acked_seq: Arc<AtomicU64>,
        session_key: &str,
        remote_peer_id: &str,
    ) -> Result<()> {
        let keepalive_interval = Duration::from_secs(self.config.keepalive_interval_secs);

        // Phase 1: Catch-up — send all existing changes since watermark
        let catchup_timeout = Duration::from_secs(300); // 5 min max for initial catch-up
        let (mut last_sent_seq, catchup_count) = tokio::time::timeout(
            catchup_timeout,
            self.send_catchup_batch(send, since_seq, resume_after_seq, claims, remote_peer_id),
        ).await
            .map_err(|_| anyhow::anyhow!("Catch-up timed out after {}s", catchup_timeout.as_secs()))?
            ?;
        // Correct send_total to actual count (estimate from HelloAck may be higher due to scope filtering)
        self.peer_tracker.set_send_total(session_key, catchup_count as u64);
        self.peer_tracker.inc_send_progress(session_key, catchup_count as u64);
        self.peer_tracker.inc_sent(session_key, catchup_count as u64);
        self.peer_tracker.touch(session_key);

        // Check if we should transition to live
        if self.peer_tracker.is_catchup_complete(session_key) {
            self.peer_tracker.set_live(session_key);
        }

        // Phase 2: Streaming — wait for new changes or send keepalives
        loop {
            tokio::select! {
                result = change_rx.recv() => {
                    match result {
                        Ok(changes) => {
                            // Suppress echo: skip changes that originated from the connected peer
                            let non_echo: Vec<_> = changes.into_iter()
                                .filter(|c| !Self::change_originated_from(c, remote_peer_id))
                                .collect();
                            let filtered = self.filter_changes(non_echo, claims);
                            if !filtered.is_empty() {
                                let count = filtered.len() as u64;
                                let max_seq = filtered.iter().map(|c| c.seq).max().unwrap_or(0);
                                self.send_batch(send, &filtered, false).await?;
                                self.send_done(send).await?;
                                last_sent_seq = std::cmp::max(last_sent_seq, max_seq);
                                self.peer_tracker.inc_sent(session_key, count);
                                self.peer_tracker.inc_send_progress(session_key, count);
                                self.peer_tracker.touch(session_key);
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(_n)) => {
                            tracing::warn!("Broadcast lag detected, re-entering catch-up from seq {}", last_sent_seq);
                            let (new_seq, count) = self.send_catchup_batch(send, last_sent_seq, None, claims, remote_peer_id).await?;
                            last_sent_seq = new_seq;
                            self.peer_tracker.inc_sent(session_key, count as u64);
                            self.peer_tracker.inc_send_progress(session_key, count as u64);
                            self.peer_tracker.touch(session_key);
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            tracing::debug!("Change broadcast channel closed, send loop exiting");
                            send.finish()?;
                            send.stopped().await?;
                            return Ok(());
                        }
                    }
                }
                _ = tokio::time::sleep(keepalive_interval) => {
                    let ka = SyncMessage::Keepalive;
                    let bytes = protocol::encode_message_raw(&ka)?;
                    transport::write_message(send, &bytes).await?;
                    self.peer_tracker.touch(session_key);
                }
            }
        }
    }

    /// Receive and merge changes in a persistent streaming loop.
    async fn receive_and_merge_streaming(
        &self,
        recv: &mut dyn SyncRead,
        claims: &SyncClaims,
        remote_peer_id: &str,
        last_acked_seq: Arc<AtomicU64>,
        session_key: &str,
    ) -> Result<()> {
        let router = MergeRouter::new(&self.config);
        let liveness_timeout = Duration::from_secs(self.config.liveness_timeout_secs);
        let checkpoint_interval = self.config.checkpoint_interval;
        let mut last_received_seq = 0u64;
        let mut catchup_done = false;

        // For resumable catchup checkpointing
        let catchup_start_time = chrono::Utc::now().to_rfc3339();
        let mut records_since_checkpoint = 0usize;

        loop {
            let msg_bytes = match transport::read_message_timeout(recv, liveness_timeout).await {
                Ok(bytes) => bytes,
                Err(e) => {
                    return Err(e);
                }
            };

            let msg: SyncMessage = protocol::decode_message_raw(&msg_bytes)?;

            match msg {
                SyncMessage::SyncData { changes, done } => {
                    let count = changes.len() as u64;
                    for change in &changes {
                        // Validate incoming change is within peer's scope
                        if !self.change_in_scope(change, claims) {
                            tracing::warn!(
                                "Rejecting out-of-scope change {}/{} from peer",
                                change.collection,
                                change.document_id,
                            );
                            continue;
                        }
                        self.merge_single_change(&router, change, claims).await?;
                        last_received_seq = std::cmp::max(last_received_seq, change.seq);
                    }

                    if count > 0 {
                        self.peer_tracker.inc_received(session_key, count);
                        self.peer_tracker.inc_recv_progress(session_key, count);
                        self.peer_tracker.update_our_watermark(session_key, last_received_seq);
                        self.peer_tracker.touch(session_key);

                        // Checkpoint progress during initial catchup
                        if !catchup_done {
                            records_since_checkpoint += count as usize;
                            if records_since_checkpoint >= checkpoint_interval {
                                let checkpoint = CatchupCheckpoint {
                                    last_seq: last_received_seq,
                                    started_at: catchup_start_time.clone(),
                                    is_complete: false,
                                };
                                if let Err(e) = self.storage.set_catchup_checkpoint(remote_peer_id, &checkpoint).await {
                                    tracing::warn!("Failed to save catchup checkpoint: {}", e);
                                }
                                records_since_checkpoint = 0;
                            }
                        }
                    }

                    if done {
                        self.state.set_watermark(remote_peer_id, last_received_seq);
                        self.storage.set_watermark(remote_peer_id, last_received_seq).await?;
                        last_acked_seq.store(last_received_seq, Ordering::SeqCst);
                        self.peer_tracker.update_our_watermark(session_key, last_received_seq);

                        // First done marker means catch-up is complete
                        if !catchup_done {
                            catchup_done = true;

                            // Clear the catchup checkpoint since we're now complete
                            if let Err(e) = self.storage.complete_catchup(remote_peer_id).await {
                                tracing::warn!("Failed to complete catchup checkpoint: {}", e);
                            }

                            // Correct recv_total to actual received (estimate was unfiltered)
                            self.peer_tracker.finalize_recv_total(session_key);
                            // Transition to live — recv catch-up is the authoritative signal.
                            // Send catch-up may still be in progress but that's OK.
                            self.peer_tracker.set_live(session_key);
                        }
                    }
                }
                SyncMessage::Ack { last_received_seq: ack_seq } => {
                    self.state.set_watermark(remote_peer_id, ack_seq);
                    self.storage.set_watermark(remote_peer_id, ack_seq).await?;
                    self.peer_tracker.update_our_watermark(session_key, ack_seq);
                    self.peer_tracker.touch(session_key);
                }
                SyncMessage::Keepalive => {
                    tracing::trace!("Received keepalive from {}", remote_peer_id);
                    self.peer_tracker.touch(session_key);
                }
                _ => {
                    tracing::warn!("Unexpected message type in streaming loop");
                }
            }
        }
    }

    /// Send a catch-up batch of all changes since `since_seq`.
    /// Returns (max_seq, count_sent).
    ///
    /// When `since_seq == 0` (new peer or resumed initial catchup), reads
    /// directly from the primary DB to serve a full snapshot. If
    /// `resume_after_seq` is set, records with seq <= that value are skipped
    /// (the client already has them from a previous interrupted catchup).
    /// Otherwise, reads from the change log for incremental catch-up.
    async fn send_catchup_batch(
        &self,
        send: &mut dyn SyncWrite,
        since_seq: u64,
        resume_after_seq: Option<u64>,
        claims: &SyncClaims,
        remote_peer_id: &str,
    ) -> Result<(u64, usize)> {
        if since_seq == 0 {
            // Full catch-up: try reading from primary DB first
            let mut total_sent = 0usize;
            let mut max_seq = 0u64;
            for collection in self.config.collections.keys() {
                let rows = self.primary_reader.read_all_rows(collection, &self.state).await?;
                let filtered = self.filter_changes(rows, claims);
                // When resuming, skip records the client already received
                let to_send: Vec<_> = match resume_after_seq {
                    Some(skip_seq) => filtered.into_iter().filter(|c| c.seq > skip_seq).collect(),
                    None => filtered,
                };
                if !to_send.is_empty() {
                    if let Some(seq) = to_send.iter().map(|c| c.seq).max() {
                        max_seq = std::cmp::max(max_seq, seq);
                    }
                    for chunk in to_send.chunks(100) {
                        self.send_batch(send, chunk, false).await?;
                    }
                    total_sent += to_send.len();
                }
            }

            if total_sent > 0 || resume_after_seq.is_some() {
                tracing::debug!(
                    since_seq = since_seq,
                    resume_after_seq = ?resume_after_seq,
                    total = total_sent,
                    max_seq = max_seq,
                    "Sending full catch-up from primary DB"
                );
                self.send_done(send).await?;
                return Ok((max_seq, total_sent));
            }

            // Primary DB returned nothing — fall through to change log.
            // This handles: NoPrimaryReader in tests, or empty primary DB tables.
            tracing::debug!("Primary DB returned no rows, falling back to change log");
        }

        // Incremental catch-up (or fallback): read from change log
        let changes = self.storage.query_since(since_seq).await?;
        // Suppress echo: skip changes that originated from the connected peer
        let non_echo: Vec<_> = changes.into_iter()
            .filter(|c| !Self::change_originated_from(c, remote_peer_id))
            .collect();
        let filtered = self.filter_changes(non_echo, claims);
        let count = filtered.len();
        let max_seq = filtered.iter().map(|c| c.seq).max().unwrap_or(since_seq);
        tracing::debug!(
            since_seq = since_seq,
            total = count,
            max_seq = max_seq,
            "Sending catch-up from change log"
        );

        let batch_size = 100;
        for chunk in filtered.chunks(batch_size) {
            self.send_batch(send, chunk, false).await?;
        }

        self.send_done(send).await?;

        Ok((max_seq, count))
    }

    /// Filter changes by scope dimensions (OR logic).
    fn filter_changes(&self, changes: Vec<RowChange>, claims: &SyncClaims) -> Vec<RowChange> {
        changes
            .into_iter()
            .filter(|c| {
                let scope_cols = self.config.scope_columns_for(&c.collection);
                if scope_cols.is_empty() {
                    return true; // No scoping for this collection
                }

                let row_fields = Self::extract_row_fields(c);
                claims.row_in_scope(scope_cols, &row_fields)
            })
            .collect()
    }

    /// Check if an incoming change is within the peer's scope.
    fn change_in_scope(&self, change: &RowChange, claims: &SyncClaims) -> bool {
        let scope_cols = self.config.scope_columns_for(&change.collection);
        if scope_cols.is_empty() {
            return true;
        }
        let row_fields = Self::extract_row_fields(change);
        claims.row_in_scope(scope_cols, &row_fields)
    }

    /// Extract field values from a RowChange as a string map for scope checking.
    fn extract_row_fields(change: &RowChange) -> HashMap<String, String> {
        let mut fields = HashMap::new();
        if let SyncPayload::Fields(ref field_changes) = change.payload {
            for fc in field_changes {
                let val = match &fc.value {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Null => continue,
                    other => other.to_string(),
                };
                fields.insert(fc.field.clone(), val);
            }
        }
        fields
    }

    /// Check if a change originated from a specific peer (by checking FieldChange.peer_id).
    fn change_originated_from(change: &RowChange, peer_id: &str) -> bool {
        match &change.payload {
            SyncPayload::Fields(fields) => {
                fields.first().map_or(false, |fc| fc.peer_id == peer_id)
            }
            _ => false,
        }
    }

    /// Send a batch of changes.
    async fn send_batch(
        &self,
        send: &mut dyn SyncWrite,
        changes: &[RowChange],
        done: bool,
    ) -> Result<()> {
        let msg = SyncMessage::SyncData {
            changes: changes.to_vec(),
            done,
        };
        let bytes = protocol::encode_message_raw(&msg)?;
        transport::write_message(send, &bytes).await?;
        Ok(())
    }

    /// Send a done marker (empty SyncData with done=true).
    async fn send_done(&self, send: &mut dyn SyncWrite) -> Result<()> {
        let msg = SyncMessage::SyncData {
            changes: vec![],
            done: true,
        };
        let bytes = protocol::encode_message_raw(&msg)?;
        transport::write_message(send, &bytes).await?;
        Ok(())
    }

    /// Merge a single incoming change into local storage.
    async fn merge_single_change(
        &self,
        router: &MergeRouter<'_>,
        change: &RowChange,
        _claims: &SyncClaims,
    ) -> Result<()> {
        // Fetch existing local fields from change log for merge
        let existing = self.storage.query_by_doc(&change.collection, &change.document_id).await?;
        let local_fields: Vec<FieldChange> = existing
            .iter()
            .flat_map(|rc| match &rc.payload {
                SyncPayload::Fields(f) => f.clone(),
                _ => vec![],
            })
            .collect();

        let result = router.merge(change, &local_fields);

        match result {
            MergeResult::Lww(_merged_fields) => {}
            MergeResult::Crdt(_bytes) => {}
            MergeResult::Error(e) => {
                tracing::warn!(
                    "Merge error for {}/{}: {}",
                    change.collection,
                    change.document_id,
                    e
                );
            }
        }

        // Record in change log
        self.storage.append_change(change).await?;

        // Update lamport
        if let SyncPayload::Fields(fields) = &change.payload {
            for fc in fields {
                self.state.merge_lamport(fc.lamport);
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{FieldChange, RowChange, SyncPayload};

    fn make_change(peer_id: &str) -> RowChange {
        RowChange {
            collection: "test-collection".to_string(),
            document_id: "doc-1".to_string(),
            payload: SyncPayload::Fields(vec![FieldChange {
                field: "name".to_string(),
                value: serde_json::Value::String("value".to_string()),
                lamport: 1,
                peer_id: peer_id.to_string(),
            }]),
            deleted: false,
            seq: 1,
        }
    }

    #[test]
    fn change_originated_from_matches_peer() {
        let change = make_change("peer-a");
        assert!(SyncEngine::change_originated_from(&change, "peer-a"));
    }

    #[test]
    fn change_originated_from_different_peer() {
        let change = make_change("peer-a");
        assert!(!SyncEngine::change_originated_from(&change, "peer-b"));
    }

    #[test]
    fn change_originated_from_empty_fields() {
        let change = RowChange {
            collection: "test".to_string(),
            document_id: "doc-1".to_string(),
            payload: SyncPayload::Fields(vec![]),
            deleted: false,
            seq: 1,
        };
        assert!(!SyncEngine::change_originated_from(&change, "peer-a"));
    }

    #[test]
    fn change_originated_from_crdt_always_false() {
        let change = RowChange {
            collection: "test".to_string(),
            document_id: "doc-1".to_string(),
            payload: SyncPayload::CrdtDoc(vec![1, 2, 3]),
            deleted: false,
            seq: 1,
        };
        assert!(!SyncEngine::change_originated_from(&change, "peer-a"));
    }
}
