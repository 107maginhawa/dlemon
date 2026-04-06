use anyhow::Result;
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

/// Deserializes a field that can be either a single string or a list of strings.
/// Supports backward-compatible YAML configs where `jwks_url: "..."` still works.
fn deserialize_string_or_vec<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de;

    struct StringOrVec;

    impl<'de> de::Visitor<'de> for StringOrVec {
        type Value = Vec<String>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a string or a list of strings")
        }

        fn visit_str<E: de::Error>(self, value: &str) -> Result<Vec<String>, E> {
            Ok(vec![value.to_string()])
        }

        fn visit_seq<A: de::SeqAccess<'de>>(self, mut seq: A) -> Result<Vec<String>, A::Error> {
            let mut vec = Vec::new();
            while let Some(val) = seq.next_element::<String>()? {
                vec.push(val);
            }
            Ok(vec)
        }

        fn visit_none<E: de::Error>(self) -> Result<Vec<String>, E> {
            Ok(Vec::new())
        }

        fn visit_unit<E: de::Error>(self) -> Result<Vec<String>, E> {
            Ok(Vec::new())
        }
    }

    deserializer.deserialize_any(StringOrVec)
}

/// Conflict resolution strategy per collection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConflictStrategy {
    /// Field-level Last-Write-Wins using Lamport clock + peer_id.
    Lww,
    /// Full CRDT via Loro for collaborative editing.
    Crdt,
}

impl Default for ConflictStrategy {
    fn default() -> Self {
        Self::Lww
    }
}

/// Configuration for a single synced collection (database table).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionConfig {
    pub strategy: ConflictStrategy,
    /// Maps scope dimension names to DB column names.
    /// e.g., `{"workspace_id": "workspace_id", "org_id": "organization_id"}`
    #[serde(default)]
    pub scope_columns: BTreeMap<String, String>,
    /// Scope auto-detection rules (only used on the `"*"` wildcard entry).
    /// Maps DB column name → scope dimension name.
    /// For each discovered table, checks if the column exists and adds it to scope_columns.
    #[serde(default)]
    pub scope_rules: Option<BTreeMap<String, String>>,
}

/// P2P (QUIC/Iroh) transport configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2pConfig {
    /// Enable QUIC/Iroh P2P transport (default: true).
    /// Set to false in environments where direct P2P won't work (e.g., Kubernetes).
    #[serde(default = "default_p2p_enabled")]
    pub enabled: bool,
}

impl Default for P2pConfig {
    fn default() -> Self {
        Self {
            enabled: default_p2p_enabled(),
        }
    }
}

fn default_p2p_enabled() -> bool {
    true
}

/// API server configuration (health, metrics, status, peers, and optional WebSocket sync).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiServerConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_api_port")]
    pub port: u16,
    /// Enable WebSocket sync endpoint on this server.
    #[serde(default = "default_ws_enabled")]
    pub ws_enabled: bool,
    /// Path for the WebSocket sync endpoint (default: "/sync").
    #[serde(default = "default_ws_path")]
    pub ws_path: String,
}

impl Default for ApiServerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            port: default_api_port(),
            ws_enabled: true,
            ws_path: default_ws_path(),
        }
    }
}

fn default_api_port() -> u16 {
    7890
}

fn default_ws_path() -> String {
    "/sync".to_string()
}

fn default_ws_enabled() -> bool {
    true
}

