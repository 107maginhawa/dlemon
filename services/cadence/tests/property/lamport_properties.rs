use cadence::state::SyncState;
use proptest::prelude::*;
use std::sync::Arc;

proptest! {
    #[test]
    fn prop_lamport_monotonic(n in 1..1000u32) {
        let state = SyncState::new();
        let mut prev = 0u64;
        for _ in 0..n {
            let val = state.increment_lamport();
            prop_assert!(val > prev, "Lamport clock should be monotonically increasing");
            prev = val;
        }
    }

    #[test]
    fn prop_lamport_merge_max_plus_one(
        local_val in 0..10000u64,
        remote_val in 0..10000u64,
    ) {
        let state = SyncState::with_values(local_val, 0);
        state.merge_lamport(remote_val);
        let result = state.lamport();
        let expected = std::cmp::max(local_val, remote_val) + 1;
        prop_assert_eq!(result, expected, "merge should set to max(local, remote) + 1");
    }

    #[test]
    fn prop_lamport_concurrent_increments_unique(n in 2..50u32) {
        let state = Arc::new(SyncState::new());
        let mut handles = Vec::new();

        for _ in 0..n {
            let s = state.clone();
            handles.push(std::thread::spawn(move || s.increment_lamport()));
        }

        let mut values: Vec<u64> = handles.into_iter().map(|h| h.join().unwrap()).collect();
        values.sort();
        values.dedup();

        prop_assert_eq!(
            values.len(),
            n as usize,
            "All concurrent increments should produce unique values"
        );
    }
}
