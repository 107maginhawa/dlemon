# How to Clone Azure PG Database for Testing

**Source:** `mpiazeapgdb0002.postgres.database.azure.com` (Azure PG Flexible Server, ~200 GB+)
**Goal:** Create a staging/testing clone without affecting the migrated data or repeating the migration.

---

## Recommended: Point-in-Time Restore (PITR)

Zero impact on the source, preserves all data/indexes/sequences, completes in under an hour.

### Steps

**1. Trigger an on-demand backup** (creates a fresh snapshot, minimizes WAL replay):

```bash
az postgres flexible-server backup create \
  --resource-group <source-rg> \
  --name mpiazeapgdb0002 \
  --backup-name "pre-clone-$(date +%Y%m%d%H%M)"
```

> On-demand backup requires General Purpose or Memory Optimized tier (not Burstable). Max 7 on-demand backups per server.

**2. List backups and get the completion timestamp:**

```bash
az postgres flexible-server backup list \
  --resource-group <source-rg> \
  --name mpiazeapgdb0002 \
  --output table
```

**3. Restore using the backup timestamp** (Fast Restore — skips WAL replay):

```bash
az postgres flexible-server restore \
  --resource-group <target-rg> \
  --name mpiazeapgdb0002-staging \
  --source-server mpiazeapgdb0002 \
  --restore-time "<backup-completed-timestamp>"
```

Or restore to the latest point (with some WAL replay):

```bash
az postgres flexible-server restore \
  --resource-group <target-rg> \
  --name mpiazeapgdb0002-staging \
  --source-server mpiazeapgdb0002
```

> When `--restore-time` is omitted, it defaults to current time (latest restore point).

**4. Scale down to save costs** (PITR inherits the source SKU):

```bash
az postgres flexible-server update \
  --resource-group <target-rg> \
  --name mpiazeapgdb0002-staging \
  --tier Burstable \
  --sku-name Standard_B4ms
```

**5. Reduce backup retention:**

```bash
az postgres flexible-server update \
  --resource-group <target-rg> \
  --name mpiazeapgdb0002-staging \
  --backup-retention 1
```

**6. Reconfigure server parameters** (PITR does NOT preserve them):

```bash
# List custom params from source
az postgres flexible-server parameter list \
  --resource-group <source-rg> \
  --server-name mpiazeapgdb0002 \
  --query "[?value!=defaultValue].{name:name, value:value}" \
  --output table

# Apply each to the clone
az postgres flexible-server parameter set \
  --resource-group <target-rg> \
  --server-name mpiazeapgdb0002-staging \
  --name <param-name> --value <param-value>
```

**7. Configure firewall rules** (also not preserved):

```bash
az postgres flexible-server firewall-rule create \
  --resource-group <target-rg> \
  --name mpiazeapgdb0002-staging \
  --rule-name AllowAKS \
  --start-ip-address <ip> \
  --end-ip-address <ip>
```

**8. Verify data:**

```sql
-- Compare database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Compare row counts
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- Verify indexes are present
SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';

-- Verify sequences
SELECT sequencename, last_value FROM pg_sequences
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');

-- Verify extensions
SELECT extname, extversion FROM pg_extension;
```

### What PITR Preserves

| Object | Preserved? |
|---|---|
| All table data | Yes |
| Indexes | Yes |
| Sequences (current values) | Yes |
| Extensions | Yes |
| Roles, users, passwords | Yes |
| Server parameters | **No** — must reconfigure |
| Firewall rules | **No** — must recreate |
| HA / read replicas | **No** — must re-enable |

### Constraints

| Constraint | Details |
|---|---|
| Cross-subscription | **Not supported** for Flexible Server PITR |
| Cross-region | Only if geo-redundant backup was enabled at server creation |
| Storage size | Cannot be reduced — clone inherits source storage (~2 TB = ~$235/mo) |
| Time estimate | 15-45 min (Fast Restore) or 30 min - 2 hours (standard PITR) |
| Source impact | **Zero** — reads from backup artifacts only |

### Cost Estimate

| Component | Monthly (approx.) |
|---|---|
| Compute: Standard_B4ms (4 vCores, 16 GB) | ~$100-120 |
| Storage: 2 TB (inherited, cannot shrink) | ~$235 |
| **Total (running)** | **~$335-355/mo** |
| **Total (stopped)** | **~$235/mo** (storage only; auto-restarts after 7 days) |

### Lifecycle Management

```bash
# Stop the clone when not testing (saves compute, not storage)
az postgres flexible-server stop \
  --resource-group <target-rg> \
  --name mpiazeapgdb0002-staging

# Start it when needed
az postgres flexible-server start \
  --resource-group <target-rg> \
  --name mpiazeapgdb0002-staging

# Delete when done (eliminates all costs)
az postgres flexible-server delete \
  --resource-group <target-rg> \
  --name mpiazeapgdb0002-staging --yes
```

