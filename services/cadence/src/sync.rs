use anyhow::{Context, Result};
use std::collections::{BTreeMap, HashMap, VecDeque};
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

    /// Clear the peer token (deletes both in-memory cache and persisted row).
    pub async fn clear_peer_token(&self) -> Result<()> {
        self.token_store.clear().await
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
        // Per-session diagnostic. Fires once per inbound connection. Silent at
        // default INFO; enable via `RUST_LOG=cadence::sync=debug` (or per-pod
        // configmap) when investigating peer auth, scope drift, or catch-up
        // totals on a specific connection.
        tracing::debug!(
            session_key,
            remote_peer_id = %remote_peer_id,
            remote_since_seq,
            resume_after_seq = ?resume_after_seq,
            jwt_sub = %claims.sub,
            jwt_peer_id = ?claims.peer_id,
            jwt_read_only = claims.read_only,
            jwt_scopes = ?claims.scopes,
            "handle_incoming_stream: Hello received + JWT validated"
        );

        // Register peer as syncing
        self.peer_tracker.register(session_key, &remote_peer_id, "inbound", transport_type);
        self.peer_tracker.set_syncing(session_key);

        // 3. Compare schemas
        let schema_compat = schema::compare_schemas(&self.local_schema, &remote_schema);

        // 4. Send HelloAck (includes our watermark for the remote)
        let our_since_seq = self.state.get_watermark(&remote_peer_id);
        self.peer_tracker.set_watermarks(session_key, remote_since_seq, our_since_seq);

        // Compute catch-up total estimate before sending HelloAck.
        // For since_seq == 0, use fast pg_class row-count estimates instead
        // of loading every row into memory just to count them.
        let catch_up_total = if remote_since_seq == 0 {
            self.primary_reader.count_all_rows(&self.config).await.unwrap_or(0)
        } else {
            let mut total = 0u64;
            let mut cursor = remote_since_seq;
            loop {
                let (batch, has_more) = self.storage.query_since_batched(cursor, self.config.query_batch_size).await?;
                if batch.is_empty() { break; }
                cursor = batch.iter().map(|c| c.seq).max().unwrap_or(cursor);
                total += self.filter_changes(batch, &claims).len() as u64;
                if !has_more { break; }
            }
            total
        };
        self.peer_tracker.set_send_total(session_key, catch_up_total);
        // Pairs with the Hello-received log above. Per-session, debug-level.
        tracing::debug!(
            session_key,
            remote_peer_id,
            remote_since_seq,
            our_since_seq,
            catch_up_total,
            "handle_incoming_stream: sending HelloAck"
        );

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

        // Validate JWT to obtain claims for scope filtering in the send/recv loops.
        // Do NOT pre-load the full change log here to compute send_total — with a
        // large change log (millions of rows) that spawn_blocking call would block
        // the receive side from starting, causing the remote peer's send buffer to
        // fill and the connection to drop before a single record is exchanged.
        // The accurate send_total is set inside send_changes_streaming once the
        // catch-up batch completes (set_send_total(session_key, catchup_count)).
        let claims = self.jwt_validator.validate(jwt).await?;

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

        // Hoisted interval timer for Phase 2's keepalive select-arm. A prior
        // version used `tokio::time::sleep(keepalive_interval)` inside the
        // `tokio::select!`, which created a fresh sleep future on every loop
        // iteration — the interval effectively reset whenever the broadcast
        // recv arm fired, so on a busy peer the select keepalive never ticked.
        // An `Interval` is stateful and survives across select iterations.
        // MissedTickBehavior::Delay prevents a burst of queued ticks after a
        // long Phase-1 catchup yields.
        let mut keepalive_ticker = tokio::time::interval(keepalive_interval);
        keepalive_ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        // Eat the immediate tick that `interval()` fires at `t=0` so the first
        // real tick lands at `t = keepalive_interval`.
        keepalive_ticker.tick().await;

        // Phase 1: Pre-encode all catch-up frames into a queue so Phase 1 and
        // Phase 2 (live broadcast) can interleave without blocking each other.
        let (mut phase1_queue, catchup_count, mut last_sent_seq) =
            self.build_catchup_frames(since_seq, resume_after_seq, claims, remote_peer_id).await?;

        // Correct send_total to actual count (estimate from HelloAck may be
        // higher due to scope filtering).
        self.peer_tracker.set_send_total(session_key, catchup_count as u64);

        // One-shot flag: fire progress counters exactly once when Phase 1 drains.
        let mut phase1_progress_recorded = false;
        // Track time of last keepalive sent to the remote.  During Phase 1 we
        // do not reach the blocking select!, so we must inject keepalives inline
        // to prevent the remote's liveness timer from expiring.
        let mut last_keepalive = std::time::Instant::now();

        // Interleaved send loop:
        //   1. Drain all pending Phase 2 (live) changes first (non-blocking).
        //   2. Write one Phase 1 frame, then yield so the executor can run
        //      the receive half before we come back for the next frame.
        //   3. When both Phase 1 and the try_recv queue are empty, block on
        //      select! for the next broadcast message or keepalive.
        loop {
            // --- Step 0: Inject keepalive during Phase 1 if interval elapsed ---
            // This keeps the remote's liveness timer alive during long catch-up
            // batches where we don't reach the blocking select! arm.
            if !phase1_queue.is_empty() && last_keepalive.elapsed() >= keepalive_interval {
                let ka = SyncMessage::Keepalive;
                let bytes = protocol::encode_message_raw(&ka)?;
                transport::write_message(send, &bytes).await?;
                last_keepalive = std::time::Instant::now();
                // Align the Phase-2 ticker with the inline injector so the
                // select keepalive arm doesn't fire redundantly the moment
                // Phase 1 drains into Phase 2.
                keepalive_ticker.reset();
                self.peer_tracker.touch(session_key);
            }

            // --- Step 1: Drain live broadcast (non-blocking, high priority) ---
            loop {
                match change_rx.try_recv() {
                    Ok(changes) => {
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
                            last_keepalive = std::time::Instant::now();
                        }
                    }
                    Err(broadcast::error::TryRecvError::Lagged(_)) => {
                        tracing::warn!(
                            "Broadcast lag during catch-up, re-queuing from seq {}",
                            last_sent_seq
                        );
                        // Replace the remaining Phase 1 queue with a fresh snapshot
                        // so we don't miss any changes that fell off the ring buffer.
                        let (new_queue, extra_count, new_seq) =
                            self.build_catchup_frames(last_sent_seq, None, claims, remote_peer_id).await?;
                        phase1_queue = new_queue;
                        last_sent_seq = new_seq;
                        self.peer_tracker.inc_sent(session_key, extra_count as u64);
                        self.peer_tracker.inc_send_progress(session_key, extra_count as u64);
                        self.peer_tracker.touch(session_key);
                        break;
                    }
                    Err(broadcast::error::TryRecvError::Empty) => break,
                    Err(broadcast::error::TryRecvError::Closed) => {
                        tracing::debug!("Change broadcast channel closed, send loop exiting");
                        // Flush any remaining Phase 1 frames before closing.
                        while let Some(frame) = phase1_queue.pop_front() {
                            send.write_all(&frame).await?;
                        }
                        // Record Phase 1 progress so peer-tracker accounting
                        // matches what we actually wrote. The post-Phase-1
                        // accounting at the bottom of the loop is unreachable
                        // from this early-return path, so we mirror it here.
                        if !phase1_progress_recorded {
                            self.peer_tracker.inc_send_progress(session_key, catchup_count as u64);
                            self.peer_tracker.inc_sent(session_key, catchup_count as u64);
                            self.peer_tracker.touch(session_key);
                            if self.peer_tracker.is_catchup_complete(session_key) {
                                self.peer_tracker.set_live(session_key);
                            }
                        }
                        send.finish()?;
                        send.stopped().await?;
                        return Ok(());
                    }
                }
            }

            // --- Step 2: Write one Phase 1 frame ---
            if let Some(frame) = phase1_queue.pop_front() {
                send.write_all(&frame).await?;
                self.peer_tracker.touch(session_key);
                // Yield so the receive half can run between frames.
                tokio::task::yield_now().await;
                continue;
            }

            // --- Phase 1 complete: update progress counters exactly once ---
            if !phase1_progress_recorded {
                phase1_progress_recorded = true;
                self.peer_tracker.inc_send_progress(session_key, catchup_count as u64);
                self.peer_tracker.inc_sent(session_key, catchup_count as u64);
                self.peer_tracker.touch(session_key);
                if self.peer_tracker.is_catchup_complete(session_key) {
                    self.peer_tracker.set_live(session_key);
                }
            }

            // --- Step 3: Block until next live event or keepalive ---
            tokio::select! {
                result = change_rx.recv() => {
                    match result {
                        Ok(changes) => {
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
                                last_keepalive = std::time::Instant::now();
                                // Reset the keepalive ticker so it doesn't fire
                                // immediately after we just wrote live data.
                                keepalive_ticker.reset();
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(_n)) => {
                            tracing::warn!(
                                "Broadcast lag detected, re-entering catch-up from seq {}",
                                last_sent_seq
                            );
                            let (new_seq, count) = self.send_catchup_batch(
                                send, last_sent_seq, None, claims, remote_peer_id,
                            ).await?;
                            last_sent_seq = new_seq;
                            self.peer_tracker.inc_sent(session_key, count as u64);
                            self.peer_tracker.inc_send_progress(session_key, count as u64);
                            self.peer_tracker.touch(session_key);
                            last_keepalive = std::time::Instant::now();
                            keepalive_ticker.reset();
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            tracing::debug!("Change broadcast channel closed, send loop exiting");
                            send.finish()?;
                            send.stopped().await?;
                            return Ok(());
                        }
                    }
                }
                _ = keepalive_ticker.tick() => {
                    let ka = SyncMessage::Keepalive;
                    let bytes = protocol::encode_message_raw(&ka)?;
                    transport::write_message(send, &bytes).await?;
                    last_keepalive = std::time::Instant::now();
                    self.peer_tracker.touch(session_key);
                }
            }
        }
    }

    /// Encode a `SyncMessage` into a single wire frame (4-byte big-endian length
    /// prefix followed by the postcard-encoded body).  The resulting `Vec<u8>`
    /// can be written directly with `SyncWrite::write_all` without calling
    /// `transport::write_message`.
    fn encode_wire_frame(msg: &SyncMessage) -> Result<Vec<u8>> {
        let body = protocol::encode_message_raw(msg)?;
        let len = body.len() as u32;
        let mut frame = Vec::with_capacity(4 + body.len());
        frame.extend_from_slice(&len.to_be_bytes());
        frame.extend_from_slice(&body);
        Ok(frame)
    }

    /// Build the complete Phase 1 catch-up frame queue without sending anything.
    ///
    /// Returns `(frame_queue, total_row_count, max_seq)`.  The `done` frame is
    /// appended at the end so the remote side can transition to live mode.
    async fn build_catchup_frames(
        &self,
        since_seq: u64,
        resume_after_seq: Option<u64>,
        claims: &SyncClaims,
        remote_peer_id: &str,
    ) -> Result<(VecDeque<Vec<u8>>, usize, u64)> {
        // Detect stale-epoch watermark.
        let effective_since_seq = if since_seq > 0 {
            let our_max = self.storage.max_seq().await.unwrap_or(0);
            if since_seq > our_max {
                tracing::info!(
                    since_seq,
                    our_max_seq = our_max,
                    "Remote watermark is ahead of local change log — \
                     treating as full snapshot (stale epoch)"
                );
                0
            } else {
                since_seq
            }
        } else {
            since_seq
        };

        let mut queue: VecDeque<Vec<u8>> = VecDeque::new();
        let batch_size = 100usize;
        let mut total_count = 0usize;
        let mut max_seq = effective_since_seq;

        // Run primary-reader catch-up whenever the peer's `since_seq` is
        // below the local watcher's baseline completion mark. The primary
        // DB is the source of truth for current row state; the change log
        // only carries deltas that happened *after* the watcher's first
        // poll. Peers reconnecting with a watermark from before that
        // moment cannot be served from the change log alone — those rows
        // were silently absorbed during baseline. This branch fires for
        // both fresh peers (`since_seq=0`, baseline_completion_seq=0+) and
        // reconnecting peers below the threshold.
        let baseline_seq = self.state.baseline_completion_seq();
        let needs_snapshot = effective_since_seq < baseline_seq;
        let mut primary_reader_did_emit = false;
        // Per-session diagnostic. Fires once per build_catchup_frames call.
        // Captures the decision tree (snapshot vs change-log replay) and the
        // peer's scope — primary input when investigating "everything got
        // dropped" or "wrong code path" issues. Silent at default INFO.
        tracing::debug!(
            since_seq,
            effective_since_seq,
            resume_after_seq = ?resume_after_seq,
            baseline_seq,
            needs_snapshot,
            catchup_from_primary_db = self.config.catchup_from_primary_db,
            num_collections = self.config.collections.len(),
            remote_peer_id,
            peer_scopes = ?claims.scopes,
            "build_catchup_frames: entry"
        );
        if needs_snapshot && self.config.catchup_from_primary_db {
            // Build a per-doc max-lamport map once. Used to attach
            // meaningful lamports to primary-reader output so receiving
            // peers' LWW comparisons preserve their offline edits.
            // Rows with no change-log entry (silently absorbed at
            // baseline) get the sentinel `fallback_lamport=1` — peer
            // local lamports advance past 1 on any local write, so any
            // peer-side edit on a baseline-absorbed row wins LWW.
            let lamport_map = self
                .storage
                .max_lamports_by_doc()
                .await
                .unwrap_or_else(|e| {
                    tracing::warn!(error = %e, "max_lamports_by_doc failed; falling back to lamport=1 for all primary-reader rows");
                    Default::default()
                });
            let fallback_lamport: u64 = 1;
            let mut primary_total_read = 0u64;

            // Iterate in priority order (auth/identity/medical before
            // activity-logs/webhook deliveries) so high-value collections
            // reach the wire first. Falls back to alphabetical when no
            // `priorities:` block is configured.
            for collection in self.config.collections_in_priority_order() {
                // Paginate reads to avoid loading entire tables into memory.
                let page_size = 1000u64;
                let mut offset = 0u64;
                let mut collection_rows = 0u64;
                let mut collection_sent = 0u64;
                let scope_cols_for_collection = self.config.scope_columns_for(collection).clone();
                // Per-collection trace. With ~100+ collections per session
                // this is too chatty for debug; use trace and filter to
                // specific tables when needed (e.g.
                // `RUST_LOG=cadence::sync=trace`).
                tracing::trace!(
                    collection = %collection,
                    scope_cols = ?scope_cols_for_collection,
                    "build_catchup_frames: collection start"
                );
                loop {
                    let mut rows = self.primary_reader.read_rows_page(
                        collection, &self.state, offset, page_size,
                    ).await?;
                    let page_len = rows.len() as u64;
                    collection_rows += page_len;
                    primary_total_read += page_len;

                    // LWW-correct lamport assignment for each emitted row.
                    // Without this, primary-reader's fresh
                    // `state.increment_lamport()` lamports would always
                    // win the receiver-side LWW comparison and clobber
                    // any peer-local offline edits.
                    for row in rows.iter_mut() {
                        let key = (row.collection.clone(), row.document_id.clone());
                        let assigned = lamport_map
                            .get(&key)
                            .copied()
                            .unwrap_or(fallback_lamport);
                        if let SyncPayload::Fields(ref mut fields) = row.payload {
                            for fc in fields.iter_mut() {
                                fc.lamport = assigned;
                            }
                        }
                    }

                    let filtered = self.filter_changes(rows, claims);
                    let filtered_len = filtered.len();
                    let to_send: Vec<_> = match resume_after_seq {
                        Some(skip_seq) => filtered.into_iter().filter(|c| c.seq > skip_seq).collect(),
                        None => filtered,
                    };
                    let to_send_len = to_send.len();
                    // Per-page trace: shows the primary→filtered→to_send
                    // funnel so we can spot whether scope filter or
                    // resume_after_seq is the row-loss point.
                    if filtered_len > 0 || page_len > 0 {
                        tracing::trace!(
                            collection = %collection,
                            page_offset = offset,
                            page_len,
                            filtered_len,
                            to_send_len,
                            resume_after_seq = ?resume_after_seq,
                            "build_catchup_frames: page (primary -> filtered -> to_send)"
                        );
                    }
                    if !to_send.is_empty() {
                        if let Some(seq) = to_send.iter().map(|c| c.seq).max() {
                            max_seq = std::cmp::max(max_seq, seq);
                        }
                        collection_sent += to_send.len() as u64;
                        for chunk in to_send.chunks(batch_size) {
                            let msg = SyncMessage::SyncData {
                                changes: chunk.to_vec(),
                                done: false,
                            };
                            queue.push_back(Self::encode_wire_frame(&msg)?);
                        }
                        total_count += to_send.len();
                    }
                    if page_len < page_size {
                        break;
                    }
                    offset += page_size;
                }
                // One INFO line per collection so an operator can scan
                // catch-up output and immediately spot a collection that
                // returned 0 rows from the primary DB (read failed, table
                // empty, or scope filter dropped everything). Without this
                // the only summary fires once for the whole catch-up at
                // DEBUG and silently-dropped collections are invisible.
                if collection_rows == 0 {
                    tracing::info!(
                        collection = %collection,
                        "Catch-up: 0 rows from primary DB (table empty or read failed — see WARN above)"
                    );
                } else if collection_sent == 0 {
                    tracing::info!(
                        collection = %collection,
                        rows = collection_rows,
                        "Catch-up: read {} rows but scope filter dropped all of them",
                        collection_rows
                    );
                }
                // Per-collection done summary at trace level. Pairs with
                // the collection-start log; useful when reading per-page
                // traces in context.
                tracing::trace!(
                    collection = %collection,
                    collection_rows,
                    collection_sent,
                    scope_cols = ?scope_cols_for_collection,
                    "build_catchup_frames: collection done"
                );
            }

            tracing::debug!(
                since_seq = effective_since_seq,
                baseline_completion_seq = baseline_seq,
                resume_after_seq = ?resume_after_seq,
                primary_total = total_count,
                primary_total_read,
                "Catch-up primary-reader pass complete; falling through to change-log replay for tombstones + post-snapshot deltas"
            );
            primary_reader_did_emit = primary_total_read > 0;
            // Fall through to change-log replay rather than returning
            // early — the change log still carries DELETE markers that
            // primary-reader's `SELECT *` can't see, plus any incremental
            // changes that landed after the snapshot read. LWW dedupes
            // anything that overlaps with the primary-reader pass.
        }

        // Incremental catch-up from change log (paginated).
        //
        // When the primary-reader pass above already ran (`needs_snapshot &&
        // catchup_from_primary_db`), the snapshot already carried current
        // row state for every collection. Replaying the change log's
        // non-tombstone entries here would be redundant: every (collection,
        // doc_id, field) the change log has either:
        //   1. been silently absorbed at baseline (not in the log at all), or
        //   2. been emitted by primary-reader at higher lamport, so the
        //      change-log copy loses on LWW at the receiver, or
        //   3. is a post-snapshot incremental edit that Phase 2's live
        //      broadcast carries (since `change_rx` was subscribed before
        //      Phase 1 began, no edit during the snapshot can be lost).
        //
        // What the change log uniquely carries are **tombstones** — DELETEs
        // that primary-reader's `SELECT *` cannot see. So when the snapshot
        // pass fired, restrict the replay to deleted entries only. This
        // collapses bloated cloud change logs (e.g. 300k+ accumulated
        // entries from echo amplification across pod restarts) from a
        // multi-second iteration into a near-no-op tombstone scan, keeping
        // Phase 1 well under the gateway's idle timeout.
        //
        // For peers above the snapshot threshold (incremental sync,
        // `effective_since_seq >= baseline_completion_seq`), the full change
        // log replay is still required and the tombstone-only filter is
        // disabled.
        //
        // Additional safety: only suppress non-tombstone replay when the
        // primary-reader pass actually *read* rows. If primary_reader is
        // empty/stub (e.g. tests using `NoPrimaryReader`, or a misconfigured
        // primary DB URL), the change log is the sole source of state and
        // must replay in full. `primary_total_read > 0` means the primary DB
        // exists and was reachable; we trust it as authoritative.
        let snapshot_pass_ran =
            needs_snapshot && self.config.catchup_from_primary_db && primary_reader_did_emit;
        let mut cursor = effective_since_seq;
        let mut changelog_pages = 0u64;
        let mut changelog_total_in = 0usize;
        let mut changelog_total_out = 0usize;
        loop {
            // When the snapshot pass ran, query *only* tombstones from the
            // change log. Otherwise (incremental sync above the baseline
            // threshold), query all entries — peers above the threshold
            // depend on full delta replay.
            let (batch, has_more) = if snapshot_pass_ran {
                self.storage
                    .query_tombstones_since_batched(cursor, self.config.query_batch_size)
                    .await?
            } else {
                self.storage
                    .query_since_batched(cursor, self.config.query_batch_size)
                    .await?
            };
            if batch.is_empty() { break; }
            let batch_in = batch.len();
            let batch_max = batch.iter().map(|c| c.seq).max().unwrap_or(cursor);
            max_seq = std::cmp::max(max_seq, batch_max);
            cursor = batch_max;

            let non_echo: Vec<_> = batch.into_iter()
                .filter(|c| !Self::change_originated_from(c, remote_peer_id))
                .filter(|c| !snapshot_pass_ran || c.deleted)
                .collect();
            let non_echo_len = non_echo.len();
            let filtered = self.filter_changes(non_echo, claims);
            total_count += filtered.len();
            changelog_pages += 1;
            changelog_total_in += batch_in;
            changelog_total_out += filtered.len();
            // Per-page change-log replay trace. Shows the
            // raw → non-echo → scope-filtered funnel so we can see whether
            // echo suppression or scope filter is the row-loss point.
            tracing::trace!(
                page = changelog_pages,
                cursor,
                batch_in,
                non_echo_len,
                filtered_len = filtered.len(),
                has_more,
                snapshot_pass_ran,
                "build_catchup_frames: change-log replay page"
            );

            for chunk in filtered.chunks(batch_size) {
                let msg = SyncMessage::SyncData {
                    changes: chunk.to_vec(),
                    done: false,
                };
                queue.push_back(Self::encode_wire_frame(&msg)?);
            }
            if !has_more { break; }
        }
        // Per-session summary of the change-log replay phase. Pairs with
        // the per-page traces above; useful even without trace logging
        // when correlating with cloud-side behavior.
        tracing::debug!(
            changelog_pages,
            changelog_total_in,
            changelog_total_out,
            total_count,
            max_seq,
            "build_catchup_frames: change-log replay done"
        );

        tracing::debug!(
            since_seq = effective_since_seq,
            total = total_count,
            max_seq = max_seq,
            "Built catch-up queue from change log"
        );

        let done_frame = Self::encode_wire_frame(&SyncMessage::SyncData {
            changes: vec![],
            done: true,
        })?;
        queue.push_back(done_frame);

        Ok((queue, total_count, max_seq))
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
                    // Per-frame trace. With a busy session this fires once
                    // per ~100-row batch — usually fine at debug, but
                    // promote to trace on hot loops if needed. This is the
                    // single most useful "did the receiver actually see
                    // anything?" log when diagnosing 0%-progress sessions.
                    tracing::debug!(
                        session_key,
                        remote_peer_id,
                        count,
                        done,
                        first_collection = ?changes.first().map(|c| c.collection.as_str()),
                        "receive_and_merge: SyncData frame arrived"
                    );
                    // Collect changes that pass blacklist + scope + LWW into a
                    // batch, then append them to the change log in ONE
                    // storage transaction. This is the dominant catch-up
                    // perf win: per-frame fsync cost goes from O(rows ×
                    // fields) to O(1) on the SQLite backend.
                    let mut to_append: Vec<RowChange> = Vec::with_capacity(changes.len());
                    for change in &changes {
                        // Skip changes for blacklisted collections — normalize both sides
                        // so snake_case and kebab-case entries match consistently.
                        if self.config.is_blacklisted(&change.collection) {
                            tracing::debug!(
                                "Skipping blacklisted collection change {}/{} from peer",
                                change.collection,
                                change.document_id,
                            );
                            continue;
                        }
                        // Validate incoming change is within peer's scope
                        if !self.change_in_scope(change, claims) {
                            tracing::warn!(
                                "Rejecting out-of-scope change {}/{} from peer",
                                change.collection,
                                change.document_id,
                            );
                            continue;
                        }
                        if let Some(prepared) =
                            self.prepare_single_change(&router, change).await?
                        {
                            to_append.push(prepared);
                        }
                        last_received_seq = std::cmp::max(last_received_seq, change.seq);
                    }
                    if !to_append.is_empty() {
                        self.storage.append_changes_batch(&to_append).await?;
                    }

                    if count > 0 {
                        self.peer_tracker.inc_received(session_key, count);
                        self.peer_tracker.inc_recv_progress(session_key, count);
                        self.peer_tracker.update_our_watermark(session_key, last_received_seq);
                        self.peer_tracker.touch(session_key);

                        // Checkpoint progress during initial catchup. Persist
                        // BOTH the catchup checkpoint *and* peer_watermarks
                        // every interval. Without the watermark write the
                        // since_seq advertised on next Hello stays at 0
                        // forever (peer_watermarks was previously only set on
                        // `done==true`), so a session that never reaches DONE
                        // — e.g. connection cycles mid-catchup — restarts
                        // catchup from scratch every reconnect. The change
                        // log is already appended above, so claiming the
                        // watermark up through `last_received_seq` is safe.
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
                                self.state.set_watermark(remote_peer_id, last_received_seq);
                                if let Err(e) = self.storage.set_watermark(remote_peer_id, last_received_seq).await {
                                    tracing::warn!("Failed to persist peer watermark: {}", e);
                                }
                                last_acked_seq.store(last_received_seq, Ordering::SeqCst);
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
    ///
    /// ## Stale watermark detection
    ///
    /// If `since_seq > our_max_seq` (the remote's watermark is ahead of our
    /// local change log), the remote's watermark belongs to a previous node
    /// incarnation whose change log no longer exists (e.g. DB wipe, re-install).
    /// In that case we fall back to a full primary-DB snapshot so the remote
    /// receives a complete, consistent state rather than silently sending nothing.
    async fn send_catchup_batch(
        &self,
        send: &mut dyn SyncWrite,
        since_seq: u64,
        resume_after_seq: Option<u64>,
        claims: &SyncClaims,
        remote_peer_id: &str,
    ) -> Result<(u64, usize)> {
        // Detect stale-epoch watermark: remote's stored seq is ahead of our
        // change log, meaning our log was wiped and regenerated.  Treat as
        // since_seq == 0 so we send a fresh full snapshot.
        let effective_since_seq = if since_seq > 0 {
            let our_max = self.storage.max_seq().await.unwrap_or(0);
            if since_seq > our_max {
                tracing::info!(
                    since_seq,
                    our_max_seq = our_max,
                    "Remote watermark is ahead of local change log — \
                     treating as full snapshot (stale epoch)"
                );
                0
            } else {
                since_seq
            }
        } else {
            since_seq
        };

        let mut total_count = 0usize;
        let mut max_seq = effective_since_seq;

        // See `build_catchup_frames` for the full rationale; this function
        // is the streaming twin of that one and follows the same shape:
        // primary-reader runs whenever the peer's `since_seq` is below the
        // local watcher's baseline-completion threshold, then change-log
        // replay always runs to carry tombstones + post-snapshot deltas.
        let baseline_seq = self.state.baseline_completion_seq();
        let needs_snapshot = effective_since_seq < baseline_seq;
        let mut primary_reader_did_emit = false;
        if needs_snapshot && self.config.catchup_from_primary_db {
            // Build the per-doc max-lamport map once per call. Used to
            // attach LWW-correct lamports to primary-reader emissions so
            // peer-local offline edits aren't clobbered.
            let lamport_map = self
                .storage
                .max_lamports_by_doc()
                .await
                .unwrap_or_else(|e| {
                    tracing::warn!(error = %e, "max_lamports_by_doc failed; falling back to lamport=1 for all primary-reader rows");
                    Default::default()
                });
            let fallback_lamport: u64 = 1;
            let mut primary_total_read = 0u64;

            // Iterate in priority order (auth/identity/medical before
            // activity-logs/webhook deliveries) so high-value collections
            // reach the wire first. Falls back to alphabetical when no
            // `priorities:` block is configured.
            for collection in self.config.collections_in_priority_order() {
                let page_size = 1000u64;
                let mut offset = 0u64;
                loop {
                    let mut rows = self.primary_reader.read_rows_page(
                        collection, &self.state, offset, page_size,
                    ).await?;
                    let page_len = rows.len() as u64;
                    primary_total_read += page_len;

                    for row in rows.iter_mut() {
                        let key = (row.collection.clone(), row.document_id.clone());
                        let assigned = lamport_map
                            .get(&key)
                            .copied()
                            .unwrap_or(fallback_lamport);
                        if let SyncPayload::Fields(ref mut fields) = row.payload {
                            for fc in fields.iter_mut() {
                                fc.lamport = assigned;
                            }
                        }
                    }

                    let filtered = self.filter_changes(rows, claims);
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
                        total_count += to_send.len();
                    }
                    if page_len < page_size {
                        break;
                    }
                    offset += page_size;
                }
            }
            tracing::debug!(
                since_seq = effective_since_seq,
                baseline_completion_seq = baseline_seq,
                primary_total = total_count,
                primary_total_read,
                "send_catchup_batch primary-reader pass complete; falling through to change-log replay"
            );
            primary_reader_did_emit = primary_total_read > 0;
            // Fall through to change-log replay for tombstones + deltas.
        }

        // Incremental catch-up (or fallback): read from change log (paginated).
        // When the primary-reader pass already ran AND actually read rows,
        // restrict to tombstones — see the matching block in
        // `build_catchup_frames` for the full rationale.
        let snapshot_pass_ran =
            needs_snapshot && self.config.catchup_from_primary_db && primary_reader_did_emit;
        let mut cursor = effective_since_seq;
        loop {
            let (batch, has_more) = if snapshot_pass_ran {
                self.storage
                    .query_tombstones_since_batched(cursor, self.config.query_batch_size)
                    .await?
            } else {
                self.storage
                    .query_since_batched(cursor, self.config.query_batch_size)
                    .await?
            };
            if batch.is_empty() { break; }
            let batch_max = batch.iter().map(|c| c.seq).max().unwrap_or(cursor);
            max_seq = std::cmp::max(max_seq, batch_max);
            cursor = batch_max;

            let non_echo: Vec<_> = batch.into_iter()
                .filter(|c| !Self::change_originated_from(c, remote_peer_id))
                .filter(|c| !snapshot_pass_ran || c.deleted)
                .collect();
            let filtered = self.filter_changes(non_echo, claims);
            total_count += filtered.len();

            for chunk in filtered.chunks(100) {
                self.send_batch(send, chunk, false).await?;
            }
            if !has_more { break; }
        }

        tracing::debug!(
            since_seq = effective_since_seq,
            total = total_count,
            max_seq = max_seq,
            "Sending catch-up from change log"
        );

        self.send_done(send).await?;

        Ok((max_seq, total_count))
    }

    /// Filter changes by scope dimensions (OR logic).
    fn filter_changes(&self, changes: Vec<RowChange>, claims: &SyncClaims) -> Vec<RowChange> {
        let input_len = changes.len();
        // Capture one sample of a dropped row per call so trace logs can
        // show *why* rows are being dropped (collection name, scope cols,
        // and the actual row field values that didn't match). Without this,
        // diagnosing scope-filter drops requires guessing.
        let mut sample_collection: Option<String> = None;
        let mut sample_scope_cols: Option<BTreeMap<String, String>> = None;
        let mut sample_row_fields: Option<HashMap<String, String>> = None;
        let result: Vec<RowChange> = changes
            .into_iter()
            .filter(|c| {
                let scope_cols = self.config.scope_columns_for(&c.collection);
                if scope_cols.is_empty() {
                    return true;
                }
                let row_fields = Self::extract_row_fields(c);
                let in_scope = claims.row_in_scope(scope_cols, &row_fields);
                if !in_scope && sample_collection.is_none() {
                    sample_collection = Some(c.collection.clone());
                    sample_scope_cols = Some(scope_cols.clone());
                    let mut narrowed = HashMap::new();
                    for col in scope_cols.values() {
                        if let Some(v) = row_fields.get(col) {
                            narrowed.insert(col.clone(), v.clone());
                        }
                    }
                    sample_row_fields = Some(narrowed);
                }
                in_scope
            })
            .collect();
        // Per-batch trace. Fires once per filter_changes() call (which
        // happens per page during catch-up and per frame during streaming).
        // Trace level keeps it silent in prod; enable with
        // `RUST_LOG=cadence::sync=trace` when investigating scope drops.
        if input_len > 0 {
            let kept = result.len();
            let kept_collection = result.first().map(|c| c.collection.clone());
            tracing::trace!(
                input_len,
                kept,
                dropped = input_len - kept,
                kept_collection = ?kept_collection,
                sample_dropped_collection = ?sample_collection,
                sample_dropped_scope_cols = ?sample_scope_cols,
                sample_dropped_row_fields = ?sample_row_fields,
                peer_scopes = ?claims.scopes,
                "filter_changes: scope check completed"
            );
        }
        result
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

    /// Compute the change-log entry to persist for an incoming change,
    /// without writing it. The receive loop calls this for every change in
    /// a `SyncData` frame, then batch-appends the `Some(_)` results to the
    /// change log in one transaction — `O(frame)` fsyncs instead of
    /// `O(frame × fields_per_row)`. Per-row cost without batching was the
    /// dominant catch-up latency on staging (60k+ activity-logs entries
    /// taking minutes to drain at one fsync per field).
    ///
    /// Returns:
    /// - `Some(change)` if the change should be appended (winning fields
    ///   only for LWW; original for tombstones / CRDT).
    /// - `None` if the change loses LWW completely or is invalid for the
    ///   collection's strategy.
    ///
    /// Side effects: advances the local lamport clock from the incoming
    /// fields. (Lamport advance must NOT be batched — it has to happen
    /// per-message so a partially-merged frame still bumps the clock.)
    async fn prepare_single_change(
        &self,
        router: &MergeRouter<'_>,
        change: &RowChange,
    ) -> Result<Option<RowChange>> {
        // Tombstones are authoritative — append unconditionally.
        if change.deleted {
            return Ok(Some(change.clone()));
        }

        // CRDT payloads merge in LoroDoc, not the change log — append as-is.
        if matches!(&change.payload, SyncPayload::CrdtDoc(_)) {
            if let MergeResult::Error(e) = router.merge(change, &[]) {
                tracing::warn!(
                    "CRDT merge error for {}/{}: {}",
                    change.collection,
                    change.document_id,
                    e,
                );
                return Ok(None);
            }
            return Ok(Some(change.clone()));
        }

        let SyncPayload::Fields(remote_fields) = &change.payload else {
            return Ok(None);
        };

        // Always advance the local lamport from the incoming clock — even
        // when every field loses LWW we still need to track the remote's
        // clock so future local writes don't ship lower lamports.
        for fc in remote_fields {
            self.state.merge_lamport(fc.lamport);
        }

        // Build per-field local winners (highest lamport, peer_id tiebreak)
        // by reducing the change-log history for this doc.
        let existing = self
            .storage
            .query_by_doc(&change.collection, &change.document_id)
            .await?;
        let mut local_winners: HashMap<String, FieldChange> = HashMap::new();
        for rc in &existing {
            if let SyncPayload::Fields(fs) = &rc.payload {
                for fc in fs {
                    let entry = local_winners
                        .entry(fc.field.clone())
                        .or_insert_with(|| fc.clone());
                    let remote_wins = fc.lamport > entry.lamport
                        || (fc.lamport == entry.lamport && fc.peer_id > entry.peer_id);
                    if remote_wins {
                        *entry = fc.clone();
                    }
                }
            }
        }

        // Validate strategy/payload pairing for protocol-level errors.
        if let MergeResult::Error(e) = router.merge(change, &[]) {
            tracing::warn!(
                "Merge error for {}/{}: {}",
                change.collection,
                change.document_id,
                e,
            );
            return Ok(None);
        }

        // Filter incoming fields to LWW winners only. Local-side ties (same
        // lamport + peer_id) keep the local entry — matching
        // lww_merge_field's tiebreaker.
        let mut winners: Vec<FieldChange> = Vec::with_capacity(remote_fields.len());
        for rf in remote_fields {
            let kept = match local_winners.get(&rf.field) {
                None => true,
                Some(lf) => {
                    rf.lamport > lf.lamport
                        || (rf.lamport == lf.lamport && rf.peer_id > lf.peer_id)
                }
            };
            if kept {
                winners.push(rf.clone());
            }
        }

        let dropped = remote_fields.len() - winners.len();

        if winners.is_empty() {
            tracing::debug!(
                "LWW: dropped all {} incoming fields for {}/{} (local-wins on every field)",
                remote_fields.len(),
                change.collection,
                change.document_id,
            );
            return Ok(None);
        }

        if dropped > 0 {
            tracing::debug!(
                "LWW: kept {}/{} fields for {}/{} ({} dropped by local-wins)",
                winners.len(),
                remote_fields.len(),
                change.collection,
                change.document_id,
                dropped,
            );
        }

        Ok(Some(RowChange {
            collection: change.collection.clone(),
            document_id: change.document_id.clone(),
            payload: SyncPayload::Fields(winners),
            deleted: false,
            seq: change.seq,
        }))
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
