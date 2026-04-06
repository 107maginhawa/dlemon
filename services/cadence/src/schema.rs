use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// Database column type (normalized across PG and SQLite).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum ColumnType {
    Text,
    Integer,
    Real,
    Json,
    Boolean,
    Timestamp,
}

impl ColumnType {
    /// Normalize a PostgreSQL data_type string to ColumnType.
    pub fn from_pg_type(pg_type: &str) -> Self {
        match pg_type.to_lowercase().as_str() {
            "text" | "character varying" | "varchar" | "char" | "character" | "uuid" => Self::Text,
            "integer" | "int" | "int4" | "smallint" | "int2" | "bigint" | "int8" | "serial"
            | "bigserial" => Self::Integer,
            "real" | "float4" | "double precision" | "float8" | "numeric" | "decimal" => {
                Self::Real
            }
            "json" | "jsonb" => Self::Json,
            "boolean" | "bool" => Self::Boolean,
            "timestamp" | "timestamp without time zone" | "timestamp with time zone"
            | "timestamptz" | "date" | "time" => Self::Timestamp,
            _ => Self::Text, // fallback
        }
    }

    /// Normalize a SQLite type string to ColumnType.
    pub fn from_sqlite_type(sqlite_type: &str) -> Self {
        let upper = sqlite_type.to_uppercase();
        if upper.contains("INT") {
            Self::Integer
        } else if upper.contains("TEXT") || upper.contains("CHAR") || upper.contains("CLOB") {
            Self::Text
        } else if upper.contains("REAL")
            || upper.contains("FLOA")
            || upper.contains("DOUB")
            || upper.contains("NUMERIC")
        {
            Self::Real
        } else if upper.contains("BLOB") || upper.is_empty() {
            Self::Text
        } else if upper.contains("BOOL") {
            Self::Boolean
        } else if upper.contains("JSON") {
            Self::Json
        } else if upper.contains("DATE") || upper.contains("TIME") || upper.contains("TIMESTAMP")
        {
            Self::Timestamp
        } else {
            Self::Text
        }
    }
}

/// Fingerprint of a single table's schema.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TableFingerprint {
    /// Columns sorted by name for determinism.
    pub columns: BTreeMap<String, ColumnType>,
    /// SHA-256 hash of serialized columns.
    pub hash: [u8; 32],
}

impl TableFingerprint {
    pub fn new(columns: BTreeMap<String, ColumnType>) -> Self {
        let hash = Self::compute_hash(&columns);
        Self { columns, hash }
    }

    fn compute_hash(columns: &BTreeMap<String, ColumnType>) -> [u8; 32] {
        let mut hasher = Sha256::new();
        for (name, col_type) in columns {
            hasher.update(name.as_bytes());
            hasher.update(b":");
            hasher.update(format!("{:?}", col_type).as_bytes());
            hasher.update(b";");
        }
        hasher.finalize().into()
    }
}

/// Fingerprint of all synced tables.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SchemaFingerprint {
    pub tables: BTreeMap<String, TableFingerprint>,
}

impl SchemaFingerprint {
    pub fn new(tables: BTreeMap<String, TableFingerprint>) -> Self {
        Self { tables }
    }

    pub fn empty() -> Self {
        Self {
            tables: BTreeMap::new(),
        }
    }
}

/// Result of comparing two table schemas.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SchemaCompatibility {
    /// All columns match in name and type.
    Identical,
    /// Extra columns on one side — safe to sync shared columns.
    Compatible { warnings: Vec<String> },
    /// Missing table or column type mismatch — skip this table.
    Incompatible { errors: Vec<String> },
}

/// Compare two schema fingerprints and return per-table compatibility.
pub fn compare_schemas(
    local: &SchemaFingerprint,
    remote: &SchemaFingerprint,
) -> BTreeMap<String, SchemaCompatibility> {
    let mut result = BTreeMap::new();

    // Check all tables known to either side
    let all_tables: std::collections::BTreeSet<&str> = local
        .tables
        .keys()
        .chain(remote.tables.keys())
        .map(|s| s.as_str())
        .collect();

    for table in all_tables {
        let local_table = local.tables.get(table);
        let remote_table = remote.tables.get(table);

        let compat = match (local_table, remote_table) {
            (Some(l), Some(r)) => compare_table_fingerprints(table, l, r),
            (Some(_), None) => SchemaCompatibility::Incompatible {
                errors: vec![format!("Table '{}' missing on remote peer", table)],
            },
            (None, Some(_)) => SchemaCompatibility::Incompatible {
                errors: vec![format!("Table '{}' missing on local peer", table)],
            },
            (None, None) => unreachable!(),
        };

        result.insert(table.to_string(), compat);
    }

    result
}

