use anyhow::{Context, Result};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::auth::{JwtValidator, SyncClaims};
use crate::config::CadenceConfig;
use crate::storage::MetadataBackend;

/// Runtime token store for managing the peer's JWT credential.
///
/// Thread-safe: uses `tokio::sync::RwLock` for async-compatible locking.
/// Persists tokens to the metadata DB so they survive restarts.
pub struct TokenStore {
    token: RwLock<Option<String>>,
    claims: RwLock<Option<SyncClaims>>,
    storage: Arc<dyn MetadataBackend>,
    validator: Arc<JwtValidator>,
}

impl TokenStore {
    pub fn new(storage: Arc<dyn MetadataBackend>, validator: Arc<JwtValidator>) -> Self {
        Self {
            token: RwLock::new(None),
            claims: RwLock::new(None),
            storage,
            validator,
        }
    }

    /// Set a new JWT token. Validates it against JWKS, persists to storage,
    /// and updates in-memory state.
    pub async fn set_token(&self, jwt: String) -> Result<SyncClaims> {
        let claims = self.validator.validate(&jwt).await
            .context("Token validation failed")?;

        self.storage.set_peer_token("default", &jwt).await?;

        *self.token.write().await = Some(jwt);
        *self.claims.write().await = Some(claims.clone());

        Ok(claims)
    }

    /// Get the current JWT string.
    pub async fn token(&self) -> Option<String> {
        self.token.read().await.clone()
    }

    /// Get the current parsed claims.
    pub async fn claims(&self) -> Option<SyncClaims> {
        self.claims.read().await.clone()
    }

    /// Clear the current token. Deletes the persisted row from the metadata
    /// DB so a subsequent `load_from_storage()` does not resurrect it.
    pub async fn clear(&self) -> Result<()> {
        self.storage.delete_peer_token("default").await?;
        *self.token.write().await = None;
        *self.claims.write().await = None;
        Ok(())
    }

    /// Load a persisted token from the metadata DB.
    /// Re-validates the token (rejects expired tokens).
    pub async fn load_from_storage(&self) -> Result<bool> {
        if let Some(jwt) = self.storage.get_peer_token("default").await? {
            match self.validator.validate(&jwt).await {
                Ok(claims) => {
                    *self.token.write().await = Some(jwt);
                    *self.claims.write().await = Some(claims);
                    Ok(true)
                }
                Err(e) => {
                    tracing::warn!("Persisted token is invalid, ignoring: {}", e);
                    Ok(false)
                }
            }
        } else {
            Ok(false)
        }
    }

    /// Load token from config `peer_token` field.
    /// Validates against JWKS before accepting.
    pub async fn load_from_config(&self, config: &CadenceConfig) -> Result<bool> {
        if let Some(ref jwt) = config.peer_token {
            self.set_token(jwt.clone()).await?;
            return Ok(true);
        }

        Ok(false)
    }
}
