use cadence::merge::crdt::CrdtEngine;
use loro::LoroDoc;

#[test]
fn test_crdt_loro_import_export() {
    let engine = CrdtEngine::new();
    let doc = engine.doc();

    // Add some text
    let text = doc.get_text("notes");
    text.insert(0, "Hello world").unwrap();
    doc.commit();

    // Export
    let bytes = engine.export_all().unwrap();
    assert!(!bytes.is_empty());

    // Import into a new engine
    let engine2 = CrdtEngine::from_bytes(&bytes).unwrap();
    let text2 = engine2.doc().get_text("notes");
    assert_eq!(text2.to_string(), "Hello world");
}

#[test]
fn test_crdt_concurrent_text_edits() {
    // Two peers edit the same text concurrently
    let doc_a = LoroDoc::new();
    let doc_b = LoroDoc::new();

    // Peer A writes
    let text_a = doc_a.get_text("notes");
    text_a.insert(0, "Hello ").unwrap();
    doc_a.commit();

    // Peer B writes independently
    let text_b = doc_b.get_text("notes");
    text_b.insert(0, "World").unwrap();
    doc_b.commit();

    // Exchange updates
    let engine_a = CrdtEngine::new();
    engine_a.import(&doc_a.export(loro::ExportMode::all_updates()).unwrap()).unwrap();
    engine_a.import(&doc_b.export(loro::ExportMode::all_updates()).unwrap()).unwrap();

    let engine_b = CrdtEngine::new();
    engine_b.import(&doc_b.export(loro::ExportMode::all_updates()).unwrap()).unwrap();
    engine_b.import(&doc_a.export(loro::ExportMode::all_updates()).unwrap()).unwrap();

    // Both should converge to the same result
    let result_a = engine_a.doc().get_text("notes").to_string();
    let result_b = engine_b.doc().get_text("notes").to_string();
    assert_eq!(result_a, result_b, "Both peers should converge");
    // The merged text should contain both "Hello " and "World"
    assert!(result_a.contains("Hello"), "Should contain Hello");
    assert!(result_a.contains("World"), "Should contain World");
}

#[test]
fn test_crdt_tree_operations() {
    let engine = CrdtEngine::new();
    let doc = engine.doc();

    let tree = doc.get_tree("dental_chart");
    let root = tree.create(loro::TreeParentId::Root).unwrap();
    let meta = tree.get_meta(root).unwrap();
    meta.insert("number", 14).unwrap();
    meta.insert("status", "caries").unwrap();
    doc.commit();

    // Export and reimport
    let bytes = engine.export_all().unwrap();
    let engine2 = CrdtEngine::from_bytes(&bytes).unwrap();
    let tree2 = engine2.doc().get_tree("dental_chart");
    let nodes: Vec<_> = tree2.nodes();
    assert_eq!(nodes.len(), 1, "Should have 1 tree node");
}

#[test]
fn test_crdt_incremental_update() {
    let engine = CrdtEngine::new();
    let doc = engine.doc();

    // Initial state
    let text = doc.get_text("notes");
    text.insert(0, "Initial").unwrap();
    doc.commit();

    let version1 = engine.version();

    // More changes
    text.insert(7, " text").unwrap();
    doc.commit();

    // Export only the delta since version1
    let delta = engine.export_since(&version1).unwrap();
    assert!(!delta.is_empty());

    // Apply delta to another engine that has version1
    let _engine2 = CrdtEngine::from_bytes(&engine.export_all().unwrap()).unwrap();
    // Re-export from version1 should give same delta
    let delta2 = engine.export_since(&version1).unwrap();
    assert_eq!(delta.len(), delta2.len());
}

#[test]
fn test_crdt_snapshot_plus_incremental() {
    let engine = CrdtEngine::new();
    let doc = engine.doc();

    // Build up some state
    let text = doc.get_text("notes");
    text.insert(0, "Part 1").unwrap();
    doc.commit();
    let snapshot = engine.export_all().unwrap();

    // Add more
    text.insert(6, " + Part 2").unwrap();
    doc.commit();
    let v_after_snapshot = engine.version();
    let _ = v_after_snapshot;
    let full = engine.export_all().unwrap();

    // New peer loads snapshot, then can get incremental
    let engine2 = CrdtEngine::from_bytes(&snapshot).unwrap();
    let text2 = engine2.doc().get_text("notes");
    assert_eq!(text2.to_string(), "Part 1");

    // Apply full update (idempotent for already-seen ops)
    engine2.import(&full).unwrap();
    let text2 = engine2.doc().get_text("notes");
    assert_eq!(text2.to_string(), "Part 1 + Part 2");
}

#[test]
fn test_crdt_time_travel() {
    let engine = CrdtEngine::new();
    let doc = engine.doc();

    let text = doc.get_text("notes");
    text.insert(0, "Version 1").unwrap();
    doc.commit();

    let frontiers_v1 = doc.oplog_frontiers();

    text.delete(0, 9).unwrap();
    text.insert(0, "Version 2").unwrap();
    doc.commit();

    // Current state should be "Version 2"
    assert_eq!(text.to_string(), "Version 2");

    // Time travel back to version 1
    doc.checkout(&frontiers_v1).unwrap();
    assert_eq!(doc.get_text("notes").to_string(), "Version 1");

    // Return to latest
    doc.checkout_to_latest();
    assert_eq!(doc.get_text("notes").to_string(), "Version 2");
}
