use cadence::config::{CadenceConfig, ConflictStrategy};

#[test]
fn test_config_default_values() {
    let config = CadenceConfig::default();
    assert_eq!(config.default_strategy, ConflictStrategy::Lww);
    assert!(config.collections.is_empty());
    assert!(config.bootstrap_peers.is_empty());
    assert!(config.api_server.enabled);
    assert_eq!(config.api_server.port, 7890);
}

#[test]
fn test_config_parse_yaml() {
    let yaml = r#"
collections:
  medical_patients:
    strategy: lww
    scope_columns:
      facility_id: facility
  clinical_notes:
    strategy: crdt
    scope_columns:
      facility_id: facility
  organizations:
    strategy: lww
default_strategy: lww
bootstrap_peers:
  - "abc123"
"#;

    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert_eq!(config.collections.len(), 3);
    assert_eq!(
        config.collections["medical_patients"].strategy,
        ConflictStrategy::Lww
    );
    assert_eq!(
        config.collections["clinical_notes"].strategy,
        ConflictStrategy::Crdt
    );
    assert_eq!(config.bootstrap_peers, vec!["abc123"]);

    // Check scope_columns
    let sc = config.scope_columns_for("medical_patients");
    assert_eq!(sc.get("facility_id").unwrap(), "facility");

    // Organizations has no scope_columns
    assert!(config.scope_columns_for("organizations").is_empty());
}

#[test]
fn test_config_collection_strategy_lookup() {
    let yaml = r#"
collections:
  medical_patients:
    strategy: lww
  clinical_notes:
    strategy: crdt
default_strategy: lww
"#;

    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert_eq!(
        config.strategy_for("medical_patients"),
        ConflictStrategy::Lww
    );
    assert_eq!(
        config.strategy_for("clinical_notes"),
        ConflictStrategy::Crdt
    );
    // Unknown collection falls back to default
    assert_eq!(
        config.strategy_for("unknown_table"),
        ConflictStrategy::Lww
    );
}

#[test]
fn test_config_bootstrap_peers_parsing() {
    let yaml = r#"
bootstrap_peers:
  - "node-id-1"
  - "node-id-2"
  - "node-id-3"
"#;

    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert_eq!(config.bootstrap_peers.len(), 3);
    assert_eq!(config.bootstrap_peers[0], "node-id-1");
}

#[test]
fn test_config_api_server_enabled_by_default() {
    let yaml = "collections: {}";
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert!(config.api_server.enabled);

    let yaml_enabled = r#"
api_server:
  enabled: true
  port: 8080
"#;
    let config = CadenceConfig::from_yaml_str(yaml_enabled).unwrap();
    assert!(config.api_server.enabled);
    assert_eq!(config.api_server.port, 8080);
}

#[test]
fn test_config_api_server_health_server_alias() {
    // Backward compat: health_server YAML key still works
    let yaml = r#"
health_server:
  enabled: true
  port: 8080
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert!(config.api_server.enabled);
    assert_eq!(config.api_server.port, 8080);
}

#[test]
fn test_config_persistent_sync_defaults() {
    let config = CadenceConfig::default();
    assert_eq!(config.keepalive_interval_secs, 10);
    assert_eq!(config.liveness_timeout_secs, 30);
    assert_eq!(config.reconnect_base_delay_ms, 1000);
    assert_eq!(config.reconnect_max_delay_ms, 60000);
    assert_eq!(config.broadcast_channel_capacity, 256);
}

#[test]
fn test_config_persistent_sync_yaml_override() {
    let yaml = r#"
keepalive_interval_secs: 5
liveness_timeout_secs: 15
reconnect_base_delay_ms: 500
reconnect_max_delay_ms: 30000
broadcast_channel_capacity: 512
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert_eq!(config.keepalive_interval_secs, 5);
    assert_eq!(config.liveness_timeout_secs, 15);
    assert_eq!(config.reconnect_base_delay_ms, 500);
    assert_eq!(config.reconnect_max_delay_ms, 30000);
    assert_eq!(config.broadcast_channel_capacity, 512);
}

#[test]
fn test_config_peer_token() {
    let yaml = r#"
peer_token: "eyJhbGciOiJIUzI1NiJ9.test"
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert_eq!(config.peer_token.as_deref(), Some("eyJhbGciOiJIUzI1NiJ9.test"));
}

#[test]
fn test_config_scope_columns_multi_dimension() {
    let yaml = r#"
collections:
  user_settings:
    strategy: lww
    scope_columns:
      user_id: owner_id
      organization_id: org_id
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    let sc = config.scope_columns_for("user_settings");
    assert_eq!(sc.len(), 2);
    assert_eq!(sc.get("user_id").unwrap(), "owner_id");
    assert_eq!(sc.get("organization_id").unwrap(), "org_id");
}

