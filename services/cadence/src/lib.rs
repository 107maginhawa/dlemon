pub mod applier;
pub mod utils;
pub mod auth;
pub mod config;
pub mod conn;
pub mod api;
pub mod identity;
pub mod merge;
pub mod peer_status;
pub mod primary_reader;
pub mod protocol;
pub mod runtime;
pub mod schema;
pub mod state;
pub mod storage;
pub mod stream;
pub mod sync;
pub mod token;
pub mod transport;
pub mod watcher;
pub mod ws;

/// Convenience macro for building `BTreeMap<String, String>` for scope_columns.
///
/// # Example
///
/// ```
/// use cadence::scope_columns;
///
/// let cols = scope_columns! {
///     "user" => "id",
///     "organization" => "facility",
/// };
/// assert_eq!(cols.get("user"), Some(&"id".to_string()));
/// ```
#[macro_export]
macro_rules! scope_columns {
    ($($dim:expr => $col:expr),* $(,)?) => {{
        let mut map = std::collections::BTreeMap::new();
        $(map.insert($dim.to_string(), $col.to_string());)*
        map
    }};
}