/// Top-level Cadence v2 configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadenceConfig {
    /// Per-collection sync configuration. Key is table name.
    /// Use `"*"` as a key to auto-discover all tables from the database.
    #[serde(default)]
    pub collections: BTreeMap<String, CollectionConfig>,

    /// Tables to exclude from wildcard auto-discovery.
    #[serde(default)]
    pub collections_blacklist: Vec<String>,

    /// Default conflict strategy for unconfigured collections.
    #[serde(default)]
    pub default_strategy: ConflictStrategy,

    /// Bootstrap peer node IDs to connect to on startup.
    #[serde(default)]
    pub bootstrap_peers: Vec<String>,

    /// P2P (QUIC/Iroh) transport configuration.
    #[serde(default)]
    pub p2p: P2pConfig,

    /// API server (health, metrics, status, peers, and optional WS sync).
    #[serde(default, alias = "health_server")]
    pub api_server: ApiServerConfig,

    /// JWKS URLs for JWT validation. Supports multiple identity providers.
    /// Accepts a single string or an array of strings in YAML.
    #[serde(default, alias = "jwks_url", deserialize_with = "deserialize_string_or_vec")]
    pub jwks_urls: Vec<String>,

    /// Path to the metadata SQLite database.
    #[serde(default = "default_metadata_path")]
    pub metadata_db_path: String,

    /// Primary database connection string (required at runtime).
    /// Cadence refuses to start without it. Used to derive the metadata DB filename.
    #[serde(default = "default_primary_db_url")]
    pub primary_db_url: String,

    /// Override the data directory for metadata DB files.
    /// Defaults to platform-specific directory (e.g., ~/Library/Application Support/cadence/).
    #[serde(default)]
    pub data_dir: Option<String>,

    /// Metadata storage backend: "sqlite" (default) or "valkey" (future).
    #[serde(default = "default_metadata_backend")]
    pub metadata_backend: String,

    /// Valkey URL for distributed metadata backend (future).
    #[serde(default)]
    pub valkey_url: Option<String>,

    /// SQLite polling interval in milliseconds.
    #[serde(default = "default_poll_interval_ms")]
    pub poll_interval_ms: u64,

    /// Maximum number of rows to cache for change detection (LRU eviction).
    /// Higher values use more memory but reduce false-positive change detection.
    /// Default: 100,000 rows (~20 MB with hash-based storage).
    #[serde(default = "default_watcher_lru_capacity")]
    pub watcher_lru_capacity: usize,

    /// Change log compaction interval in seconds.
    #[serde(default = "default_compaction_interval_secs")]
    pub compaction_interval_secs: u64,

    /// JWT token for authenticating with peers.
    /// Obtained from the token server (e.g., HapiHub) and passed to cadence.
    #[serde(default)]
    pub peer_token: Option<String>,

    /// Keepalive probe interval in seconds for persistent connections.
    #[serde(default = "default_keepalive_interval_secs")]
    pub keepalive_interval_secs: u64,

    /// Liveness timeout in seconds — disconnect if no message received within this window.
    #[serde(default = "default_liveness_timeout_secs")]
    pub liveness_timeout_secs: u64,

    /// Base delay in milliseconds for reconnect backoff.
    #[serde(default = "default_reconnect_base_delay_ms")]
    pub reconnect_base_delay_ms: u64,

    /// Maximum delay in milliseconds for reconnect backoff.
    #[serde(default = "default_reconnect_max_delay_ms")]
    pub reconnect_max_delay_ms: u64,

    /// Maximum consecutive connection failures before the process exits.
    /// Set to 0 to retry forever (not recommended in production).
    #[serde(default = "default_max_reconnect_attempts")]
    pub max_reconnect_attempts: u32,

    /// Capacity of the broadcast channel for change notifications.
    #[serde(default = "default_broadcast_channel_capacity")]
    pub broadcast_channel_capacity: usize,

    /// Maximum idle time in milliseconds for disconnected peers before they are
    /// removed from the tracker. Set to 0 to disable reaping.
    #[serde(default = "default_peer_idle_timeout_ms")]
    pub peer_idle_timeout_ms: u64,

    /// Change log retention in milliseconds. Entries older than this are eligible
    /// for cleanup. Set to 0 to disable time-based cleanup.
    #[serde(default = "default_change_log_retention_ms")]
    pub change_log_retention_ms: u64,

    /// Checkpoint interval for resumable initial catchup.
    /// Checkpoints are saved every N records received during initial sync.
    /// Lower values provide finer resume granularity but more storage writes.
    #[serde(default = "default_checkpoint_interval")]
    pub checkpoint_interval: usize,
}

