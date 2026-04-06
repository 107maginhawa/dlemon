use cadence::auth::{SyncClaims, JwtValidator};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use std::collections::{BTreeMap, HashMap};

fn make_claims(scopes: HashMap<String, Vec<String>>, read_only: bool) -> SyncClaims {
    SyncClaims {
        sub: "test".to_string(),
        iss: "cadence".to_string(),
        aud: Some("cadence-sync".to_string()),
        exp: None,
        nbf: None,
        iat: None,
        peer_id: Some("test-peer".to_string()),
        read_only,
        scopes,
    }
}

fn scopes(entries: &[(&str, Vec<&str>)]) -> HashMap<String, Vec<String>> {
    entries
        .iter()
        .map(|(k, v)| (k.to_string(), v.iter().map(|s| s.to_string()).collect()))
        .collect()
}

// ── Single dimension ────────────────────────────────────────────

#[test]
fn test_scope_single_dimension() {
    let claims = make_claims(scopes(&[("workspace_id", vec!["ws-1"])]), false);
    assert!(claims.has_scope_value("workspace_id", "ws-1"));
    assert!(!claims.has_scope_value("workspace_id", "ws-2"));
    assert!(!claims.has_scope_value("org_id", "org-1")); // Dimension not granted
}

#[test]
fn test_scope_multiple_values_in_dimension() {
    let claims = make_claims(scopes(&[("workspace_id", vec!["ws-1", "ws-2"])]), false);
    assert!(claims.has_scope_value("workspace_id", "ws-1"));
    assert!(claims.has_scope_value("workspace_id", "ws-2"));
    assert!(!claims.has_scope_value("workspace_id", "ws-3"));
}

// ── Multi-dimension (OR logic) ──────────────────────────────────

#[test]
fn test_scope_multi_dimension_or_logic() {
    // Row with org_id=org-1 should pass if org_id dimension matches,
    // even if user_id dimension doesn't match
    let claims = make_claims(
        scopes(&[("org_id", vec!["org-1"]), ("user_id", vec!["u-5"])]),
        false,
    );

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("org_id".to_string(), "organization_id".to_string());
    scope_columns.insert("user_id".to_string(), "owner_id".to_string());

    // Row matches org_id but not user_id → passes (OR logic)
    let mut row = HashMap::new();
    row.insert("organization_id".to_string(), "org-1".to_string());
    row.insert("owner_id".to_string(), "u-99".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row));

    // Row matches user_id but not org_id → passes (OR logic)
    let mut row2 = HashMap::new();
    row2.insert("organization_id".to_string(), "org-99".to_string());
    row2.insert("owner_id".to_string(), "u-5".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row2));

    // Row matches neither → rejected
    let mut row3 = HashMap::new();
    row3.insert("organization_id".to_string(), "org-99".to_string());
    row3.insert("owner_id".to_string(), "u-99".to_string());
    assert!(!claims.row_in_scope(&scope_columns, &row3));
}

// ── Wildcard ────────────────────────────────────────────────────

#[test]
fn test_scope_wildcard() {
    let claims = make_claims(scopes(&[("workspace_id", vec!["*"])]), false);
    assert!(claims.has_scope_value("workspace_id", "any-value"));
    assert!(claims.has_scope_value("workspace_id", "ws-1"));
    assert!(claims.is_wildcard("workspace_id"));
    assert!(!claims.is_wildcard("org_id")); // Not granted
}

// ── Missing dimension ───────────────────────────────────────────

#[test]
fn test_scope_missing_dimension_rejected() {
    // Claims have no "workspace_id" dimension at all
    let claims = make_claims(scopes(&[("org_id", vec!["org-1"])]), false);

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("workspace_id".to_string(), "workspace_id".to_string());

    let mut row = HashMap::new();
    row.insert("workspace_id".to_string(), "ws-1".to_string());

    // Only workspace_id dimension configured, peer has no grant → rejected
    assert!(!claims.row_in_scope(&scope_columns, &row));
}

// ── Scope intersection ──────────────────────────────────────────

#[test]
fn test_scope_intersection() {
    let a = make_claims(scopes(&[("workspace_id", vec!["ws-1", "ws-2"])]), false);
    let b = make_claims(scopes(&[("workspace_id", vec!["ws-2", "ws-3"])]), false);

    let intersection = a.scope_intersection(&b);
    assert_eq!(
        intersection.get("workspace_id").unwrap(),
        &vec!["ws-2".to_string()]
    );
}