#[test]
fn test_config_all_scope_column_names() {
    let yaml = r#"
collections:
  patients:
    strategy: lww
    scope_columns:
      facility_id: facility
  tasks:
    strategy: lww
    scope_columns:
      workspace_id: workspace_id
  user_settings:
    strategy: lww
    scope_columns:
      user_id: owner_id
      organization_id: org_id
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    let names = config.all_scope_column_names();
    assert!(names.contains("facility"));
    assert!(names.contains("workspace_id"));
    assert!(names.contains("owner_id"));
    assert!(names.contains("org_id"));
    assert_eq!(names.len(), 4);
}

#[test]
fn test_config_ws_defaults() {
    let config = CadenceConfig::default();
    assert!(config.api_server.ws_enabled);
    assert_eq!(config.api_server.ws_path, "/sync");
}

#[test]
fn test_config_ws_from_yaml() {
    let yaml = r#"
api_server:
  enabled: true
  port: 9090
  ws_enabled: true
  ws_path: "/cadence/sync"
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert!(config.api_server.ws_enabled);
    assert_eq!(config.api_server.ws_path, "/cadence/sync");
}

#[test]
fn test_config_ws_server_legacy_yaml() {
    // Backward compat: ws_server section is migrated to api_server fields
    let yaml = r#"
ws_server:
  enabled: true
  path: "/cadence/sync"
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert!(config.api_server.ws_enabled);
    assert_eq!(config.api_server.ws_path, "/cadence/sync");
}

#[test]
fn test_config_bootstrap_peers_mixed() {
    let yaml = r#"
bootstrap_peers:
  - "wss://cadence.cloud.example.com/sync"
  - "abc123def456"
  - "ws://localhost:9091/sync"
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert_eq!(config.bootstrap_peers.len(), 3);
    assert_eq!(config.bootstrap_peers[0], "wss://cadence.cloud.example.com/sync");
    assert_eq!(config.bootstrap_peers[1], "abc123def456");
    assert_eq!(config.bootstrap_peers[2], "ws://localhost:9091/sync");
}

#[test]
fn test_config_bootstrap_peer_type_detection() {
    let peers = vec![
        "wss://cadence.cloud.example.com/sync".to_string(),
        "ws://localhost:9091/sync".to_string(),
        "abc123def456".to_string(),
    ];

    // WS peers
    assert!(peers[0].starts_with("ws://") || peers[0].starts_with("wss://"));
    assert!(peers[1].starts_with("ws://") || peers[1].starts_with("wss://"));
    // Non-WS peer (NodeId)
    assert!(!peers[2].starts_with("ws://") && !peers[2].starts_with("wss://"));
}

#[test]
fn test_table_to_collection() {
    use cadence::config::table_to_collection;
    assert_eq!(table_to_collection("medical_patients"), "medical-patients");
    assert_eq!(table_to_collection("billing_invoices"), "billing-invoices");
    assert_eq!(table_to_collection("organizations"), "organizations");
    assert_eq!(table_to_collection("a_b_c"), "a-b-c");
}

#[test]
fn test_config_wildcard_yaml_parsing() {
    let yaml = r#"
collections:
  clinical-notes:
    strategy: crdt
    scope_columns:
      facility_id: facility
  "*":
    strategy: lww
    scope_rules:
      facility_id: facility
      organization_id: organization
collections_blacklist:
  - email-emails
  - storage-files
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert_eq!(config.collections.len(), 2);
    assert!(config.collections.contains_key("*"));
    assert!(config.collections.contains_key("clinical-notes"));

    let wildcard = &config.collections["*"];
    assert_eq!(wildcard.strategy, ConflictStrategy::Lww);
    let rules = wildcard.scope_rules.as_ref().unwrap();
    assert_eq!(rules.get("facility_id").unwrap(), "facility");
    assert_eq!(rules.get("organization_id").unwrap(), "organization");

    assert_eq!(config.collections_blacklist, vec!["email-emails", "storage-files"]);
}

#[test]
fn test_config_collections_blacklist_defaults_empty() {
    let yaml = "collections: {}";
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert!(config.collections_blacklist.is_empty());
}

#[test]
fn test_config_scope_rules_defaults_none() {
    let yaml = r#"
collections:
  patients:
    strategy: lww
    scope_columns:
      facility_id: facility
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert!(config.collections["patients"].scope_rules.is_none());
}

