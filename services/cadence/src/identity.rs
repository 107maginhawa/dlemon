//! Local identity management for persistent peer IDs.
//!
//! This module provides functions to load or create a persistent local identity
//! for a Cadence instance, ensuring the peer ID remains stable across restarts.

use anyhow::Result;
use iroh::SecretKey;
use std::str::FromStr;

use crate::storage::backend::{LocalIdentity, MetadataBackend};
use crate::transport::generate_secret_key;

impl LocalIdentity {
    /// Create a new identity with a random peer ID.
    ///
    /// If `with_iroh` is true, generates an Iroh secret key and derives the peer ID
    /// from the corresponding node ID. Otherwise, generates a random UUID.
    pub fn generate(with_iroh: bool) -> Self {
        let now = chrono::Utc::now().to_rfc3339();

        if with_iroh {
            let secret_key = generate_secret_key();
            let peer_id = secret_key.public().to_string();
            Self {
                peer_id,
                iroh_secret_key: Some(secret_key.to_string()),
                created_at: now,
            }
        } else {
            Self {
                peer_id: uuid::Uuid::new_v4().to_string(),
                iroh_secret_key: None,
                created_at: now,
            }
        }
    }

    /// Parse the stored Iroh secret key string back into a SecretKey.
    ///
    /// Returns None if no secret key is stored or if parsing fails.
    pub fn iroh_secret_key(&self) -> Option<SecretKey> {
        self.iroh_secret_key.as_ref().and_then(|s| {
            SecretKey::from_str(s).ok()
        })
    }
}

/// Load an existing identity from storage, or create and persist a new one.
///
/// This is the main entry point for identity management. It ensures that:
/// - If an identity already exists in storage, it is loaded and returned
/// - If no identity exists, a new one is generated and persisted
/// - The identity type (with/without Iroh key) matches the current mode
///
/// # Arguments
///
/// * `storage` - The metadata backend to load/store the identity
/// * `with_iroh` - Whether to generate an Iroh secret key (for P2P mode)
///
/// # Returns
///
/// The loaded or newly created LocalIdentity.
pub async fn load_or_create_identity(
    storage: &dyn MetadataBackend,
    with_iroh: bool,
) -> Result<LocalIdentity> {
    // Try to load existing identity
    if let Some(mut identity) = storage.get_local_identity().await? {
        // If we need Iroh but don't have a key, upgrade the identity
        if with_iroh && identity.iroh_secret_key.is_none() {
            tracing::info!(
                "Upgrading existing identity {} with Iroh secret key",
                identity.peer_id
            );
            let secret_key = generate_secret_key();
            identity.peer_id = secret_key.public().to_string();
            identity.iroh_secret_key = Some(secret_key.to_string());
            storage.set_local_identity(&identity).await?;
            tracing::info!("Upgraded peer identity: {}", identity.peer_id);
        } else {
            tracing::info!("Loaded persistent peer identity: {}", identity.peer_id);
        }
        return Ok(identity);
    }

    // Generate new identity
    let identity = LocalIdentity::generate(with_iroh);
    storage.set_local_identity(&identity).await?;
    tracing::info!("Generated new peer identity: {}", identity.peer_id);

    Ok(identity)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::SqliteBackend;

    #[tokio::test]
    async fn test_generate_identity_with_iroh() {
        let identity = LocalIdentity::generate(true);
        assert!(!identity.peer_id.is_empty());
        assert!(identity.iroh_secret_key.is_some());

        // Verify we can parse the secret key back
        let secret_key = identity.iroh_secret_key().unwrap();
        assert_eq!(secret_key.public().to_string(), identity.peer_id);
    }

    #[tokio::test]
    async fn test_generate_identity_without_iroh() {
        let identity = LocalIdentity::generate(false);
        assert!(!identity.peer_id.is_empty());
        assert!(identity.iroh_secret_key.is_none());

        // Peer ID should be a valid UUID
        assert!(uuid::Uuid::parse_str(&identity.peer_id).is_ok());
    }

    #[tokio::test]
    async fn test_load_or_create_persistence() {
        let storage = SqliteBackend::in_memory().unwrap();

        // First call creates new identity
        let identity1 = load_or_create_identity(&storage, true).await.unwrap();
        assert!(!identity1.peer_id.is_empty());

        // Second call loads the same identity
        let identity2 = load_or_create_identity(&storage, true).await.unwrap();
        assert_eq!(identity1.peer_id, identity2.peer_id);
        assert_eq!(identity1.iroh_secret_key, identity2.iroh_secret_key);
    }

    #[tokio::test]
    async fn test_upgrade_identity_to_iroh() {
        let storage = SqliteBackend::in_memory().unwrap();

        // Create identity without Iroh
        let identity1 = load_or_create_identity(&storage, false).await.unwrap();
        assert!(identity1.iroh_secret_key.is_none());

        // Upgrade to Iroh mode
        let identity2 = load_or_create_identity(&storage, true).await.unwrap();
        assert!(identity2.iroh_secret_key.is_some());

        // Peer ID changes when upgrading (now derived from Iroh key)
        assert_ne!(identity1.peer_id, identity2.peer_id);
    }
}
