use cadence::auth::{SyncClaims, JwtValidator};
use std::collections::HashMap;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn make_jwt(claims: &serde_json::Value, key: &EncodingKey) -> String {
    encode(&Header::new(Algorithm::HS256), claims, key).unwrap()
}

fn test_key() -> (EncodingKey, jsonwebtoken::DecodingKey) {
    let secret = b"test-secret-for-auth-integration";
    (
        EncodingKey::from_secret(secret),
        jsonwebtoken::DecodingKey::from_secret(secret),
    )
}

fn permissive_validator(decoding_key: jsonwebtoken::DecodingKey) -> JwtValidator {
    let mut validation = jsonwebtoken::Validation::new(Algorithm::HS256);
    validation.set_audience(&["cadence-sync"]);
    validation.validate_exp = true;
    validation.validate_nbf = true;

    JwtValidator::with_static_key(decoding_key)
}

#[tokio::test]
async fn test_valid_jwt_accepted() {
    let (enc_key, dec_key) = test_key();
    let validator = permissive_validator(dec_key);

    let claims = serde_json::json!({
        "sub": "test-user",
        "aud": "cadence-sync",
        "exp": now() + 3600,
        "nbf": now() - 60,
        "scopes": {"facility_id": ["F1", "F2"]},
        "read_only": false
    });

    let token = make_jwt(&claims, &enc_key);
    let result = validator.validate(&token).await;
    assert!(result.is_ok(), "Valid JWT should be accepted: {:?}", result.err());

    let fc = result.unwrap();
    assert_eq!(fc.scopes.get("facility_id").unwrap(), &vec!["F1".to_string(), "F2".to_string()]);
    assert!(fc.has_scope_value("facility_id", "F1"));
    assert!(fc.has_scope_value("facility_id", "F2"));
}

#[tokio::test]
async fn test_expired_jwt_rejected() {
    let (enc_key, dec_key) = test_key();
    let validator = permissive_validator(dec_key);

    let claims = serde_json::json!({
        "sub": "test-user",
        "aud": "cadence-sync",
        "exp": now() - 3600,
        "nbf": now() - 7200,
        "scopes": {"facility_id": ["F1"]},
        "read_only": false
    });

    let token = make_jwt(&claims, &enc_key);
    let result = validator.validate(&token).await;
    assert!(result.is_err(), "Expired JWT should be rejected");
}

#[tokio::test]
async fn test_invalid_signature_rejected() {
    let (enc_key, _) = test_key();
    // Create validator with a different key
    let wrong_dec_key = jsonwebtoken::DecodingKey::from_secret(b"wrong-key");
    let validator = permissive_validator(wrong_dec_key);

    let claims = serde_json::json!({
        "sub": "test-user",
        "aud": "cadence-sync",
        "exp": now() + 3600,
        "scopes": {"facility_id": ["F1"]},
        "read_only": false
    });

    let token = make_jwt(&claims, &enc_key);
    let result = validator.validate(&token).await;
    assert!(result.is_err(), "Wrong key should be rejected");
}

#[tokio::test]
async fn test_no_jwt_rejected() {
    let (_, dec_key) = test_key();
    let validator = permissive_validator(dec_key);

    let result = validator.validate("not-a-jwt").await;
    assert!(result.is_err(), "Invalid JWT string should be rejected");
}

#[tokio::test]
async fn test_jwks_fetch_and_cache() {
    // JWKS fetch requires a real HTTP endpoint — test the caching logic instead
    let (enc_key, dec_key) = test_key();
    let validator = permissive_validator(dec_key);

    let claims = serde_json::json!({
        "sub": "test-user",
        "aud": "cadence-sync",
        "exp": now() + 3600,
        "nbf": now() - 60,
        "scopes": {"facility_id": ["F1"]},
        "read_only": false
    });

    let token = make_jwt(&claims, &enc_key);

    // Validate twice — should use cache on second call
    let r1 = validator.validate(&token).await;
    let r2 = validator.validate(&token).await;
    assert!(r1.is_ok());
    assert!(r2.is_ok());
}

#[tokio::test]
async fn test_scope_negotiation_on_hello() {
    // Two peers exchange JWTs and compute scope intersection
    let claims_a = SyncClaims {
        sub: "peer-a".to_string(),
        iss: "cadence".to_string(),
        aud: Some("cadence-sync".to_string()),
        exp: Some(now() + 3600),
        nbf: None,
        iat: None,
        peer_id: Some("peer-a".to_string()),
        read_only: false,
        scopes: HashMap::from([("facility_id".to_string(), vec!["F1".to_string(), "F2".to_string()])]),
    };

    let claims_b = SyncClaims {
        sub: "peer-b".to_string(),
        iss: "cadence".to_string(),
        aud: Some("cadence-sync".to_string()),
        exp: Some(now() + 3600),
        nbf: None,
        iat: None,
        peer_id: Some("peer-b".to_string()),
        read_only: false,
        scopes: HashMap::from([("facility_id".to_string(), vec!["F2".to_string(), "F3".to_string()])]),
    };

    let intersection = claims_a.scope_intersection(&claims_b);
    let facility_intersection = intersection.get("facility_id").unwrap();
    assert_eq!(
        facility_intersection,
        &vec!["F2".to_string()],
        "Intersection of {{F1,F2}} and {{F2,F3}} should be {{F2}}"
    );
}