fn compare_table_fingerprints(
    table: &str,
    local: &TableFingerprint,
    remote: &TableFingerprint,
) -> SchemaCompatibility {
    if local.hash == remote.hash {
        return SchemaCompatibility::Identical;
    }

    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    // Check for type mismatches on shared columns
    for (col, local_type) in &local.columns {
        if let Some(remote_type) = remote.columns.get(col) {
            if local_type != remote_type {
                errors.push(format!(
                    "Table '{}' column '{}': local type {:?} != remote type {:?}",
                    table, col, local_type, remote_type
                ));
            }
        }
    }

    if !errors.is_empty() {
        return SchemaCompatibility::Incompatible { errors };
    }

    // Check for extra columns on either side
    for col in local.columns.keys() {
        if !remote.columns.contains_key(col) {
            warnings.push(format!(
                "Table '{}' column '{}' exists locally but not on remote",
                table, col
            ));
        }
    }
    for col in remote.columns.keys() {
        if !local.columns.contains_key(col) {
            warnings.push(format!(
                "Table '{}' column '{}' exists on remote but not locally",
                table, col
            ));
        }
    }

    if warnings.is_empty() {
        SchemaCompatibility::Identical
    } else {
        SchemaCompatibility::Compatible { warnings }
    }
}

/// List all user tables in a PostgreSQL database.
pub async fn list_all_tables_pg(client: &tokio_postgres::Client) -> Result<Vec<String>> {
    let rows = client
        .query(
            "SELECT table_name FROM information_schema.tables \
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE' \
             ORDER BY table_name",
            &[],
        )
        .await
        .context("Failed to list PostgreSQL tables")?;

    Ok(rows.iter().map(|row| row.get::<_, String>(0)).collect())
}

/// List all user tables in a SQLite database.
pub fn list_all_tables_sqlite(conn: &rusqlite::Connection) -> Result<Vec<String>> {
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .context("Failed to list SQLite tables")?;

    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tables)
}

/// Check if a PostgreSQL table has a specific column.
pub async fn table_has_column_pg(
    client: &tokio_postgres::Client,
    table: &str,
    column: &str,
) -> Result<bool> {
    let rows = client
        .query(
            "SELECT 1 FROM information_schema.columns \
             WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
            &[&table, &column],
        )
        .await
        .context("Failed to check column existence")?;

    Ok(!rows.is_empty())
}

/// Check if a SQLite table has a specific column.
pub fn table_has_column_sqlite(
    conn: &rusqlite::Connection,
    table: &str,
    column: &str,
) -> Result<bool> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", table))
        .context("Failed to introspect SQLite table for column check")?;

    let has_col = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .any(|name| name == column);

    Ok(has_col)
}

/// Introspect a SQLite database table and return its fingerprint.
pub fn introspect_sqlite(
    conn: &rusqlite::Connection,
    table: &str,
) -> Result<TableFingerprint> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", table))
        .context("Failed to introspect SQLite table")?;

    let columns: BTreeMap<String, ColumnType> = stmt
        .query_map([], |row| {
            let name: String = row.get(1)?;
            let type_str: String = row.get(2)?;
            Ok((name, type_str))
        })?
        .filter_map(|r| r.ok())
        .map(|(name, type_str)| (name, ColumnType::from_sqlite_type(&type_str)))
        .collect();

    if columns.is_empty() {
        anyhow::bail!("Table '{}' not found or has no columns", table);
    }

    Ok(TableFingerprint::new(columns))
}

/// Introspect a PostgreSQL table and return its fingerprint.
pub async fn introspect_postgres(
    client: &tokio_postgres::Client,
    table: &str,
) -> Result<TableFingerprint> {
    let rows = client
        .query(
            "SELECT column_name, data_type FROM information_schema.columns
             WHERE table_name = $1 ORDER BY ordinal_position",
            &[&table],
        )
        .await
        .context("Failed to introspect PostgreSQL table")?;

    if rows.is_empty() {
        anyhow::bail!("Table '{}' not found or has no columns", table);
    }

    let columns: BTreeMap<String, ColumnType> = rows
        .iter()
        .map(|row| {
            let name: String = row.get(0);
            let type_str: String = row.get(1);
            (name, ColumnType::from_pg_type(&type_str))
        })
        .collect();

    Ok(TableFingerprint::new(columns))
}
