use cadence::auth::JwtValidator;
use cadence::config::CadenceConfig;
use cadence::storage::{MetadataBackend, SqliteBackend};
use cadence::token::TokenStore;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use std::collections::HashMap;
use std::sync::Arc;

fn test_secret() -> &'static [u8] {
    b"test-secret-key-for-cadence-unit-tests"
}

fn make_test_jwt(scopes: HashMap<String, Vec<String>>) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "test-user",
        "aud": "cadence-sync",
        "exp": now + 3600,
        "nbf": now - 60,
        "iat": now,
        "read_only": false,
        "scopes": scopes,
    });

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(test_secret()),
    )
    .unwrap()
}

fn make_expired_jwt() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = serde_json::json!({
        "sub": "expired",
        "aud": "cadence-sync",
        "exp": now - 3600,
        "nbf": now - 7200,
        "iat": now - 7200,
        "read_only": false,
        "scopes": {},
    });

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(test_secret()),
    )
    .unwrap()
}

fn make_store() -> (Arc<TokenStore>, Arc<SqliteBackend>) {
    let storage = Arc::new(SqliteBackend::in_memory().unwrap());
    let key = jsonwebtoken::DecodingKey::from_secret(test_secret());
    let validator = Arc::new(JwtValidator::permissive(key));
    let store = Arc::new(TokenStore::new(storage.clone(), validator));
    (store, storage)
}

// ── TokenStore: set_token ───────────────────────────────────────

#[tokio::test]
async fn test_token_store_set_and_get() {
    let (store, _) = make_store();

    assert!(store.token().await.is_none());
    assert!(store.claims().await.is_none());

    let mut scopes = HashMap::new();
    scopes.insert("workspace_id".to_string(), vec!["ws-1".to_string()]);
    let jwt = make_test_jwt(scopes);

    let claims = store.set_token(jwt.clone()).await.unwrap();
    assert_eq!(claims.sub, "test-user");
    assert!(claims.has_scope_value("workspace_id", "ws-1"));

    assert_eq!(store.token().await, Some(jwt));
    assert!(store.claims().await.is_some());
}

#[tokio::test]
async fn test_token_store_set_invalid_token_rejected() {
    let (store, _) = make_store();

    let result = store.set_token("not-a-jwt".to_string()).await;
    assert!(result.is_err());
    assert!(store.token().await.is_none());
}

#[tokio::test]
async fn test_token_store_clear() {
    let (store, _) = make_store();

    let jwt = make_test_jwt(HashMap::new());
    store.set_token(jwt).await.unwrap();
    assert!(store.token().await.is_some());

    store.clear().await;
    assert!(store.token().await.is_none());
    assert!(store.claims().await.is_none());
}

// ── TokenStore: persistence ─────────────────────────────────────

#[tokio::test]
async fn test_token_store_persists_to_storage() {
    let (store, storage) = make_store();

    let jwt = make_test_jwt(HashMap::new());
    store.set_token(jwt.clone()).await.unwrap();

    // Token should be in the DB
    let persisted = storage.get_peer_token("default").await.unwrap();
    assert_eq!(persisted, Some(jwt));
}

#[tokio::test]
async fn test_token_store_load_from_storage() {
    let storage = Arc::new(SqliteBackend::in_memory().unwrap());
    let key = jsonwebtoken::DecodingKey::from_secret(test_secret());
    let validator = Arc::new(JwtValidator::permissive(key));

    // Pre-persist a token
    let mut scopes = HashMap::new();
    scopes.insert("facility_id".to_string(), vec!["F1".to_string()]);
    let jwt = make_test_jwt(scopes);
    storage.set_peer_token("default", &jwt).await.unwrap();

    // New store loads from storage
    let store = TokenStore::new(storage, validator);
    let loaded = store.load_from_storage().await.unwrap();
    assert!(loaded);
    assert_eq!(store.token().await, Some(jwt));
    assert!(store.claims().await.unwrap().has_scope_value("facility_id", "F1"));
}

#[tokio::test]
async fn test_token_store_load_from_storage_empty() {
    let (store, _) = make_store();

    let loaded = store.load_from_storage().await.unwrap();
    assert!(!loaded);
    assert!(store.token().await.is_none());
}

#[tokio::test]
async fn test_token_store_load_from_storage_expired_ignored() {
    let storage = Arc::new(SqliteBackend::in_memory().unwrap());
    let key = jsonwebtoken::DecodingKey::from_secret(test_secret());
    // Use a strict validator that checks expiry
    let validator = Arc::new(JwtValidator::with_static_key(key));

    let expired_jwt = make_expired_jwt();
    storage.set_peer_token("default", &expired_jwt).await.unwrap();

    let store = TokenStore::new(storage, validator);
    let loaded = store.load_from_storage().await.unwrap();
    assert!(!loaded, "Expired token should be ignored");
    assert!(store.token().await.is_none());
}

// ── TokenStore: load_from_config ────────────────────────────────

