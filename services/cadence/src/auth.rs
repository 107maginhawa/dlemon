use anyhow::{Context, Result};
use dashmap::DashMap;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Arc;

use crate::storage::MetadataBackend;

/// JWT claims for generic scope-based sync.
///
/// Supports any number of scope dimensions (e.g., organization, workspace, user).
/// Each dimension maps to a list of allowed values, where `["*"]` is a wildcard.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncClaims {
    /// Standard JWT claims
    #[serde(default)]
    pub sub: String,
    #[serde(default)]
    pub iss: String,
    #[serde(default)]
    pub aud: Option<String>,
    #[serde(default)]
    pub exp: Option<u64>,
    #[serde(default)]
    pub nbf: Option<u64>,
    #[serde(default)]
    pub iat: Option<u64>,

    /// Peer ID (device identifier).
    #[serde(default)]
    pub peer_id: Option<String>,

    /// Whether this token is read-only.
    #[serde(default)]
    pub read_only: bool,

    /// Generic scope map: dimension -> allowed values.
    /// `["*"]` = wildcard (matches all values for that dimension).
    #[serde(default)]
    pub scopes: HashMap<String, Vec<String>>,
}

impl SyncClaims {
    /// Get allowed values for a scope dimension.
    pub fn scope_values(&self, dim: &str) -> Option<&Vec<String>> {
        self.scopes.get(dim)
    }

    /// Check if a specific value is allowed for a dimension.
    /// Returns true if the dimension has a wildcard `["*"]` or contains the value.
    pub fn has_scope_value(&self, dim: &str, val: &str) -> bool {
        match self.scopes.get(dim) {
            Some(vals) => vals.iter().any(|v| v == "*") || vals.iter().any(|v| v == val),
            None => false,
        }
    }

    /// Check if a dimension has the wildcard grant.
    pub fn is_wildcard(&self, dim: &str) -> bool {
        match self.scopes.get(dim) {
            Some(vals) => vals.iter().any(|v| v == "*"),
            None => false,
        }
    }

    /// Check if this token can write (not read-only).
    pub fn can_write(&self) -> bool {
        !self.read_only
    }

    /// Compute the intersection of scopes between two peers, per dimension.
    /// - wildcard x wildcard = wildcard
    /// - wildcard x specific = specific
    /// - specific x specific = set intersection
    /// Only dimensions present in both peers are included.
    pub fn scope_intersection(&self, other: &SyncClaims) -> HashMap<String, Vec<String>> {
        let mut result = HashMap::new();
        let all_dims: HashSet<&String> = self.scopes.keys().chain(other.scopes.keys()).collect();

        for dim in all_dims {
            let a = self.scopes.get(dim.as_str());
            let b = other.scopes.get(dim.as_str());

            match (a, b) {
                (Some(a_vals), Some(b_vals)) => {
                    let a_wild = a_vals.iter().any(|v| v == "*");
                    let b_wild = b_vals.iter().any(|v| v == "*");

                    let intersected = if a_wild && b_wild {
                        vec!["*".to_string()]
                    } else if a_wild {
                        b_vals.clone()
                    } else if b_wild {
                        a_vals.clone()
                    } else {
                        let a_set: HashSet<&String> = a_vals.iter().collect();
                        let b_set: HashSet<&String> = b_vals.iter().collect();
                        a_set.intersection(&b_set).map(|v| (*v).clone()).collect()
                    };

                    if !intersected.is_empty() {
                        result.insert(dim.clone(), intersected);
                    }
                }
                // Dimension only in one peer — no intersection
                _ => {}
            }
        }

        result
    }

    /// Check if a row passes scope checks (OR logic).
    ///
    /// `scope_columns` maps scope dimension names to DB column names.
    /// `row_fields` maps DB column names to their values in the row.
    ///
    /// For each configured dimension, checks if the peer's grant covers the row's value.
    /// If ANY dimension passes, the row is in scope (OR logic).
    /// If no dimensions are configured, the row is always in scope.
    pub fn row_in_scope(
        &self,
        scope_columns: &BTreeMap<String, String>,
        row_fields: &HashMap<String, String>,
    ) -> bool {
        if scope_columns.is_empty() {
            return true; // No scoping configured
        }

        scope_columns.iter().any(|(scope_name, col_name)| {
            match self.scopes.get(scope_name) {
                None => false, // Peer has no grant for this dimension
                Some(vals) if vals.iter().any(|v| v == "*") => true, // Wildcard
                Some(vals) => {
                    match row_fields.get(col_name) {
                        Some(row_val) => vals.iter().any(|v| v == row_val),
                        None => false, // Row missing the scope column
                    }
                }
            }
        })
    }
}