fn default_metadata_path() -> String {
    "cadence_metadata.db".to_string()
}

fn default_metadata_backend() -> String {
    "sqlite".to_string()
}

fn default_primary_db_url() -> String {
    String::new()
}

fn default_poll_interval_ms() -> u64 {
    1000
}

fn default_watcher_lru_capacity() -> usize {
    100_000
}

fn default_compaction_interval_secs() -> u64 {
    3600
}

fn default_keepalive_interval_secs() -> u64 {
    10
}

fn default_liveness_timeout_secs() -> u64 {
    30
}

fn default_reconnect_base_delay_ms() -> u64 {
    1000
}

fn default_reconnect_max_delay_ms() -> u64 {
    60000
}

fn default_max_reconnect_attempts() -> u32 {
    10
}

fn default_broadcast_channel_capacity() -> usize {
    256
}

fn default_peer_idle_timeout_ms() -> u64 {
    10_000
}

fn default_change_log_retention_ms() -> u64 {
    3_600_000 // 1 hour
}

fn default_checkpoint_interval() -> usize {
    100
}

impl Default for CadenceConfig {
    fn default() -> Self {
        Self {
            collections: BTreeMap::new(),
            collections_blacklist: Vec::new(),
            default_strategy: ConflictStrategy::default(),
            bootstrap_peers: Vec::new(),
            p2p: P2pConfig::default(),
            api_server: ApiServerConfig::default(),
            jwks_urls: Vec::new(),
            metadata_db_path: default_metadata_path(),
            primary_db_url: default_primary_db_url(),
            data_dir: None,
            metadata_backend: default_metadata_backend(),
            valkey_url: None,
            poll_interval_ms: default_poll_interval_ms(),
            watcher_lru_capacity: default_watcher_lru_capacity(),
            compaction_interval_secs: default_compaction_interval_secs(),
            peer_token: None,
            keepalive_interval_secs: default_keepalive_interval_secs(),
            liveness_timeout_secs: default_liveness_timeout_secs(),
            reconnect_base_delay_ms: default_reconnect_base_delay_ms(),
            reconnect_max_delay_ms: default_reconnect_max_delay_ms(),
            max_reconnect_attempts: default_max_reconnect_attempts(),
            broadcast_channel_capacity: default_broadcast_channel_capacity(),
            peer_idle_timeout_ms: default_peer_idle_timeout_ms(),
            change_log_retention_ms: default_change_log_retention_ms(),
            checkpoint_interval: default_checkpoint_interval(),
        }
    }
}

impl CadenceConfig {
    /// Load config from a YAML file.
    pub fn from_yaml_file(path: &Path) -> anyhow::Result<Self> {
        let contents = std::fs::read_to_string(path)?;
        Self::from_yaml_str(&contents)
    }

    /// Parse config from a YAML string.
    /// Handles backward compatibility: if `ws_server` is present in the YAML,
    /// its `enabled`/`path` fields are merged into `api_server.ws_enabled`/`ws_path`.
    pub fn from_yaml_str(yaml: &str) -> anyhow::Result<Self> {
        let mut config: Self = serde_yaml::from_str(yaml)?;

        // Backward compat: migrate legacy ws_server section
        if let Ok(raw) = serde_yaml::from_str::<serde_yaml::Value>(yaml) {
            if let Some(ws) = raw.get("ws_server") {
                if let Some(enabled) = ws.get("enabled").and_then(|v| v.as_bool()) {
                    config.api_server.ws_enabled = enabled;
                }
                if let Some(path) = ws.get("path").and_then(|v| v.as_str()) {
                    config.api_server.ws_path = path.to_string();
                }
            }
        }

        Ok(config)
    }

