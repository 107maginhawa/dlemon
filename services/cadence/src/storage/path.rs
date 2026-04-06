use std::path::PathBuf;

use sha2::{Digest, Sha256};

use crate::config::CadenceConfig;

/// Get the default data directory for Cadence metadata.
///
/// Priority:
/// 1. `CADENCE_DATA_DIR` env var (for embedded/mobile/Tauri)
/// 2. `data_dir` from config
/// 3. Platform default via `dirs::data_local_dir()` + "cadence"
pub fn default_data_dir(config: &CadenceConfig) -> PathBuf {
    if let Ok(env_dir) = std::env::var("CADENCE_DATA_DIR") {
        return PathBuf::from(env_dir);
    }

    if let Some(ref dir) = config.data_dir {
        return PathBuf::from(dir);
    }

    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("cadence")
}

/// Compute a 16-hex-char SHA256 hash of a primary DB URL.
///
/// Used by both SQLite (for filename) and Valkey (for key prefix) backends
/// to scope metadata to a specific primary database.
pub fn db_url_hash(primary_db_url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(primary_db_url.as_bytes());
    let hash = hasher.finalize();
    hash.iter().take(8).map(|b| format!("{:02x}", b)).collect()
}

/// Generate a deterministic metadata DB filename from a primary DB URL.
///
/// Uses SHA256 hash, first 16 hex chars: `cadence-meta-{hash}.db`
pub fn metadata_db_filename(primary_db_url: &str) -> String {
    format!("cadence-meta-{}.db", db_url_hash(primary_db_url))
}

/// Resolve the full path to the metadata DB file.
///
/// If `metadata_db_path` is explicitly set (not the old default "cadence_metadata.db"),
/// use it directly. Otherwise, use hash-based naming in `default_data_dir()`.
pub fn resolve_metadata_db_path(config: &CadenceConfig) -> PathBuf {
    // If explicitly overridden to something other than the old default, use it directly
    if config.metadata_db_path != "cadence_metadata.db" {
        return PathBuf::from(&config.metadata_db_path);
    }

    let dir = default_data_dir(config);
    let filename = metadata_db_filename(&config.primary_db_url);
    dir.join(filename)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metadata_db_filename_deterministic() {
        let url = "postgresql://localhost/clinic_a";
        let f1 = metadata_db_filename(url);
        let f2 = metadata_db_filename(url);
        assert_eq!(f1, f2);
        assert!(f1.starts_with("cadence-meta-"));
        assert!(f1.ends_with(".db"));
    }

    #[test]
    fn test_different_urls_produce_different_filenames() {
        let f1 = metadata_db_filename("postgresql://localhost/clinic_a");
        let f2 = metadata_db_filename("postgresql://localhost/clinic_b");
        assert_ne!(f1, f2);
    }

    #[test]
    fn test_filename_length() {
        let f = metadata_db_filename("postgresql://localhost/test");
        // "cadence-meta-" (13) + 16 hex chars + ".db" (3) = 32
        assert_eq!(f.len(), 32);
    }

    #[test]
    fn test_resolve_with_explicit_override() {
        let mut config = CadenceConfig::default();
        config.primary_db_url = "postgresql://localhost/test".to_string();
        config.metadata_db_path = "/custom/path/my.db".to_string();

        let path = resolve_metadata_db_path(&config);
        assert_eq!(path, PathBuf::from("/custom/path/my.db"));
    }

    #[test]
    fn test_resolve_with_default_uses_hash() {
        let mut config = CadenceConfig::default();
        config.primary_db_url = "postgresql://localhost/test".to_string();
        // metadata_db_path is the default "cadence_metadata.db"

        let path = resolve_metadata_db_path(&config);
        let filename = path.file_name().unwrap().to_str().unwrap();
        assert!(filename.starts_with("cadence-meta-"));
        assert!(filename.ends_with(".db"));
    }

    #[test]
    fn test_resolve_with_data_dir_config() {
        let mut config = CadenceConfig::default();
        config.primary_db_url = "postgresql://localhost/test".to_string();
        config.data_dir = Some("/my/data".to_string());

        let path = resolve_metadata_db_path(&config);
        assert!(path.starts_with("/my/data"));
    }
}
