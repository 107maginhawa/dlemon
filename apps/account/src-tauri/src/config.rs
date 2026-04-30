use std::path::PathBuf;

/// Application configuration resolved at startup.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AppConfig {
    pub data_dir: PathBuf,
    pub embedded_database_url: String,
    pub cadence_metadata_path: PathBuf,
}

impl AppConfig {
    /// Resolve application configuration.
    ///
    /// On desktop, uses `directories::ProjectDirs` for platform-appropriate data paths.
    /// On mobile, the caller passes `app.path().app_data_dir()` as `data_dir_override`.
    pub fn resolve(data_dir_override: Option<PathBuf>) -> Self {
        let data_dir = if let Some(dir) = data_dir_override {
            dir
        } else {
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            {
                directories::ProjectDirs::from("com", "monobase", "account")
                    .map(|d| d.data_dir().to_path_buf())
                    .unwrap_or_else(|| PathBuf::from("./data"))
            }
            #[cfg(any(target_os = "ios", target_os = "android"))]
            {
                PathBuf::from("./data")
            }
        };

        // Ensure data dir exists
        let _ = std::fs::create_dir_all(&data_dir);

        // Embedded backend database URL — override via EMBEDDED_DATABASE_URL env var
        // Default: embedded SQLite in the app data directory.
        let embedded_db_path = data_dir.join("account.db");
        let default_db_url = format!("sqlite://{}", embedded_db_path.display());
        let embedded_database_url = std::env::var("EMBEDDED_DATABASE_URL")
            .unwrap_or(default_db_url);

        Self {
            cadence_metadata_path: data_dir.join("cadence_metadata.db"),
            data_dir,
            embedded_database_url,
        }
    }
}