#[test]
fn test_scope_wildcard_intersection() {
    let wildcard = make_claims(scopes(&[("workspace_id", vec!["*"])]), false);
    let specific = make_claims(scopes(&[("workspace_id", vec!["ws-1", "ws-2"])]), false);

    // Wildcard × specific = specific
    let intersection = wildcard.scope_intersection(&specific);
    let vals = intersection.get("workspace_id").unwrap();
    assert!(vals.contains(&"ws-1".to_string()));
    assert!(vals.contains(&"ws-2".to_string()));
    assert_eq!(vals.len(), 2);

    // Both wildcard = wildcard
    let wildcard2 = make_claims(scopes(&[("workspace_id", vec!["*"])]), false);
    let intersection = wildcard.scope_intersection(&wildcard2);
    assert_eq!(
        intersection.get("workspace_id").unwrap(),
        &vec!["*".to_string()]
    );
}

// ── Row-level scope check ───────────────────────────────────────

#[test]
fn test_row_in_scope() {
    let claims = make_claims(scopes(&[("workspace_id", vec!["ws-1"])]), false);

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("workspace_id".to_string(), "workspace_id".to_string());

    // Matching row
    let mut row = HashMap::new();
    row.insert("workspace_id".to_string(), "ws-1".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row));

    // Non-matching row
    let mut row2 = HashMap::new();
    row2.insert("workspace_id".to_string(), "ws-2".to_string());
    assert!(!claims.row_in_scope(&scope_columns, &row2));

    // No scope columns configured → always in scope
    assert!(claims.row_in_scope(&BTreeMap::new(), &row2));
}

#[test]
fn test_row_in_scope_wildcard_passes_all() {
    let claims = make_claims(scopes(&[("workspace_id", vec!["*"])]), false);

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("workspace_id".to_string(), "workspace_id".to_string());

    let mut row = HashMap::new();
    row.insert("workspace_id".to_string(), "any-workspace".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row));
}

#[test]
fn test_row_in_scope_missing_column_in_row() {
    let claims = make_claims(scopes(&[("workspace_id", vec!["ws-1"])]), false);

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("workspace_id".to_string(), "workspace_id".to_string());

    // Row doesn't have the scope column → rejected
    let row = HashMap::new();
    assert!(!claims.row_in_scope(&scope_columns, &row));
}

// ── Read-only ───────────────────────────────────────────────────

#[test]
fn test_read_only() {
    let claims = make_claims(scopes(&[("workspace_id", vec!["ws-1"])]), true);
    assert!(!claims.can_write());

    let rw = make_claims(scopes(&[("workspace_id", vec!["ws-1"])]), false);
    assert!(rw.can_write());
}

// ── JWT validation ──────────────────────────────────────────────

#[tokio::test]
async fn test_jwt_expiration_check() {
    let key = EncodingKey::from_secret(b"test-secret");
    let decoding_key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "test",
        "aud": "cadence-sync",
        "exp": now - 3600,
        "nbf": now - 7200,
        "iat": now - 7200,
        "read_only": false,
        "scopes": {}
    });

    let token = encode(&Header::new(Algorithm::HS256), &claims, &key).unwrap();

    let mut validation = jsonwebtoken::Validation::new(Algorithm::HS256);
    validation.set_audience(&["cadence-sync"]);
    validation.validate_exp = true;

    let result = jsonwebtoken::decode::<SyncClaims>(&token, &decoding_key, &validation);
    assert!(result.is_err(), "Expired JWT should be rejected");
}

#[tokio::test]
async fn test_jwt_not_before_check() {
    let key = EncodingKey::from_secret(b"test-secret");
    let decoding_key = jsonwebtoken::DecodingKey::from_secret(b"test-secret");

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "test",
        "aud": "cadence-sync",
        "exp": now + 7200,
        "nbf": now + 3600,
        "iat": now,
        "read_only": false,
        "scopes": {}
    });

    let token = encode(&Header::new(Algorithm::HS256), &claims, &key).unwrap();

    let mut validation = jsonwebtoken::Validation::new(Algorithm::HS256);
    validation.set_audience(&["cadence-sync"]);
    validation.validate_nbf = true;

    let result = jsonwebtoken::decode::<SyncClaims>(&token, &decoding_key, &validation);
    assert!(result.is_err(), "Future nbf JWT should be rejected");
}

// ── Use-case: Healthcare facility scoping ───────────────────────

#[test]
fn test_usecase_clinic_with_multiple_facilities() {
    // A clinic peer has access to facilities F1 and F2
    let claims = make_claims(scopes(&[("facility_id", vec!["F1", "F2"])]), false);

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("facility_id".to_string(), "facility".to_string());

    // Patient in F1 → accessible
    let mut row = HashMap::new();
    row.insert("facility".to_string(), "F1".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row));

    // Patient in F3 → not accessible
    let mut row2 = HashMap::new();
    row2.insert("facility".to_string(), "F3".to_string());
    assert!(!claims.row_in_scope(&scope_columns, &row2));
}

