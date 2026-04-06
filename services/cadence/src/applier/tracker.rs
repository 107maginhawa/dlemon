use dashmap::DashMap;
use std::sync::Arc;

/// Tracks which documents were recently written by the applier (from peer sync),
/// along with the originating peer_id. This allows the primary DB watcher to
/// re-tag detected changes with the correct origin, enabling echo suppression
/// in the send loop.
///
/// Uses one-shot semantics: `take_origin()` removes the entry so subsequent
/// watcher detections (from local app writes) are correctly tagged as local.
#[derive(Clone)]
pub struct ApplierTracker {
    /// Maps (collection, doc_id) → origin peer_id
    writes: Arc<DashMap<(String, String), String>>,
}

impl ApplierTracker {
    pub fn new() -> Self {
        Self {
            writes: Arc::new(DashMap::new()),
        }
    }

    /// Mark a document as written by the applier, with its origin peer_id.
    pub fn mark_written(&self, collection: &str, doc_id: &str, origin_peer_id: &str) {
        self.writes.insert(
            (collection.to_string(), doc_id.to_string()),
            origin_peer_id.to_string(),
        );
    }

    /// Take the origin peer_id for a document (one-shot: removes the entry).
    /// Returns Some(peer_id) if the document was recently written by the applier,
    /// None if it was written by the local app.
    pub fn take_origin(&self, collection: &str, doc_id: &str) -> Option<String> {
        self.writes
            .remove(&(collection.to_string(), doc_id.to_string()))
            .map(|(_, v)| v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mark_and_take_returns_origin() {
        let tracker = ApplierTracker::new();
        tracker.mark_written("medical-patients", "doc-1", "peer-a");
        assert_eq!(tracker.take_origin("medical-patients", "doc-1"), Some("peer-a".to_string()));
    }

    #[test]
    fn take_is_one_shot() {
        let tracker = ApplierTracker::new();
        tracker.mark_written("medical-patients", "doc-1", "peer-a");
        assert!(tracker.take_origin("medical-patients", "doc-1").is_some());
        // Second take returns None — entry was consumed
        assert!(tracker.take_origin("medical-patients", "doc-1").is_none());
    }

    #[test]
    fn take_unknown_returns_none() {
        let tracker = ApplierTracker::new();
        assert!(tracker.take_origin("medical-patients", "unknown").is_none());
    }

    #[test]
    fn overwrite_updates_origin() {
        let tracker = ApplierTracker::new();
        tracker.mark_written("medical-patients", "doc-1", "peer-a");
        tracker.mark_written("medical-patients", "doc-1", "peer-b");
        assert_eq!(tracker.take_origin("medical-patients", "doc-1"), Some("peer-b".to_string()));
    }

    #[test]
    fn different_docs_independent() {
        let tracker = ApplierTracker::new();
        tracker.mark_written("medical-patients", "doc-1", "peer-a");
        tracker.mark_written("medical-patients", "doc-2", "peer-b");
        assert_eq!(tracker.take_origin("medical-patients", "doc-1"), Some("peer-a".to_string()));
        assert_eq!(tracker.take_origin("medical-patients", "doc-2"), Some("peer-b".to_string()));
    }

    #[test]
    fn clone_shares_state() {
        let tracker = ApplierTracker::new();
        let clone = tracker.clone();
        tracker.mark_written("col", "doc", "peer-a");
        assert_eq!(clone.take_origin("col", "doc"), Some("peer-a".to_string()));
    }
}
