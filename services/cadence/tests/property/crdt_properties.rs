use cadence::merge::crdt::CrdtEngine;
use loro::{ExportMode, LoroDoc};
use proptest::prelude::*;

fn make_text_doc(text: &str) -> Vec<u8> {
    let doc = LoroDoc::new();
    let t = doc.get_text("content");
    t.insert(0, text).unwrap();
    doc.commit();
    doc.export(ExportMode::all_updates()).unwrap()
}

proptest! {
    #[test]
    fn prop_crdt_commutativity(
        text_a in "[a-z ]{1,20}",
        text_b in "[a-z ]{1,20}",
    ) {
        let bytes_a = make_text_doc(&text_a);
        let bytes_b = make_text_doc(&text_b);

        // Import in order A, B
        let engine_ab = CrdtEngine::new();
        engine_ab.import(&bytes_a).unwrap();
        engine_ab.import(&bytes_b).unwrap();
        let result_ab = engine_ab.doc().get_text("content").to_string();

        // Import in order B, A
        let engine_ba = CrdtEngine::new();
        engine_ba.import(&bytes_b).unwrap();
        engine_ba.import(&bytes_a).unwrap();
        let result_ba = engine_ba.doc().get_text("content").to_string();

        prop_assert_eq!(result_ab, result_ba, "Import order should not matter");
    }

    #[test]
    fn prop_crdt_idempotency(
        text in "[a-z ]{1,20}",
    ) {
        let bytes = make_text_doc(&text);

        let engine = CrdtEngine::new();
        engine.import(&bytes).unwrap();
        let result1 = engine.doc().get_text("content").to_string();

        // Import same bytes again
        engine.import(&bytes).unwrap();
        let result2 = engine.doc().get_text("content").to_string();

        prop_assert_eq!(result1, result2, "Double import should be idempotent");
    }

    #[test]
    fn prop_crdt_eventual_convergence(
        texts in prop::collection::vec("[a-z]{1,10}", 2..5),
    ) {
        // Create N independent documents
        let docs: Vec<Vec<u8>> = texts.iter().map(|t| make_text_doc(t)).collect();

        // Merge all into each peer
        let mut results = Vec::new();
        for _ in 0..docs.len() {
            let engine = CrdtEngine::new();
            for doc_bytes in &docs {
                engine.import(doc_bytes).unwrap();
            }
            results.push(engine.doc().get_text("content").to_string());
        }

        // All peers should converge to the same state
        for i in 1..results.len() {
            prop_assert_eq!(&results[0], &results[i], "All peers should converge");
        }
    }

    #[test]
    fn prop_crdt_no_data_loss(
        text in "[a-z]{5,15}",
    ) {
        let bytes = make_text_doc(&text);
        let engine = CrdtEngine::from_bytes(&bytes).unwrap();
        let result = engine.doc().get_text("content").to_string();

        // All characters from the original text should be present
        prop_assert_eq!(result, text, "No data should be lost");
    }
}
