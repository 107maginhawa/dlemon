//! Embedded api-ts runtime for offline-first applications.
//!
//! Provides `ApiTsEmbedded` — a self-contained api-ts backend that runs
//! entirely in-process with SQLite storage. Used by Tauri apps for
//! offline-first operation.

mod db;
mod engine;

use engine::{QuickJsEngine, JsEngine};

pub use engine::EngineTimings;

/// Response from an embedded api-ts request
#[derive(Debug, serde::Serialize)]
pub struct ApiTsResponse {
    pub status: u16,
    pub body: serde_json::Value,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub headers: Vec<(String, String)>,
    /// Console output captured during this request (for debugging)
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub logs: Vec<String>,
    /// Per-stage timing breakdown for this request (microseconds).
    pub timings: EngineTimings,
}

/// Embedded api-ts backend.
///
/// Runs the full api-ts API stack in-process with SQLite storage.
/// Thread-safe and can be shared across the application.
pub struct ApiTsEmbedded {
    engine: QuickJsEngine,
}

impl ApiTsEmbedded {
    /// Create a new embedded api-ts instance.
    ///
    /// # Arguments
    /// * `db_path` - Path to SQLite database file, or `:memory:` for in-memory
    ///
    /// # Example
    /// ```no_run
    /// use api_ts_embedded::ApiTsEmbedded;
    /// let api = ApiTsEmbedded::new("/path/to/db.sqlite").unwrap();
    /// ```
    pub fn new(db_path: &str) -> Result<Self, String> {
        let engine = QuickJsEngine::new(db_path)?;
        Ok(Self { engine })
    }

    /// Execute an HTTP-like request against the embedded api-ts.
    ///
    /// # Arguments
    /// * `method` - HTTP method (GET, POST, PUT, DELETE, etc.)
    /// * `path` - Request path (e.g., "/healthz", "/auth/sign-in/email")
    /// * `body` - Optional request body (JSON string)
    /// * `headers` - Request headers as key-value pairs
    ///
    /// # Example
    /// ```no_run
    /// use api_ts_embedded::ApiTsEmbedded;
    /// let api = ApiTsEmbedded::new(":memory:").unwrap();
    /// let response = api.request(
    ///     "POST",
    ///     "/auth/sign-in/email",
    ///     Some(r#"{"email":"user@test.com","password":"secret"}"#),
    ///     vec![("Content-Type", "application/json")],
    /// ).unwrap();
    /// ```
    pub fn request(
        &self,
        method: &str,
        path: &str,
        body: Option<&str>,
        headers: Vec<(&str, &str)>,
    ) -> Result<ApiTsResponse, String> {
        // Normalize path to full URL
        let url = if path.starts_with("http") {
            path.to_string()
        } else {
            format!("http://localhost{}", path)
        };

        let response = self.engine.handle_request(method, &url, body, headers)?;

        Ok(ApiTsResponse {
            status: response.status,
            body: response.body,
            headers: response.headers,
            logs: response.logs,
            timings: response.timings,
        })
    }
}
