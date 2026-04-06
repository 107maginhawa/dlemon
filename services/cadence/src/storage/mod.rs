pub mod backend;
mod common;
pub mod path;
mod sqlite;
mod valkey;

pub use backend::{CatchupCheckpoint, LocalIdentity, MetadataBackend};
pub use sqlite::SqliteBackend;
pub use valkey::ValkeyBackend;

/// Backward-compatible type alias. Prefer `SqliteBackend` in new code.
pub type Storage = SqliteBackend;