    /// Get the conflict strategy for a collection.
    /// Returns the configured strategy, or the default if not configured.
    pub fn strategy_for(&self, collection: &str) -> ConflictStrategy {
        self.collections
            .get(collection)
            .map(|c| c.strategy)
            .unwrap_or(self.default_strategy)
    }

    /// Get the scope columns for a collection.
    /// Returns an empty map if the collection is not configured or has no scope columns.
    pub fn scope_columns_for(&self, collection: &str) -> &BTreeMap<String, String> {
        static EMPTY: std::sync::OnceLock<BTreeMap<String, String>> = std::sync::OnceLock::new();
        self.collections
            .get(collection)
            .map(|c| &c.scope_columns)
            .unwrap_or_else(|| EMPTY.get_or_init(BTreeMap::new))
    }

    /// Apply environment variable overrides after loading YAML config.
    /// Supports: CADENCE_PEER_TOKEN, CADENCE_BOOTSTRAP_PEERS, CADENCE_JWKS_URL,
    /// CADENCE_PRIMARY_DB_URL, CADENCE_DATA_DIR, CADENCE_METADATA_BACKEND,
    /// CADENCE_VALKEY_URL, CADENCE_API_PORT (or CADENCE_HEALTH_PORT for backward compat)
    pub fn apply_env_overrides(&mut self) {
        if let Ok(token) = std::env::var("CADENCE_PEER_TOKEN") {
            self.peer_token = Some(token);
        }
        if let Ok(peers) = std::env::var("CADENCE_BOOTSTRAP_PEERS") {
            self.bootstrap_peers = peers.split(',').map(|s| s.trim().to_string()).collect();
        }
        if let Ok(urls) = std::env::var("CADENCE_JWKS_URL") {
            self.jwks_urls = urls.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        }
        if let Ok(url) = std::env::var("CADENCE_PRIMARY_DB_URL") {
            self.primary_db_url = url;
        }
        if let Ok(dir) = std::env::var("CADENCE_DATA_DIR") {
            self.data_dir = Some(dir);
        }
        if let Ok(backend) = std::env::var("CADENCE_METADATA_BACKEND") {
            self.metadata_backend = backend;
        }
        if let Ok(url) = std::env::var("CADENCE_VALKEY_URL") {
            self.valkey_url = Some(url);
        }
        if let Ok(val) = std::env::var("CADENCE_P2P_ENABLED") {
            self.p2p.enabled = !matches!(val.to_lowercase().as_str(), "false" | "0" | "no");
        }
        if let Ok(port) = std::env::var("CADENCE_API_PORT") {
            if let Ok(p) = port.parse::<u16>() {
                self.api_server.port = p;
                self.api_server.enabled = true;
            }
        }
        // Backward compat: CADENCE_HEALTH_PORT still works
        if let Ok(port) = std::env::var("CADENCE_HEALTH_PORT") {
            if let Ok(p) = port.parse::<u16>() {
                self.api_server.port = p;
                self.api_server.enabled = true;
            }
        }
    }

    /// Collect all unique DB column names used as scope columns across all collections.
    pub fn all_scope_column_names(&self) -> std::collections::HashSet<String> {
        self.collections
            .values()
            .flat_map(|c| c.scope_columns.values().cloned())
            .collect()
    }

