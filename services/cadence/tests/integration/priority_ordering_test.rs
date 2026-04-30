//! Tests for `CadenceConfig::priority_for` and
//! `CadenceConfig::collections_in_priority_order`.
//!
//! These cover the wire-side ordering behavior that determines which
//! collections drain first during catch-up — the user-visible behavior is
//! "auth/identity/medical arrives before activity-logs" so a few specific
//! cases are pinned down here.

use cadence::config::{CadenceConfig, CollectionConfig, ConflictStrategy};
use std::collections::BTreeMap;

fn config_with_collections(names: &[&str]) -> CadenceConfig {
    let mut config = CadenceConfig::default();
    for name in names {
        config.collections.insert(
            name.to_string(),
            CollectionConfig {
                strategy: ConflictStrategy::Lww,
                scope_columns: BTreeMap::new(),
                scope_rules: None,
            },
        );
    }
    config
}

#[test]
fn priority_for_explicit_overrides_wildcard() {
    let mut config = CadenceConfig::default();
    config.priorities.insert("*".to_string(), 50);
    config.priorities.insert("medical-patients".to_string(), 150);

    assert_eq!(config.priority_for("medical-patients"), 150);
    assert_eq!(config.priority_for("anything-else"), 50);
}

#[test]
fn priority_for_falls_back_to_wildcard_then_zero() {
    let mut config = CadenceConfig::default();
    // No `*`, no explicit — collection gets 0.
    assert_eq!(config.priority_for("medical-patients"), 0);

    // `*` set, no explicit for this collection — gets the wildcard value.
    config.priorities.insert("*".to_string(), 75);
    assert_eq!(config.priority_for("medical-patients"), 75);
    assert_eq!(config.priority_for("activity-logs"), 75);

    // Explicit overrides wildcard.
    config.priorities.insert("activity-logs".to_string(), 0);
    assert_eq!(config.priority_for("activity-logs"), 0);
    assert_eq!(config.priority_for("medical-patients"), 75);
}

#[test]
fn collections_in_priority_order_descending_then_alphabetical() {
    let mut config = config_with_collections(&[
        "activity-logs",
        "medical-patients",
        "user",
        "account",
        "billing-invoices",
        "*", // wildcard collection — must be excluded from iteration
    ]);
    // activity-logs lowest, user/account/medical/billing higher
    config.priorities.insert("*".to_string(), 50);
    config.priorities.insert("user".to_string(), 200);
    config.priorities.insert("account".to_string(), 200); // tie with user
    config.priorities.insert("medical-patients".to_string(), 150);
    config.priorities.insert("billing-invoices".to_string(), 120);
    config.priorities.insert("activity-logs".to_string(), 0);

    let order: Vec<&str> = config
        .collections_in_priority_order()
        .iter()
        .map(|s| s.as_str())
        .collect();

    // Wildcard "*" is filtered out
    assert!(!order.contains(&"*"), "iteration order must not include the wildcard key");

    // Expected: account before user (alphabetical tiebreaker at priority 200),
    // then medical-patients (150), billing-invoices (120), activity-logs (0).
    assert_eq!(
        order,
        vec![
            "account",
            "user",
            "medical-patients",
            "billing-invoices",
            "activity-logs",
        ],
    );
}

#[test]
fn unlisted_collections_inherit_wildcard_default() {
    let mut config = config_with_collections(&["alpha", "beta", "gamma", "user"]);
    config.priorities.insert("*".to_string(), 50);
    config.priorities.insert("user".to_string(), 200);

    let order: Vec<&str> = config
        .collections_in_priority_order()
        .iter()
        .map(|s| s.as_str())
        .collect();

    // user (200) first, then alpha/beta/gamma all at 50 in alphabetical order.
    assert_eq!(order, vec!["user", "alpha", "beta", "gamma"]);
}

#[test]
fn empty_priorities_preserves_alphabetical_order() {
    // No `priorities:` block at all — the legacy behavior must be preserved
    // exactly so configs without the new block don't see a behavior change.
    let config = config_with_collections(&[
        "zzz-last",
        "activity-logs",
        "medical-patients",
        "account",
    ]);

    let order: Vec<&str> = config
        .collections_in_priority_order()
        .iter()
        .map(|s| s.as_str())
        .collect();

    // All at priority 0 → pure alphabetical
    assert_eq!(
        order,
        vec!["account", "activity-logs", "medical-patients", "zzz-last"],
    );
}

#[test]
fn yaml_with_priorities_block_round_trips() {
    let yaml = r#"
collections:
  "*":
    strategy: lww
  user:
    strategy: lww
  activity-logs:
    strategy: lww
priorities:
  "*": 50
  user: 200
  activity-logs: 0
"#;
    let config = CadenceConfig::from_yaml_str(yaml).expect("parse YAML");

    assert_eq!(config.priority_for("user"), 200);
    assert_eq!(config.priority_for("activity-logs"), 0);
    assert_eq!(config.priority_for("not-listed"), 50);

    let order: Vec<&str> = config
        .collections_in_priority_order()
        .iter()
        .map(|s| s.as_str())
        .collect();
    assert_eq!(order, vec!["user", "activity-logs"]);
}

#[test]
fn yaml_without_priorities_block_defaults_to_alphabetical() {
    let yaml = r#"
collections:
  "*":
    strategy: lww
  user:
    strategy: lww
  activity-logs:
    strategy: lww
"#;
    let config = CadenceConfig::from_yaml_str(yaml).expect("parse YAML");

    assert_eq!(config.priority_for("user"), 0);

    let order: Vec<&str> = config
        .collections_in_priority_order()
        .iter()
        .map(|s| s.as_str())
        .collect();
    // Pure alphabetical; activity-logs first because 'a' < 'u'.
    assert_eq!(order, vec!["activity-logs", "user"]);
}