#[test]
fn test_usecase_cloud_peer_wildcard_all_facilities() {
    // Cloud/online peer has wildcard access to all facilities
    let claims = make_claims(scopes(&[("facility_id", vec!["*"])]), false);

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("facility_id".to_string(), "facility".to_string());

    let mut row = HashMap::new();
    row.insert("facility".to_string(), "any-facility".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row));
}

// ── Use-case: Workspace-scoped task management ──────────────────

#[test]
fn test_usecase_workspace_scoped_projects() {
    let claims = make_claims(scopes(&[("workspace_id", vec!["clinic-a"])]), false);

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("workspace_id".to_string(), "workspace_id".to_string());

    let mut row_a = HashMap::new();
    row_a.insert("workspace_id".to_string(), "clinic-a".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row_a));

    let mut row_b = HashMap::new();
    row_b.insert("workspace_id".to_string(), "clinic-b".to_string());
    assert!(!claims.row_in_scope(&scope_columns, &row_b));
}

// ── Use-case: User-scoped personal settings ─────────────────────

#[test]
fn test_usecase_user_scoped_settings() {
    let claims = make_claims(
        scopes(&[("org_id", vec!["org-1"]), ("user_id", vec!["u-5"])]),
        false,
    );

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("user_id".to_string(), "owner_id".to_string());

    // User's own settings
    let mut own = HashMap::new();
    own.insert("owner_id".to_string(), "u-5".to_string());
    assert!(claims.row_in_scope(&scope_columns, &own));

    // Someone else's settings
    let mut other = HashMap::new();
    other.insert("owner_id".to_string(), "u-99".to_string());
    assert!(!claims.row_in_scope(&scope_columns, &other));
}

// ── Use-case: Multi-dimension OR — org-level table with user override

#[test]
fn test_usecase_org_table_or_user_override() {
    // A table scoped by both org_id AND user_id (OR logic)
    // Peer has org_id=org-1 and user_id=u-5
    let claims = make_claims(
        scopes(&[("org_id", vec!["org-1"]), ("user_id", vec!["u-5"])]),
        false,
    );

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("org_id".to_string(), "org_id".to_string());
    scope_columns.insert("user_id".to_string(), "user_id".to_string());

    // Row belongs to org-1 but user is different → passes (org matches)
    let mut row1 = HashMap::new();
    row1.insert("org_id".to_string(), "org-1".to_string());
    row1.insert("user_id".to_string(), "u-99".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row1));

    // Row belongs to different org but user matches → passes
    let mut row2 = HashMap::new();
    row2.insert("org_id".to_string(), "org-99".to_string());
    row2.insert("user_id".to_string(), "u-5".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row2));

    // Row matches both → passes
    let mut row3 = HashMap::new();
    row3.insert("org_id".to_string(), "org-1".to_string());
    row3.insert("user_id".to_string(), "u-5".to_string());
    assert!(claims.row_in_scope(&scope_columns, &row3));

    // Row matches neither → rejected
    let mut row4 = HashMap::new();
    row4.insert("org_id".to_string(), "org-99".to_string());
    row4.insert("user_id".to_string(), "u-99".to_string());
    assert!(!claims.row_in_scope(&scope_columns, &row4));
}

// ── Three-peer varying scopes ───────────────────────────────────

#[test]
fn test_scope_three_peers_varying_scopes() {
    let online = make_claims(scopes(&[("facility_id", vec!["*"])]), false);
    let peer_a = make_claims(scopes(&[("facility_id", vec!["F1", "F2"])]), false);
    let peer_b = make_claims(scopes(&[("facility_id", vec!["F2", "F3"])]), false);

    // Online ↔ A: A gets F1, F2
    let scope_online_a = online.scope_intersection(&peer_a);
    let vals = scope_online_a.get("facility_id").unwrap();
    assert!(vals.contains(&"F1".to_string()));
    assert!(vals.contains(&"F2".to_string()));
    assert_eq!(vals.len(), 2);

    // Online ↔ B: B gets F2, F3
    let scope_online_b = online.scope_intersection(&peer_b);
    let vals = scope_online_b.get("facility_id").unwrap();
    assert!(vals.contains(&"F2".to_string()));
    assert!(vals.contains(&"F3".to_string()));
    assert_eq!(vals.len(), 2);

    // A ↔ B: only F2
    let scope_a_b = peer_a.scope_intersection(&peer_b);
    assert_eq!(
        scope_a_b.get("facility_id").unwrap(),
        &vec!["F2".to_string()]
    );
}

// ── Empty scopes (no dimensions) ────────────────────────────────

#[test]
fn test_empty_scopes_no_access() {
    let claims = make_claims(HashMap::new(), false);

    let mut scope_columns = BTreeMap::new();
    scope_columns.insert("workspace_id".to_string(), "workspace_id".to_string());

    let mut row = HashMap::new();
    row.insert("workspace_id".to_string(), "ws-1".to_string());

    // No scopes at all → rejected (no dimension passes)
    assert!(!claims.row_in_scope(&scope_columns, &row));
}

