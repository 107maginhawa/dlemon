# Migration Rollback Runbook

Drizzle ORM does not generate `down` migrations. Rollback is achieved by writing a manual reverse SQL script and running it against the target database, then removing the rolled-back migration files from the `drizzle_migrations` table.

---

## General Procedure

```bash
# 1. Connect to the target database
psql $DATABASE_URL

# 2. Identify the last applied migration
SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 5;

# 3. Apply the reverse SQL (see group-specific scripts below)

# 4. Remove the migration record(s) from the tracking table
DELETE FROM drizzle_migrations
WHERE hash IN ('<hash-of-rolled-back-migration>');

# 5. Verify the schema matches the intended prior state
\dt
\d <affected_table>
```

The server reads `drizzle_migrations` on boot; after removing the record the migration will re-run on next deploy. Do **not** delete the SQL file from the repo.

---

## Migration Groups

### Group A — Core infra (0000–0004)

| Migration | Content |
|-----------|---------|
| 0000 | Audit enums + tables, person/session/account tables |
| 0001 | Verification/rate-limit tables |
| 0002 | Person extensions (consent JSONB, avatar) |
| 0003 | Organisation + branch tables |
| 0004 | Branch membership |

**Rollback impact:** Destructive — removes all user, org, and audit data. Only roll back in dev/staging. Production rollback of Group A is a full database reset.

```sql
-- Reverse 0004: branch membership
DROP TABLE IF EXISTS "branch_member";

-- Reverse 0003: org + branch
DROP TABLE IF EXISTS "branch";
DROP TABLE IF EXISTS "organisation";

-- Reverse 0002: person extensions (revert columns, keep table)
ALTER TABLE "person" DROP COLUMN IF EXISTS "marketing_consent";
ALTER TABLE "person" DROP COLUMN IF EXISTS "data_sharing_consent";
ALTER TABLE "person" DROP COLUMN IF EXISTS "sms_consent";
ALTER TABLE "person" DROP COLUMN IF EXISTS "email_consent";
ALTER TABLE "person" DROP COLUMN IF EXISTS "avatar_file_id";

-- Reverse 0001 + 0000: core auth tables
DROP TABLE IF EXISTS "verification";
DROP TABLE IF EXISTS "rate_limit";
DROP TABLE IF EXISTS "audit_log";
DROP TYPE IF EXISTS "audit_action";
DROP TYPE IF EXISTS "audit_category";
DROP TYPE IF EXISTS "audit_event_type";
DROP TYPE IF EXISTS "audit_outcome";
DROP TYPE IF EXISTS "audit_retention_status";
```

---

### Group B — Dental core (0005–0009)

| Migration | Content |
|-----------|---------|
| 0005 | Attachment, lab order, medical history, amendment types |
| 0006 | Dental patient table |
| 0007 | Fee schedule + line items |
| 0008 | Dental invoice + payment tables |
| 0009 | Notification tables |

```sql
-- Reverse 0009: notifications
DROP TABLE IF EXISTS "notification";

-- Reverse 0008: billing
DROP TABLE IF EXISTS "dental_payment";
DROP TABLE IF EXISTS "dental_invoice_line_item";
DROP TABLE IF EXISTS "dental_invoice";
DROP TYPE IF EXISTS "invoice_status";
DROP TYPE IF EXISTS "payment_method";

-- Reverse 0007: fee schedule
DROP TABLE IF EXISTS "fee_schedule_item";
DROP TABLE IF EXISTS "fee_schedule";

-- Reverse 0006: dental patient
DROP TABLE IF EXISTS "dental_patient";

-- Reverse 0005: types
DROP TYPE IF EXISTS "dental_attachment_image_type";
DROP TYPE IF EXISTS "lab_order_status";
DROP TYPE IF EXISTS "medical_history_entry_type";
```

---

### Group C — Clinical workspace (0010–0014)

| Migration | Content |
|-----------|---------|
| 0010 | Treatment template table |
| 0011 | Treatment plan + items |
| 0012 | Dental visit + tooth chart |
| 0013 | Prescriptions |
| 0014 | Lab orders |