/// Cached JWKS key entry.
struct CachedKey {
    decoding_key: DecodingKey,
}

/// JWT validator with JWKS support and offline caching.
///
/// In production, validates JWTs against keys fetched from a remote JWKS endpoint.
/// Fetched keys are cached in-memory (DashMap) and persisted to the metadata DB
/// so validation continues working when the JWKS endpoint is unreachable (offline).
pub struct JwtValidator {
    jwks_urls: Vec<String>,
    key_cache: Arc<DashMap<String, CachedKey>>,
    /// For testing or embedded use: a static decoding key (HS256).
    static_key: Option<DecodingKey>,
    validation: Validation,
    /// Storage for persisting JWKS keys (offline cache).
    storage: Option<Arc<dyn MetadataBackend>>,
}

impl JwtValidator {
    /// Create a production validator that fetches keys from one or more JWKS URLs.
    /// Requires storage for offline JWKS caching.
    pub fn new(jwks_urls: Vec<String>, storage: Arc<dyn MetadataBackend>) -> Self {
        let mut validation = Validation::new(Algorithm::ES256);
        validation.set_audience(&["cadence-sync"]);
        validation.validate_exp = true;
        validation.validate_nbf = true;

        Self {
            jwks_urls,
            key_cache: Arc::new(DashMap::new()),
            static_key: None,
            validation,
            storage: Some(storage),
        }
    }

    /// Create a validator with a static HS256 key.
    /// Used by embedded consumers (e.g., cadence-demo) where peers share a secret.
    pub fn with_static_key(key: DecodingKey) -> Self {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_audience(&["cadence-sync"]);
        validation.validate_exp = true;
        validation.validate_nbf = true;

        Self {
            jwks_urls: Vec::new(),
            key_cache: Arc::new(DashMap::new()),
            static_key: Some(key),
            validation,
            storage: None,
        }
    }

    /// Create a permissive validator for testing (no expiry/audience checks).
    /// Not for production use — `main.rs` requires `jwks_url` and uses `new()`.
    pub fn permissive(key: DecodingKey) -> Self {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false;
        validation.validate_nbf = false;
        validation.set_audience(&["cadence-sync"]);
        validation.required_spec_claims = HashSet::new();

        Self {
            jwks_urls: Vec::new(),
            key_cache: Arc::new(DashMap::new()),
            static_key: Some(key),
            validation,
            storage: None,
        }
    }

    /// Create a validator that skips signature verification entirely.
    /// Decodes JWT claims without checking the signature.
    /// For development/demo use only — NOT for production.
    pub fn no_verify() -> Self {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false;
        validation.validate_nbf = false;
        validation.required_spec_claims = HashSet::new();
        validation.validate_aud = false;
        validation.insecure_disable_signature_validation();

        Self {
            jwks_urls: Vec::new(),
            key_cache: Arc::new(DashMap::new()),
            static_key: Some(DecodingKey::from_secret(b"")),
            validation,
            storage: None,
        }
    }

    /// Validate a JWT and extract sync claims.
    pub async fn validate(&self, token: &str) -> Result<SyncClaims> {
        let key = if let Some(ref static_key) = self.static_key {
            static_key.clone()
        } else {
            self.get_key_for_token(token).await?
        };

        let token_data = decode::<SyncClaims>(token, &key, &self.validation)
            .context("JWT validation failed")?;

        Ok(token_data.claims)
    }

