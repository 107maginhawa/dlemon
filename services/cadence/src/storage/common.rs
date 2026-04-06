use crate::state::{FieldChange, RowChange, SyncPayload};
use anyhow::Result;
use std::collections::BTreeMap;

/// Raw change row from storage — used by both SQLite and Valkey backends
/// to aggregate into RowChange structs.
pub(super) struct RawChangeRow {
    pub seq: u64,
    pub collection: String,
    pub doc_id: String,
    pub field: String,
    pub value: Option<String>,
    pub lamport: u64,
    pub peer_id: String,
    pub deleted: bool,
}

/// Aggregate raw change rows into RowChange structs.
/// Groups consecutive rows for the same (collection, doc_id) into a single RowChange.
pub(super) fn aggregate_raw_rows(rows: Vec<RawChangeRow>) -> Vec<RowChange> {
    let mut groups: BTreeMap<(String, String), (u64, bool, Vec<FieldChange>)> = BTreeMap::new();

    for row in rows {
        if row.field == "__crdt__" || row.field == "__deleted__" {
            let _bytes = row
                .value
                .map(|v| base64_decode(&v).unwrap_or_default())
                .unwrap_or_default();
            let key = (row.collection.clone(), row.doc_id.clone());
            groups.insert(key, (row.seq, row.deleted, vec![]));
            continue;
        }

        let value: serde_json::Value = row
            .value
            .as_deref()
            .map(|v| serde_json::from_str(v).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null);

        let fc = FieldChange {
            field: row.field,
            value,
            lamport: row.lamport,
            peer_id: row.peer_id,
        };

        let key = (row.collection, row.doc_id);
        groups
            .entry(key)
            .and_modify(|(seq, deleted, fields)| {
                *seq = std::cmp::max(*seq, row.seq);
                *deleted = row.deleted;
                fields.push(fc.clone());
            })
            .or_insert((row.seq, row.deleted, vec![fc]));
    }

    groups
        .into_iter()
        .map(|((collection, document_id), (seq, deleted, fields))| RowChange {
            collection,
            document_id,
            payload: SyncPayload::Fields(fields),
            deleted,
            seq,
        })
        .collect()
}

pub(super) fn base64_encode(data: &[u8]) -> String {
    use std::fmt::Write;
    let mut s = String::with_capacity(data.len() * 4 / 3 + 4);
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        let _ = write!(s, "{}", CHARS[(b0 >> 2) & 0x3f] as char);
        let _ = write!(s, "{}", CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f] as char);
        if chunk.len() > 1 {
            let _ = write!(s, "{}", CHARS[((b1 << 2) | (b2 >> 6)) & 0x3f] as char);
        } else {
            s.push('=');
        }
        if chunk.len() > 2 {
            let _ = write!(s, "{}", CHARS[b2 & 0x3f] as char);
        } else {
            s.push('=');
        }
    }
    s
}

pub(super) fn base64_decode(s: &str) -> Result<Vec<u8>> {
    const DECODE: [u8; 128] = {
        let mut table = [255u8; 128];
        let mut i = 0u8;
        while i < 26 {
            table[(b'A' + i) as usize] = i;
            table[(b'a' + i) as usize] = i + 26;
            i += 1;
        }
        let mut i = 0u8;
        while i < 10 {
            table[(b'0' + i) as usize] = i + 52;
            i += 1;
        }
        table[b'+' as usize] = 62;
        table[b'/' as usize] = 63;
        table
    };

    let input: Vec<u8> = s.bytes().filter(|&b| b != b'\n' && b != b'\r').collect();
    let mut out = Vec::with_capacity(input.len() * 3 / 4);

    for chunk in input.chunks(4) {
        if chunk.len() < 2 {
            break;
        }
        let b0 = DECODE[chunk[0] as usize];
        let b1 = DECODE[chunk[1] as usize];
        out.push((b0 << 2) | (b1 >> 4));
        if chunk.len() > 2 && chunk[2] != b'=' {
            let b2 = DECODE[chunk[2] as usize];
            out.push((b1 << 4) | (b2 >> 2));
            if chunk.len() > 3 && chunk[3] != b'=' {
                let b3 = DECODE[chunk[3] as usize];
                out.push((b2 << 6) | b3);
            }
        }
    }

    Ok(out)
}
