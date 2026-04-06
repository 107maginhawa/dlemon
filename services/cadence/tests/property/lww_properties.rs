use cadence::merge::lww::lww_merge_field;
use cadence::state::FieldChange;
use proptest::prelude::*;
use serde_json::json;

fn arb_field_change() -> impl Strategy<Value = FieldChange> {
    (
        "[a-z]{1,10}",           // field name
        0..1000u64,              // lamport
        "[a-z]{3,8}",           // peer_id
        prop::bool::ANY,        // use number or string
    )
        .prop_map(|(field, lamport, peer_id, use_num)| FieldChange {
            field,
            value: if use_num {
                json!(lamport)
            } else {
                json!(format!("val-{}", lamport))
            },
            lamport,
            peer_id,
        })
}

proptest! {
    #[test]
    fn prop_lww_commutativity(
        a in arb_field_change(),
        b in arb_field_change(),
    ) {
        let mut b = b;
        b.field = a.field.clone();

        let result_ab = lww_merge_field(&a, &b).clone();
        let result_ba = lww_merge_field(&b, &a).clone();

        prop_assert_eq!(&result_ab.value, &result_ba.value);
        prop_assert_eq!(result_ab.lamport, result_ba.lamport);
        prop_assert_eq!(&result_ab.peer_id, &result_ba.peer_id);
    }

    #[test]
    fn prop_lww_idempotency(
        a in arb_field_change(),
    ) {
        let a2 = a.clone();
        let result = lww_merge_field(&a, &a2).clone();
        prop_assert_eq!(&result.value, &a.value);
        prop_assert_eq!(result.lamport, a.lamport);
        prop_assert_eq!(&result.peer_id, &a.peer_id);
    }

    #[test]
    fn prop_lww_associativity(
        a in arb_field_change(),
        b in arb_field_change(),
        c in arb_field_change(),
    ) {
        let mut b = b;
        let mut c = c;
        b.field = a.field.clone();
        c.field = a.field.clone();

        let ab = lww_merge_field(&a, &b).clone();
        let ab_c = lww_merge_field(&ab, &c).clone();

        let bc = lww_merge_field(&b, &c).clone();
        let a_bc = lww_merge_field(&a, &bc).clone();

        prop_assert_eq!(&ab_c.value, &a_bc.value);
        prop_assert_eq!(ab_c.lamport, a_bc.lamport);
        prop_assert_eq!(&ab_c.peer_id, &a_bc.peer_id);
    }

    #[test]
    fn prop_lww_deterministic(
        a in arb_field_change(),
        b in arb_field_change(),
    ) {
        let mut b = b;
        b.field = a.field.clone();

        let r1 = lww_merge_field(&a, &b).clone();
        let r2 = lww_merge_field(&a, &b).clone();
        prop_assert_eq!(&r1.value, &r2.value);
        prop_assert_eq!(&r1.peer_id, &r2.peer_id);
    }

    #[test]
    fn prop_lww_total_order(
        a in arb_field_change(),
        b in arb_field_change(),
    ) {
        let mut b = b;
        b.field = a.field.clone();

        let winner = lww_merge_field(&a, &b).clone();
        prop_assert!(
            (winner.lamport == a.lamport && winner.peer_id == a.peer_id) ||
            (winner.lamport == b.lamport && winner.peer_id == b.peer_id)
        );
    }
}