    /// Fetch the appropriate key for a token from JWKS.
    /// Tries each configured JWKS URL until the key is found.
    /// Falls back to disk-cached keys when all JWKS endpoints are unreachable.
    async fn get_key_for_token(&self, token: &str) -> Result<DecodingKey> {
        let header = jsonwebtoken::decode_header(token).context("Failed to decode JWT header")?;

        let kid = header
            .kid
            .context("JWT header missing 'kid' field")?;

        // Check in-memory cache first (keys from all endpoints share one cache, keyed by kid)
        if let Some(cached) = self.key_cache.get(&kid) {
            return Ok(cached.decoding_key.clone());
        }

        if self.jwks_urls.is_empty() {
            anyhow::bail!("No JWKS URLs configured");
        }

        // Try fetching from each remote JWKS endpoint until kid is found
        let mut last_fetch_err = None;
        for jwks_url in &self.jwks_urls {
            match self.fetch_jwks(jwks_url).await {
                Ok(jwks) => {
                    // Persist to disk cache for offline use
                    if let Some(ref storage) = self.storage {
                        if let Ok(json) = serde_json::to_string(&jwks) {
                            if let Err(e) = storage.set_cached_jwks(jwks_url, &json).await {
                                tracing::warn!("Failed to cache JWKS to disk: {}", e);
                            }
                        }
                    }

                    self.populate_key_cache(&jwks);
                    if let Ok(key) = self.find_cached_key(&kid) {
                        return Ok(key);
                    }
                    // kid not in this endpoint, try the next one
                }
                Err(e) => {
                    tracing::warn!("JWKS fetch from {} failed: {}", jwks_url, e);
                    last_fetch_err = Some(e);
                }
            }
        }

        // Fall back to disk-cached JWKS from all endpoints
        if let Some(ref storage) = self.storage {
            for jwks_url in &self.jwks_urls {
                if let Ok(Some(json)) = storage.get_cached_jwks(jwks_url).await {
                    if let Ok(jwks) = serde_json::from_str::<JwksResponse>(&json) {
                        tracing::info!("Using disk-cached JWKS keys from {} (offline mode)", jwks_url);
                        self.populate_key_cache(&jwks);
                        if let Ok(key) = self.find_cached_key(&kid) {
                            return Ok(key);
                        }
                    }
                }
            }
        }

        match last_fetch_err {
            Some(e) => Err(e).context(format!("Key with kid '{}' not found in any JWKS endpoint", kid)),
            None => anyhow::bail!("Key with kid '{}' not found in any JWKS endpoint", kid),
        }
    }

    /// Populate the in-memory key cache from a JWKS response.
    fn populate_key_cache(&self, jwks: &JwksResponse) {
        for key in &jwks.keys {
            if let Some(ref kid) = key.kid {
                if let Ok(decoding_key) = Self::jwk_to_decoding_key(key) {
                    self.key_cache.insert(
                        kid.clone(),
                        CachedKey {
                            decoding_key,
                        },
                    );
                }
            }
        }
    }

    /// Look up a key by kid in the in-memory cache.
    fn find_cached_key(&self, kid: &str) -> Result<DecodingKey> {
        self.key_cache
            .get(kid)
            .map(|entry| entry.decoding_key.clone())
            .context(format!("Key with kid '{}' not found in JWKS", kid))
    }

    async fn fetch_jwks(&self, url: &str) -> Result<JwksResponse> {
        let resp = reqwest::get(url)
            .await
            .context("Failed to fetch JWKS")?
            .json::<JwksResponse>()
            .await
            .context("Failed to parse JWKS response")?;
        Ok(resp)
    }

