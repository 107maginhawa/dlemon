use anyhow::Result;
use loro::{ExportMode, LoroDoc};

/// Wrapper around LoroDoc for CRDT operations.
pub struct CrdtEngine {
    doc: LoroDoc,
}

impl CrdtEngine {
    /// Create a new empty CRDT document.
    pub fn new() -> Self {
        Self {
            doc: LoroDoc::new(),
        }
    }

    /// Create from existing document bytes (snapshot).
    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        let doc = LoroDoc::new();
        doc.import(bytes)?;
        Ok(Self { doc })
    }

    /// Import remote changes into this document.
    pub fn import(&self, bytes: &[u8]) -> Result<()> {
        self.doc.import(bytes)?;
        Ok(())
    }

    /// Export all updates as bytes.
    pub fn export_all(&self) -> Result<Vec<u8>> {
        let bytes = self.doc.export(ExportMode::all_updates())?;
        Ok(bytes)
    }

    /// Export incremental updates since a given version.
    pub fn export_since(&self, version: &loro::VersionVector) -> Result<Vec<u8>> {
        let bytes = self.doc.export(ExportMode::updates(version))?;
        Ok(bytes)
    }

    /// Get the current version vector.
    pub fn version(&self) -> loro::VersionVector {
        self.doc.oplog_vv()
    }

    /// Get a reference to the underlying LoroDoc.
    pub fn doc(&self) -> &LoroDoc {
        &self.doc
    }

    /// Get the full document state as a JSON value.
    pub fn get_deep_value(&self) -> serde_json::Value {
        let loro_value = self.doc.get_deep_value();
        // Convert LoroValue to serde_json::Value
        serde_json::to_value(&loro_value).unwrap_or(serde_json::Value::Null)
    }
}

impl Default for CrdtEngine {
    fn default() -> Self {
        Self::new()
    }
}