#[test]
fn test_no_scope_columns_always_passes() {
    let claims = make_claims(HashMap::new(), false);

    // No scope columns configured → always in scope (unscoped table)
    let row = HashMap::new();
    assert!(claims.row_in_scope(&BTreeMap::new(), &row));
}

// ── JwtValidator modes ──────────────────────────────────────────

#[tokio::test]
async fn test_validator_with_static_key_accepts_valid_jwt() {
    let secret = b"test-secret-key";
    let key = EncodingKey::from_secret(secret);
    let decoding_key = jsonwebtoken::DecodingKey::from_secret(secret);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "peer-1",
        "aud": "cadence-sync",
        "exp": now + 3600,
        "scopes": {"workspace_id": ["ws-1", "ws-2"]},
        "read_only": false
    });

    let token = encode(&Header::new(Algorithm::HS256), &claims, &key).unwrap();
    let validator = JwtValidator::with_static_key(decoding_key);

    let result = validator.validate(&token).await;
    assert!(result.is_ok(), "Valid JWT should be accepted");
    let parsed = result.unwrap();
    assert_eq!(parsed.sub, "peer-1");
    assert!(parsed.has_scope_value("workspace_id", "ws-1"));
    assert!(parsed.has_scope_value("workspace_id", "ws-2"));
    assert!(!parsed.has_scope_value("workspace_id", "ws-3"));
}

#[tokio::test]
async fn test_validator_with_static_key_rejects_wrong_secret() {
    let key = EncodingKey::from_secret(b"correct-secret");
    let decoding_key = jsonwebtoken::DecodingKey::from_secret(b"wrong-secret");

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "peer-1",
        "aud": "cadence-sync",
        "exp": now + 3600,
        "scopes": {},
        "read_only": false
    });

    let token = encode(&Header::new(Algorithm::HS256), &claims, &key).unwrap();
    let validator = JwtValidator::with_static_key(decoding_key);

    let result = validator.validate(&token).await;
    assert!(result.is_err(), "JWT signed with wrong secret should be rejected");
}

#[tokio::test]
async fn test_validator_no_verify_accepts_any_jwt() {
    // Sign with any secret — no_verify should still accept it
    let key = EncodingKey::from_secret(b"any-secret");

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "cadence-demo-peer",
        "aud": "cadence-sync",
        "exp": now + 3600,
        "scopes": {"workspace_id": ["*"]},
        "read_only": false
    });

    let token = encode(&Header::new(Algorithm::HS256), &claims, &key).unwrap();
    let validator = JwtValidator::no_verify();

    let result = validator.validate(&token).await;
    assert!(result.is_ok(), "no_verify should accept any JWT: {:?}", result.err());
    let parsed = result.unwrap();
    assert_eq!(parsed.sub, "cadence-demo-peer");
    assert!(parsed.is_wildcard("workspace_id"));
}

#[tokio::test]
async fn test_validator_no_verify_accepts_expired_jwt() {
    let key = EncodingKey::from_secret(b"secret");

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "peer",
        "aud": "cadence-sync",
        "exp": now - 3600,  // expired
        "scopes": {"workspace_id": ["ws-1"]},
        "read_only": false
    });

    let token = encode(&Header::new(Algorithm::HS256), &claims, &key).unwrap();
    let validator = JwtValidator::no_verify();

    let result = validator.validate(&token).await;
    assert!(result.is_ok(), "no_verify should ignore expiration");
}

#[tokio::test]
async fn test_validator_jwks_requires_url() {
    // JwtValidator::new() with JWKS URL — verify it's created correctly.
    // We can't test the actual JWKS fetch without a server, but we verify
    // that a token without a 'kid' header is rejected (since JWKS lookup needs kid).
    let storage = cadence::storage::Storage::in_memory()
        .expect("Failed to open in-memory storage");
    let storage = std::sync::Arc::new(storage);

    let validator = JwtValidator::new(vec!["http://localhost:9999/.well-known/jwks.json".to_string()], storage);

    // Create a token without a 'kid' header
    let key = EncodingKey::from_secret(b"secret");
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "peer",
        "aud": "cadence-sync",
        "exp": now + 3600,
        "scopes": {},
        "read_only": false
    });

    let token = encode(&Header::new(Algorithm::HS256), &claims, &key).unwrap();

    let result = validator.validate(&token).await;
    assert!(result.is_err(), "JWKS validator should reject token without kid header");
    let err_msg = format!("{:?}", result.err().unwrap());
    assert!(err_msg.contains("kid"), "Error should mention missing kid: {}", err_msg);
}