#[test]
fn test_resolve_wildcard_sqlite_discovers_tables() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE medical_patients (id TEXT PRIMARY KEY, facility_id TEXT, name TEXT);
         CREATE TABLE billing_invoices (id TEXT PRIMARY KEY, facility_id TEXT, amount REAL);
         CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT);",
    ).unwrap();

    let yaml = r#"
collections:
  "*":
    strategy: lww
    scope_rules:
      facility_id: facility
"#;
    let mut config = CadenceConfig::from_yaml_str(yaml).unwrap();
    config.resolve_wildcard_sqlite(&conn).unwrap();

    // Wildcard key should be removed
    assert!(!config.collections.contains_key("*"));

    // All 3 tables discovered
    assert_eq!(config.collections.len(), 3);
    assert!(config.collections.contains_key("medical-patients"));
    assert!(config.collections.contains_key("billing-invoices"));
    assert!(config.collections.contains_key("organizations"));

    // Scope detection: facility_id column present → maps to "facility" scope dimension
    // scope_columns format: {scope_dim: db_column} (for row_in_scope matching)
    let patients = &config.collections["medical-patients"];
    assert_eq!(patients.scope_columns.get("facility").unwrap(), "facility_id");

    let invoices = &config.collections["billing-invoices"];
    assert_eq!(invoices.scope_columns.get("facility").unwrap(), "facility_id");

    // organizations has no facility_id → no scope columns
    let orgs = &config.collections["organizations"];
    assert!(orgs.scope_columns.is_empty());
}

#[test]
fn test_resolve_wildcard_sqlite_respects_blacklist() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE medical_patients (id TEXT PRIMARY KEY, name TEXT);
         CREATE TABLE email_emails (id TEXT PRIMARY KEY, body TEXT);",
    ).unwrap();

    let yaml = r#"
collections:
  "*":
    strategy: lww
collections_blacklist:
  - email-emails
"#;
    let mut config = CadenceConfig::from_yaml_str(yaml).unwrap();
    config.resolve_wildcard_sqlite(&conn).unwrap();

    assert!(config.collections.contains_key("medical-patients"));
    assert!(!config.collections.contains_key("email-emails"));
}

#[test]
fn test_resolve_wildcard_sqlite_explicit_overrides() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE clinical_notes (id TEXT PRIMARY KEY, content TEXT);
         CREATE TABLE medical_patients (id TEXT PRIMARY KEY, name TEXT);",
    ).unwrap();

    let yaml = r#"
collections:
  clinical-notes:
    strategy: crdt
    scope_columns:
      facility_id: facility
  "*":
    strategy: lww
"#;
    let mut config = CadenceConfig::from_yaml_str(yaml).unwrap();
    config.resolve_wildcard_sqlite(&conn).unwrap();

    // clinical-notes keeps its explicit crdt strategy, not overwritten by wildcard lww
    assert_eq!(config.collections["clinical-notes"].strategy, ConflictStrategy::Crdt);
    assert_eq!(config.collections["clinical-notes"].scope_columns.get("facility_id").unwrap(), "facility");

    // medical-patients discovered via wildcard
    assert_eq!(config.collections["medical-patients"].strategy, ConflictStrategy::Lww);
}

#[test]
fn test_resolve_wildcard_noop_without_star() {
    let yaml = r#"
collections:
  patients:
    strategy: lww
"#;
    let mut config = CadenceConfig::from_yaml_str(yaml).unwrap();
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    config.resolve_wildcard_sqlite(&conn).unwrap();

    // No change — no wildcard to resolve
    assert_eq!(config.collections.len(), 1);
    assert!(config.collections.contains_key("patients"));
}

#[test]
fn test_config_p2p_enabled_by_default() {
    let config = CadenceConfig::default();
    assert!(config.p2p.enabled);

    let yaml = "collections: {}";
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert!(config.p2p.enabled);
}

#[test]
fn test_config_p2p_disabled_via_yaml() {
    let yaml = r#"
p2p:
  enabled: false
"#;
    let config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert!(!config.p2p.enabled);
}

#[test]
fn test_config_p2p_disabled_via_env() {
    let yaml = r#"
p2p:
  enabled: true
"#;
    let mut config = CadenceConfig::from_yaml_str(yaml).unwrap();
    assert!(config.p2p.enabled);

    // Simulate CADENCE_P2P_ENABLED=false
    std::env::set_var("CADENCE_P2P_ENABLED", "false");
    config.apply_env_overrides();
    assert!(!config.p2p.enabled);

    // Cleanup
    std::env::remove_var("CADENCE_P2P_ENABLED");
}
