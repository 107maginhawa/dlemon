use crate::state::FieldChange;
use std::cmp::Ordering;

/// Merge two field changes using Last-Write-Wins.
/// Returns the winning change (higher lamport wins; peer_id breaks ties).
pub fn lww_merge_field<'a>(local: &'a FieldChange, remote: &'a FieldChange) -> &'a FieldChange {
    match remote.lamport.cmp(&local.lamport) {
        Ordering::Greater => remote,
        Ordering::Less => local,
        Ordering::Equal => {
            // Deterministic tiebreaker: higher peer_id wins
            if remote.peer_id > local.peer_id {
                remote
            } else {
                local
            }
        }
    }
}

/// Merge a list of remote field changes into a list of local field changes.
/// Returns the merged result — one FieldChange per unique field name.
pub fn lww_merge_row(
    local_fields: &[FieldChange],
    remote_fields: &[FieldChange],
) -> Vec<FieldChange> {
    use std::collections::BTreeMap;

    let mut merged: BTreeMap<&str, &FieldChange> = BTreeMap::new();

    // Insert all local fields
    for fc in local_fields {
        merged.insert(&fc.field, fc);
    }

    // Merge remote fields
    for remote_fc in remote_fields {
        match merged.get(remote_fc.field.as_str()) {
            Some(local_fc) => {
                let winner = lww_merge_field(local_fc, remote_fc);
                merged.insert(&remote_fc.field, winner);
            }
            None => {
                // New field from remote — accept it
                merged.insert(&remote_fc.field, remote_fc);
            }
        }
    }

    merged.values().map(|fc| (*fc).clone()).collect()
}