    fn jwk_to_decoding_key(jwk: &JwkKey) -> Result<DecodingKey> {
        match jwk.kty.as_str() {
            "EC" => {
                let x = jwk.x.as_ref().context("EC key missing 'x'")?;
                let y = jwk.y.as_ref().context("EC key missing 'y'")?;
                DecodingKey::from_ec_components(x, y)
                    .context("Failed to create DecodingKey from EC components")
            }
            other => anyhow::bail!("Unsupported key type: {}", other),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct JwksResponse {
    keys: Vec<JwkKey>,
}

#[derive(Debug, Serialize, Deserialize)]
struct JwkKey {
    kty: String,
    kid: Option<String>,
    x: Option<String>,
    y: Option<String>,
    #[serde(default)]
    crv: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a JwksResponse with real EC keys for testing.
    /// Uses the P-256 test vectors from RFC 7517 Appendix B.
    fn make_test_jwks() -> JwksResponse {
        JwksResponse {
            keys: vec![JwkKey {
                kty: "EC".to_string(),
                kid: Some("test-key-1".to_string()),
                // Valid P-256 point (from a throwaway keypair, safe for tests)
                x: Some("f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU".to_string()),
                y: Some("x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0".to_string()),
                crv: Some("P-256".to_string()),
            }],
        }
    }

    #[test]
    fn test_jwks_response_serde_roundtrip() {
        let jwks = make_test_jwks();
        let json = serde_json::to_string(&jwks).unwrap();
        let parsed: JwksResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.keys.len(), 1);
        assert_eq!(parsed.keys[0].kid.as_deref(), Some("test-key-1"));
        assert_eq!(parsed.keys[0].kty, "EC");
        assert!(parsed.keys[0].x.is_some());
        assert!(parsed.keys[0].y.is_some());
    }

    #[test]
    fn test_jwks_response_deserialize_from_real_format() {
        // Simulates what a real JWKS endpoint returns
        let json = r#"{
            "keys": [
                {
                    "kty": "EC",
                    "kid": "key-abc",
                    "crv": "P-256",
                    "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
                    "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
                },
                {
                    "kty": "EC",
                    "kid": "key-def",
                    "crv": "P-256",
                    "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
                    "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
                }
            ]
        }"#;
        let jwks: JwksResponse = serde_json::from_str(json).unwrap();
        assert_eq!(jwks.keys.len(), 2);
        assert_eq!(jwks.keys[0].kid.as_deref(), Some("key-abc"));
        assert_eq!(jwks.keys[1].kid.as_deref(), Some("key-def"));
    }

    #[test]
    fn test_populate_key_cache_and_find() {
        let validator = JwtValidator::with_static_key(
            DecodingKey::from_secret(b"unused"),
        );
        let jwks = make_test_jwks();

        assert!(validator.key_cache.is_empty());

        validator.populate_key_cache(&jwks);

        assert_eq!(validator.key_cache.len(), 1);
        assert!(validator.find_cached_key("test-key-1").is_ok());
        assert!(validator.find_cached_key("nonexistent").is_err());
    }

    #[test]
    fn test_populate_key_cache_multiple_keys() {
        let validator = JwtValidator::with_static_key(
            DecodingKey::from_secret(b"unused"),
        );
        let jwks = JwksResponse {
            keys: vec![
                JwkKey {
                    kty: "EC".to_string(),
                    kid: Some("key-a".to_string()),
                    x: Some("f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU".to_string()),
                    y: Some("x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0".to_string()),
                    crv: Some("P-256".to_string()),
                },
                JwkKey {
                    kty: "EC".to_string(),
                    kid: Some("key-b".to_string()),
                    x: Some("f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU".to_string()),
                    y: Some("x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0".to_string()),
                    crv: Some("P-256".to_string()),
                },
            ],
        };

        validator.populate_key_cache(&jwks);

        assert_eq!(validator.key_cache.len(), 2);
        assert!(validator.find_cached_key("key-a").is_ok());
        assert!(validator.find_cached_key("key-b").is_ok());
    }

    #[test]
    fn test_populate_key_cache_skips_keys_without_kid() {
        let validator = JwtValidator::with_static_key(
            DecodingKey::from_secret(b"unused"),
        );
        let jwks = JwksResponse {
            keys: vec![JwkKey {
                kty: "EC".to_string(),
                kid: None, // No kid
                x: Some("f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU".to_string()),
                y: Some("x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0".to_string()),
                crv: Some("P-256".to_string()),
            }],
        };

        validator.populate_key_cache(&jwks);
        assert!(validator.key_cache.is_empty());
    }

    #[test]
    fn test_populate_key_cache_skips_unsupported_key_type() {
        let validator = JwtValidator::with_static_key(
            DecodingKey::from_secret(b"unused"),
        );
        let jwks = JwksResponse {
            keys: vec![JwkKey {
                kty: "RSA".to_string(), // Unsupported
                kid: Some("rsa-key".to_string()),
                x: None,
                y: None,
                crv: None,
            }],
        };

        validator.populate_key_cache(&jwks);
        assert!(validator.key_cache.is_empty());
    }

    #[test]
    fn test_jwk_to_decoding_key_ec() {
        let jwk = JwkKey {
            kty: "EC".to_string(),
            kid: Some("test".to_string()),
            x: Some("f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU".to_string()),
            y: Some("x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0".to_string()),
            crv: Some("P-256".to_string()),
        };
        assert!(JwtValidator::jwk_to_decoding_key(&jwk).is_ok());
    }

    #[test]
    fn test_jwk_to_decoding_key_missing_components() {
        let jwk = JwkKey {
            kty: "EC".to_string(),
            kid: Some("test".to_string()),
            x: Some("f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU".to_string()),
            y: None, // Missing y
            crv: Some("P-256".to_string()),
        };
        assert!(JwtValidator::jwk_to_decoding_key(&jwk).is_err());
    }

    #[test]
    fn test_jwk_to_decoding_key_unsupported_type() {
        let jwk = JwkKey {
            kty: "RSA".to_string(),
            kid: Some("test".to_string()),
            x: None,
            y: None,
            crv: None,
        };
        assert!(JwtValidator::jwk_to_decoding_key(&jwk).is_err());
    }

    #[test]
    fn test_jwks_disk_cache_roundtrip_with_populate() {
        // Simulate: serialize JWKS → store to disk → deserialize → populate cache
        let jwks = make_test_jwks();
        let json = serde_json::to_string(&jwks).unwrap();

        // Simulate disk storage roundtrip
        let restored: JwksResponse = serde_json::from_str(&json).unwrap();

        let validator = JwtValidator::with_static_key(
            DecodingKey::from_secret(b"unused"),
        );
        validator.populate_key_cache(&restored);

        assert_eq!(validator.key_cache.len(), 1);
        assert!(validator.find_cached_key("test-key-1").is_ok());
    }
}