#[tokio::test]
async fn test_token_store_load_from_config_peer_token() {
    let (store, _) = make_store();

    let jwt = make_test_jwt(HashMap::new());
    let config = CadenceConfig {
        peer_token: Some(jwt.clone()),
        ..Default::default()
    };

    let loaded = store.load_from_config(&config).await.unwrap();
    assert!(loaded);
    assert_eq!(store.token().await, Some(jwt));
}

#[tokio::test]
async fn test_token_store_load_from_config_no_token() {
    let (store, _) = make_store();

    let config = CadenceConfig::default();
    let loaded = store.load_from_config(&config).await.unwrap();
    assert!(!loaded);
}

// ── Storage: peer_tokens table ──────────────────────────────────

#[tokio::test]
async fn test_storage_peer_token_roundtrip() {
    let storage = SqliteBackend::in_memory().unwrap();

    assert!(storage.get_peer_token("test").await.unwrap().is_none());

    storage.set_peer_token("test", "jwt-value-1").await.unwrap();
    assert_eq!(
        storage.get_peer_token("test").await.unwrap(),
        Some("jwt-value-1".to_string())
    );

    // Update
    storage.set_peer_token("test", "jwt-value-2").await.unwrap();
    assert_eq!(
        storage.get_peer_token("test").await.unwrap(),
        Some("jwt-value-2".to_string())
    );
}

#[tokio::test]
async fn test_storage_peer_token_multiple_keys() {
    let storage = SqliteBackend::in_memory().unwrap();

    storage.set_peer_token("key-a", "jwt-a").await.unwrap();
    storage.set_peer_token("key-b", "jwt-b").await.unwrap();

    assert_eq!(storage.get_peer_token("key-a").await.unwrap(), Some("jwt-a".to_string()));
    assert_eq!(storage.get_peer_token("key-b").await.unwrap(), Some("jwt-b".to_string()));
    assert!(storage.get_peer_token("key-c").await.unwrap().is_none());
}

// ── TokenStore: token replacement ───────────────────────────────

#[tokio::test]
async fn test_token_store_replace_token() {
    let (store, _) = make_store();

    let mut scopes1 = HashMap::new();
    scopes1.insert("workspace_id".to_string(), vec!["ws-1".to_string()]);
    let jwt1 = make_test_jwt(scopes1);
    store.set_token(jwt1).await.unwrap();

    assert!(store.claims().await.unwrap().has_scope_value("workspace_id", "ws-1"));
    assert!(!store.claims().await.unwrap().has_scope_value("workspace_id", "ws-2"));

    // Replace with new token
    let mut scopes2 = HashMap::new();
    scopes2.insert("workspace_id".to_string(), vec!["ws-2".to_string()]);
    let jwt2 = make_test_jwt(scopes2);
    store.set_token(jwt2).await.unwrap();

    assert!(!store.claims().await.unwrap().has_scope_value("workspace_id", "ws-1"));
    assert!(store.claims().await.unwrap().has_scope_value("workspace_id", "ws-2"));
}

// ── Storage: JWKS cache ─────────────────────────────────────────

#[tokio::test]
async fn test_storage_jwks_cache_roundtrip() {
    let storage = SqliteBackend::in_memory().unwrap();

    assert!(storage.get_cached_jwks("https://example.com/.well-known/jwks.json").await.unwrap().is_none());

    let jwks_json = r#"{"keys":[{"kty":"EC","kid":"key-1","x":"abc","y":"def","crv":"P-256"}]}"#;
    storage.set_cached_jwks("https://example.com/.well-known/jwks.json", jwks_json).await.unwrap();

    let cached = storage.get_cached_jwks("https://example.com/.well-known/jwks.json").await.unwrap();
    assert_eq!(cached, Some(jwks_json.to_string()));
}

#[tokio::test]
async fn test_storage_jwks_cache_update() {
    let storage = SqliteBackend::in_memory().unwrap();

    storage.set_cached_jwks("https://example.com/jwks", "v1").await.unwrap();
    assert_eq!(storage.get_cached_jwks("https://example.com/jwks").await.unwrap(), Some("v1".to_string()));

    storage.set_cached_jwks("https://example.com/jwks", "v2").await.unwrap();
    assert_eq!(storage.get_cached_jwks("https://example.com/jwks").await.unwrap(), Some("v2".to_string()));
}

#[tokio::test]
async fn test_storage_jwks_cache_multiple_urls() {
    let storage = SqliteBackend::in_memory().unwrap();

    storage.set_cached_jwks("https://a.com/jwks", "keys-a").await.unwrap();
    storage.set_cached_jwks("https://b.com/jwks", "keys-b").await.unwrap();

    assert_eq!(storage.get_cached_jwks("https://a.com/jwks").await.unwrap(), Some("keys-a".to_string()));
    assert_eq!(storage.get_cached_jwks("https://b.com/jwks").await.unwrap(), Some("keys-b".to_string()));
    assert!(storage.get_cached_jwks("https://c.com/jwks").await.unwrap().is_none());
}