> A stopped server auto-restarts after 7 days. Set a reminder or use Azure Automation to re-stop it.

---

## Alternative: pg_dump / pg_restore

Use this if you need: a different subscription, a different region (without geo-backup), smaller storage, or selective table export.

### Recommended: Dump from a PITR Clone (not production)

This avoids any I/O or CPU impact on the production database.

```bash
# 1. Create a temporary PITR clone to dump from
az postgres flexible-server restore \
  --resource-group <rg> \
  --name mpiazeapgdb0002-dump-source \
  --source-server mpiazeapgdb0002

# 2. Dump from the clone (run from an Azure VM in the same region)
pg_dump \
  -h mpiazeapgdb0002-dump-source.postgres.database.azure.com \
  -U mpadmin02 -d postgres \
  --format=directory \
  --jobs=8 \
  --compress=1 \
  --exclude-table-data=public.activity_logs \
  --verbose \
  -f /mnt/dump/medicard

# 3. Dump roles separately (pg_dump doesn't include roles)
pg_dumpall --globals-only --no-role-passwords \
  -h mpiazeapgdb0002-dump-source.postgres.database.azure.com \
  -U mpadmin02 > roles.sql

# 4. Create target server with desired (smaller) tier
az postgres flexible-server create \
  --resource-group <target-rg> \
  --name mpiazeapgdb0002-test \
  --tier Burstable \
  --sku-name Standard_B4ms \
  --storage-size 256 \
  --admin-user mpadmin02 \
  --admin-password '<password>'

# 5. Tune target for fast restore
az postgres flexible-server parameter set --resource-group <target-rg> \
  --server-name mpiazeapgdb0002-test --name maintenance_work_mem --value 2097151
az postgres flexible-server parameter set --resource-group <target-rg> \
  --server-name mpiazeapgdb0002-test --name max_wal_size --value 65536
az postgres flexible-server parameter set --resource-group <target-rg> \
  --server-name mpiazeapgdb0002-test --name autovacuum --value off

# 6. Restore roles (edit out Azure-internal roles first)
sed -e '/azure_superuser/d' -e '/azure_pg_admin/d' -e '/azuresu/d' roles.sql > roles_clean.sql
psql -h mpiazeapgdb0002-test.postgres.database.azure.com \
  -U mpadmin02 -f roles_clean.sql

# 7. Restore data
pg_restore \
  -h mpiazeapgdb0002-test.postgres.database.azure.com \
  -U mpadmin02 -d postgres \
  --format=directory \
  --jobs=8 \
  --disable-triggers \
  --no-owner \
  --verbose \
  /mnt/dump/medicard

# 8. Re-enable autovacuum and run ANALYZE
az postgres flexible-server parameter set --resource-group <target-rg> \
  --server-name mpiazeapgdb0002-test --name autovacuum --value on

psql -h mpiazeapgdb0002-test.postgres.database.azure.com \
  -U mpadmin02 -d postgres -c "ANALYZE;"

# 9. Delete the temporary dump-source clone
az postgres flexible-server delete \
  --resource-group <rg> --name mpiazeapgdb0002-dump-source --yes
```

### pg_dump vs PITR Comparison

| Criterion | PITR | pg_dump/pg_restore |
|---|---|---|
| Speed | 15 min - 2 hours | 4-8 hours |
| Source impact | Zero | Moderate (use PITR clone to avoid) |
| Target flexibility | Azure Flexible Server only, same region | Any PostgreSQL, any cloud/region |
| Storage size control | Inherits source (can't shrink) | Choose any size |
| Selective tables | No (full server) | Yes (`--exclude-table`, `--table`) |
| Cross-subscription | Not supported | Yes |
| Cross-region | Only with geo-backup | Yes |
| Roles/passwords | Preserved | Roles yes, passwords no |
| Server parameters | Reset to defaults | N/A (target is new server) |
| Automation | Single `az` command | Multi-step scripted |

### Time Estimate for pg_dump/pg_restore (200 GB)

| Phase | Estimate |
|---|---|
| pg_dump with 8 parallel workers | 1-3 hours |
| pg_restore with 8 parallel workers | 2-4 hours |
| GIN index rebuilds on large JSONB tables | 1-3 hours |
| **Total** | **4-8 hours** |

> Run from an Azure VM in the same region as both servers for best performance and to avoid egress charges.

---

## Summary

| Use Case | Recommended Method |
|---|---|
| Quick staging clone, same region, same subscription | **PITR** |
| Need smaller storage to reduce costs | **pg_dump/pg_restore** |
| Need clone in different subscription | **pg_dump/pg_restore** |
| Need clone in different region (no geo-backup) | **pg_dump/pg_restore** |
| Need to exclude large tables (activity_logs, history) | **pg_dump/pg_restore** |
| One-time test, delete after | **PITR** (fastest to set up and tear down) |
