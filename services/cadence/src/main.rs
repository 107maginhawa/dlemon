use anyhow::{Context, Result};
use clap::Parser;
use std::path::PathBuf;

use cadence::config::CadenceConfig;
use cadence::runtime::Cadence;

#[derive(Parser, Debug)]
#[command(name = "cadence", about = "P2P sync engine for healthcare data")]
struct Cli {
    /// Path to the configuration YAML file.
    #[arg(short, long, default_value = "cadence.yml")]
    config: PathBuf,

    /// Override the metadata database path.
    #[arg(long)]
    metadata_db: Option<PathBuf>,

    /// Override the primary database URL.
    #[arg(long)]
    primary_db: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();

    // Load config
    let mut config = if cli.config.exists() {
        CadenceConfig::from_yaml_file(&cli.config)
            .context(format!("Failed to load config from {:?}", cli.config))?
    } else {
        tracing::warn!("Config file {:?} not found, using defaults", cli.config);
        CadenceConfig::default()
    };

    // Apply CLI overrides
    if let Some(metadata_db) = cli.metadata_db {
        config.metadata_db_path = metadata_db.to_string_lossy().to_string();
    }
    if let Some(primary_db) = cli.primary_db {
        config.primary_db_url = primary_db;
    }

    // Validate required config
    if config.primary_db_url.is_empty() {
        anyhow::bail!(
            "primary_db_url is required. Set it in the config file, via --primary-db, \
             or CADENCE_PRIMARY_DB_URL environment variable."
        );
    }

    // Build cadence with all components, then spawn background sync tasks.
    // Note: P2P endpoint is created internally using persistent identity from metadata DB
    let mut cadence = Cadence::builder()
        .config(config)
        .apply_env_overrides()
        // The standalone daemon always wants full sync, so it always needs
        // wildcard expansion. This is the explicit step that connects to the
        // primary DB.
        .resolve_wildcards()
        .await?
        .build()
        .await?;
    cadence.start_sync().await?;

    // Start API server if enabled (includes WS sync endpoint when ws_enabled is true)
    if cadence.config().api_server.enabled {
        let api_config = cadence.config().clone();
        let api_state = cadence.state().clone();
        let api_engine = cadence.sync_engine().clone();
        let api_tracker = cadence.peer_tracker().clone();
        let api_broadcaster = cadence.broadcaster().clone();
        tokio::spawn(async move {
            if let Err(e) = cadence::api::start_api_server(
                api_config,
                api_state,
                api_engine,
                api_tracker,
                api_broadcaster,
            )
            .await
            {
                tracing::error!("API server error: {}", e);
            }
        });
    }

    tracing::info!("Cadence v2 ready. Waiting for connections...");

    if cadence.iroh_endpoint().is_some() {
        // Accept incoming QUIC connections (blocking)
        cadence.accept_loop().await
    } else {
        // No P2P transport — wait for shutdown signal
        tokio::signal::ctrl_c().await?;
        tracing::info!("Shutdown signal received");
        Ok(())
    }
}