```sql
-- Reverse 0014–0010 (reverse order):
DROP TABLE IF EXISTS "lab_order";
DROP TABLE IF EXISTS "prescription";
DROP TABLE IF EXISTS "dental_tooth_chart_entry";
DROP TABLE IF EXISTS "dental_visit";
DROP TYPE IF EXISTS "visit_status";
DROP TABLE IF EXISTS "dental_treatment_plan_item";
DROP TABLE IF EXISTS "dental_treatment_plan";
DROP TYPE IF EXISTS "treatment_status";
DROP TABLE IF EXISTS "dental_treatment_template";
```

---

### Group D — Scheduling + practitioners (0015–0019)

| Migration | Content |
|-----------|---------|
| 0015 | Practitioner roles |
| 0016 | Working hours |
| 0017 | Appointment table |
| 0018 | Appointment + visit link |
| 0019 | Scheduling constraints |

```sql
DROP TABLE IF EXISTS "dental_appointment_visit";
DROP TABLE IF EXISTS "dental_appointment";
DROP TYPE IF EXISTS "appointment_status";
DROP TABLE IF EXISTS "working_hours";
DROP TABLE IF EXISTS "practitioner_roles";
```

---

### Group E — Imaging v1.3 (0020–0024)

| Migration | Content |
|-----------|---------|
| 0020 | Imaging enums, annotation, finding tables |
| 0021 | Imaging study + image tables |
| 0022 | PMD (portable medical document) tables |
| 0023 | Imaging finding FK links |
| 0024 | Imaging index additions |

```sql
-- Reverse 0024: drop added indexes (recreated by 0023/0020 if re-run)
-- Indexes are non-destructive; skip unless causing conflicts.

-- Reverse 0023–0020:
DROP TABLE IF EXISTS "imaging_finding";
DROP TABLE IF EXISTS "imaging_pmd";
DROP TABLE IF EXISTS "imaging_image";
DROP TABLE IF EXISTS "imaging_study";
DROP TABLE IF EXISTS "imaging_annotation";
DROP TYPE IF EXISTS "imaging_annotation_type";
DROP TYPE IF EXISTS "imaging_status";
DROP TYPE IF EXISTS "imaging_modality";
DROP TYPE IF EXISTS "imaging_finding_type";
DROP TYPE IF EXISTS "imaging_finding_status";
```

---

### Group F — Domain consistency (0025)

| Migration | Content |
|-----------|---------|
| 0025 | `dental_appointment.procedure_type` → `service_type` column rename; enum value renames (camelCase → snake_case) |

**Rollback is destructive if data exists with the new enum values.**

```sql
-- Reverse column rename
ALTER TABLE "dental_appointment" RENAME COLUMN "service_type" TO "procedure_type";

-- Enum value renames require recreating the enum type.
-- Run only if the application is not in production or a full data migration is planned.
-- Contact the on-call engineer before applying in production.
```

---

### Group G — Ceph v1.4 (0026)

| Migration | Content |
|-----------|---------|
| 0026 | All ceph tables: analysis, landmarks, reports; ceph enums |

```sql
DROP TABLE IF EXISTS "imaging_ceph_report";
DROP TABLE IF EXISTS "imaging_ceph_landmark";
DROP TABLE IF EXISTS "imaging_ceph_analysis";
DROP TYPE IF EXISTS "ceph_analysis_type";
DROP TYPE IF EXISTS "ceph_calibration_method";
DROP TYPE IF EXISTS "ceph_landmark_source";
DROP TYPE IF EXISTS "ceph_landmark_status";
```

---

### Group H — Index cleanup (0028)

| Migration | Content |
|-----------|---------|
| 0028 | `DROP INDEX dental_appointment_no_double_book_idx` |

```sql
-- Reverse: recreate the dropped index
CREATE UNIQUE INDEX "dental_appointment_no_double_book_idx"
  ON "dental_appointment" ("branch_id", "practitioner_id", "scheduled_at")
  WHERE status NOT IN ('cancelled');
```

---

## Production Escalation Path

1. Identify which migration group introduced the regression.
2. Apply the reverse SQL in a **transaction** — test in staging first.
3. Remove the migration hash from `drizzle_migrations`.
4. Redeploy the prior server version (which expects the prior schema).
5. File a post-mortem and update this runbook with any group-specific lessons.

For Group A rollbacks or any rollback affecting >10k rows: page the on-call engineer and coordinate a maintenance window.
