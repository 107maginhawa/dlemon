pub mod crdt;
pub mod lww;

use crate::config::{CadenceConfig, ConflictStrategy};
use crate::state::{FieldChange, RowChange, SyncPayload};

/// Routes merge operations to the correct strategy based on collection config.
pub struct MergeRouter<'a> {
    config: &'a CadenceConfig,
}

impl<'a> MergeRouter<'a> {
    pub fn new(config: &'a CadenceConfig) -> Self {
        Self { config }
    }

    /// Merge a remote RowChange with local state.
    /// Returns the merged field changes for LWW, or performs CRDT import.
    pub fn merge(
        &self,
        remote: &RowChange,
        local_fields: &[FieldChange],
    ) -> MergeResult {
        let strategy = self.config.strategy_for(&remote.collection);
        match strategy {
            ConflictStrategy::Lww => {
                let remote_fields = match &remote.payload {
                    SyncPayload::Fields(fields) => fields,
                    SyncPayload::CrdtDoc(_) => return MergeResult::Error("LWW collection received CRDT payload".to_string()),
                };
                let merged = lww::lww_merge_row(local_fields, remote_fields);
                MergeResult::Lww(merged)
            }
            ConflictStrategy::Crdt => {
                match &remote.payload {
                    SyncPayload::CrdtDoc(bytes) => MergeResult::Crdt(bytes.clone()),
                    SyncPayload::Fields(_) => MergeResult::Error("CRDT collection received Fields payload".to_string()),
                }
            }
        }
    }

    /// Get the strategy for a collection.
    pub fn strategy_for(&self, collection: &str) -> ConflictStrategy {
        self.config.strategy_for(collection)
    }
}

/// Result of a merge operation.
#[derive(Debug, Clone, PartialEq)]
pub enum MergeResult {
    /// LWW merge produced these field changes.
    Lww(Vec<FieldChange>),
    /// CRDT bytes to import into LoroDoc.
    Crdt(Vec<u8>),
    /// Error during merge.
    Error(String),
}