    /// Resolve the `"*"` wildcard entry by auto-detecting the database type from `primary_db_url`.
    /// SQLite URLs start with `sqlite://`, everything else is treated as PostgreSQL.
    pub async fn resolve_wildcard(&mut self) -> Result<()> {
        if !self.collections.contains_key("*") {
            return Ok(());
        }
        if self.primary_db_url.starts_with("sqlite://") {
            let db_path = self.primary_db_url.trim_start_matches("sqlite://");
            let conn = rusqlite::Connection::open(db_path)
                .map_err(|e| anyhow::anyhow!("Failed to open SQLite for wildcard resolution: {}", e))?;
            self.resolve_wildcard_sqlite(&conn)?;
        } else {
            let (client, connection) = tokio_postgres::connect(&self.primary_db_url, tokio_postgres::NoTls)
                .await
                .map_err(|e| anyhow::anyhow!("Failed to connect to PostgreSQL for wildcard resolution: {}", e))?;
            tokio::spawn(async move {
                if let Err(e) = connection.await {
                    tracing::error!("Wildcard resolution PG connection error: {}", e);
                }
            });
            self.resolve_wildcard_pg(&client).await?;
        }
        Ok(())
    }

    /// Resolve the `"*"` wildcard entry in `collections` by discovering tables from the database.
    ///
    /// For PostgreSQL: queries `information_schema.tables`.
    /// For SQLite: queries `sqlite_master`.
    ///
    /// Each discovered table is converted from snake_case to kebab-case, filtered against
    /// `collections_blacklist` and existing explicit entries, then added with the wildcard's
    /// strategy and auto-detected scope columns.
    pub async fn resolve_wildcard_pg(&mut self, client: &tokio_postgres::Client) -> Result<()> {
        let wildcard = match self.collections.remove("*") {
            Some(w) => w,
            None => return Ok(()), // No wildcard — nothing to do
        };

        let tables = crate::schema::list_all_tables_pg(client).await?;
        let mut discovered = 0u32;

        for table in &tables {
            let collection_name = table_to_collection(table);

            if self.collections_blacklist.contains(&collection_name) {
                continue;
            }
            if self.collections.contains_key(&collection_name) {
                continue; // Explicit entry takes precedence
            }

            // Auto-detect scope columns from scope_rules
            let mut scope_columns = BTreeMap::new();
            if let Some(ref rules) = wildcard.scope_rules {
                for (db_column, scope_dim) in rules {
                    if crate::schema::table_has_column_pg(client, table, db_column).await? {
                        scope_columns.insert(scope_dim.clone(), db_column.clone());
                    }
                }
            }

            self.collections.insert(
                collection_name,
                CollectionConfig {
                    strategy: wildcard.strategy,
                    scope_columns,
                    scope_rules: None,
                },
            );
            discovered += 1;
        }

        tracing::info!("Auto-discovered {} tables from wildcard", discovered);
        Ok(())
    }

    /// Resolve the `"*"` wildcard entry using a SQLite connection.
    pub fn resolve_wildcard_sqlite(&mut self, conn: &rusqlite::Connection) -> Result<()> {
        let wildcard = match self.collections.remove("*") {
            Some(w) => w,
            None => return Ok(()),
        };

        let tables = crate::schema::list_all_tables_sqlite(conn)?;
        let mut discovered = 0u32;

        for table in &tables {
            let collection_name = table_to_collection(table);

            if self.collections_blacklist.contains(&collection_name) {
                continue;
            }
            if self.collections.contains_key(&collection_name) {
                continue;
            }

            let mut scope_columns = BTreeMap::new();
            if let Some(ref rules) = wildcard.scope_rules {
                for (db_column, scope_dim) in rules {
                    if crate::schema::table_has_column_sqlite(conn, table, db_column)? {
                        scope_columns.insert(scope_dim.clone(), db_column.clone());
                    }
                }
            }

            self.collections.insert(
                collection_name,
                CollectionConfig {
                    strategy: wildcard.strategy,
                    scope_columns,
                    scope_rules: None,
                },
            );
            discovered += 1;
        }

        tracing::info!("Auto-discovered {} tables from wildcard", discovered);
        Ok(())
    }
}

/// Convert a database table name (snake_case) to a collection name (kebab-case).
/// e.g., `medical_patients` → `medical-patients`
pub fn table_to_collection(table: &str) -> String {
    table.replace('_', "-")
}
