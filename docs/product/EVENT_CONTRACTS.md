<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: DOMAIN_MODEL.md §5, MODULE_SPEC.md ×10 -->

# Event Contracts — Dentalemon

> **⚠️ Transport note (per [ADR-006](../decisions/ADR-006-domain-events-descope.md)):** These
> events are **audit-log-only semantic markers** — there is **no event bus, no pg-boss queue, and
> no DLQ**. Each event is recorded synchronously via `logAuditEvent` by its producer (see
> [ADR-005](../decisions/ADR-005-audit-write-path.md)); the `dental-audit` consumer is satisfied
> inline. Reactive (`notifs`) consumers are **deferred to a future phase**. This catalog is kept
> intact as the canonical vocabulary and identifier contract for each fact — the "Delivery
> Guarantees" / pg-boss / DLQ descriptions below document the *original* design intent, not the
> implemented transport. Treat them as historical context superseded by ADR-006.

> Internal domain events delivered via **pg-boss** async queue.
> No external webhooks in Phase 1. Events are append-only — never mutated after emission.

---

## 1. Delivery Guarantees

| Property | Value |
|----------|-------|
| Transport | pg-boss (PostgreSQL-backed job queue) |
| Delivery guarantee | At-least-once |
| Idempotency | Consumers must be idempotent (event_id deduplication) |
| Retry policy | Exponential backoff: 3 retries at 30s / 5m / 30m |
| DLQ | `dental_event_dlq` table — events that exhausted retries |
| Ordering | Per-aggregate ordering preserved; cross-aggregate = best-effort |
| Retention | 7 years (HIPAA audit requirement) |
| PHI in payload | **NEVER** — include IDs only, no names/emails/clinical text |

---

## 2. Event Envelope

```typescript
interface DomainEvent<T = Record<string, unknown>> {
  event_id: string;       // ULID — globally unique
  event_type: string;     // EventName@version (e.g., "VisitCompleted@1")
  version: number;        // Integer, bumped on schema change
  aggregate_id: string;   // UUID of the root entity
  aggregate_type: string; // Entity name (e.g., "Visit", "Invoice")
  branch_id: string;      // Branch scope — always present
  actor_id: string;       // Person ID who triggered (or "system" for automated)
  occurred_at: string;    // ISO 8601 UTC timestamp
  payload: T;             // Event-specific data (see per-event schemas below)
}
```

---

## 3. Event Catalog (DE-001 – DE-024)

### DE-001 — `VisitCheckedIn@1`

| Field | Value |
|-------|-------|
| Trigger | Appointment check-in (`POST /dental/appointments/:id/check-in`) |
| Source context | Clinical Encounter |
| Aggregate | Visit |
| Consumers | dental-billing (open invoice check), dental-audit |

**Payload:**
```json
{
  "visit_id": "uuid",
  "patient_id": "uuid",
  "appointment_id": "uuid",
  "checked_in_at": "ISO8601"
}
```

---

### DE-002 — `VisitCompleted@1`

| Field | Value |
|-------|-------|
| Trigger | Dentist marks visit complete |
| Source context | Clinical Encounter |
| Aggregate | Visit |
| Consumers | dental-pmd (trigger eligible flag), dental-billing, dental-audit |

**Payload:**
```json
{
  "visit_id": "uuid",
  "patient_id": "uuid",
  "completed_at": "ISO8601",
  "treatment_count": 0
}
```

---

### DE-003 — `VisitLocked@1`

| Field | Value |
|-------|-------|
| Trigger | Scheduled pg-boss job (post-completion lock) |
| Source context | Clinical Encounter |
| Aggregate | Visit |
| Consumers | dental-audit |

**Payload:**
```json
{
  "visit_id": "uuid",
  "patient_id": "uuid",
  "locked_at": "ISO8601"
}
```

---

### DE-004 — `TreatmentDiagnosed@1`

| Field | Value |
|-------|-------|
| Trigger | Dentist adds treatment to chart |
| Source context | Clinical Encounter |
| Aggregate | Visit |
| Consumers | dental-billing (charge staging) |

**Payload:**
```json
{
  "visit_id": "uuid",
  "treatment_id": "uuid",
  "cdt_code": "D0150",
  "tooth_number": 14,
  "diagnosed_at": "ISO8601"
}
```

---

### DE-005 — `TreatmentPerformed@1`

| Field | Value |
|-------|-------|
| Trigger | Dentist marks treatment as performed |
| Source context | Clinical Encounter |
| Aggregate | Visit |
| Consumers | dental-billing (billable trigger), dental-audit |

**Payload:**
```json
{
  "visit_id": "uuid",
  "treatment_id": "uuid",
  "cdt_code": "D0150",
  "performed_at": "ISO8601"
}
```

---

### DE-006 — `TreatmentDismissed@1`

| Field | Value |
|-------|-------|
| Trigger | Dentist dismisses treatment |
| Source context | Clinical Encounter |
| Aggregate | Visit |
| Consumers | dental-billing (remove from staging) |

**Payload:**
```json
{
  "visit_id": "uuid",
  "treatment_id": "uuid",
  "cdt_code": "D0150",
  "dismissed_at": "ISO8601"
}
```

---

### DE-007 — `InvoiceCreated@1`

| Field | Value |
|-------|-------|
| Trigger | Staff creates invoice from visit |
| Source context | Billing |
| Aggregate | Invoice |
| Consumers | notifs (creation confirmation), dental-audit |

**Payload:**
```json
{
  "invoice_id": "uuid",
  "visit_id": "uuid",
  "patient_id": "uuid",
  "total_cents": 0,
  "created_at": "ISO8601"
}
```

---

### DE-008 — `InvoicePaid@1`

| Field | Value |
|-------|-------|
| Trigger | Payment recorded (full) or payment plan completed |
| Source context | Billing |
| Aggregate | Invoice |
| Consumers | notifs (receipt), dental-audit |

**Payload:**
```json
{
  "invoice_id": "uuid",
  "patient_id": "uuid",
  "paid_at": "ISO8601",
  "total_cents": 0,
  "payment_method": "string"
}
```

---

### DE-009 — `InvoiceVoided@1`

| Field | Value |
|-------|-------|
| Trigger | Dentist-Owner voids invoice |
| Source context | Billing |
| Aggregate | Invoice |
| Consumers | dental-audit |

**Payload:**
```json
{
  "invoice_id": "uuid",
  "voided_at": "ISO8601",
  "reason": "string"
}
```

---

### DE-010 — `AppointmentBooked@1`

| Field | Value |
|-------|-------|
| Trigger | Staff or patient books appointment |
| Source context | Clinical Encounter |
| Aggregate | Appointment |
| Consumers | notifs (confirmation email/push), dental-audit |

**Payload:**
```json
{
  "appointment_id": "uuid",
  "patient_id": "uuid",
  "provider_id": "uuid",
  "start_at": "ISO8601",
  "end_at": "ISO8601"
}
```

---

### DE-011 — `AppointmentCancelled@1`

| Field | Value |
|-------|-------|
| Trigger | Staff or patient cancels |
| Source context | Clinical Encounter |
| Aggregate | Appointment |
| Consumers | notifs, dental-audit |

**Payload:**
```json
{
  "appointment_id": "uuid",
  "patient_id": "uuid",
  "cancelled_at": "ISO8601",
  "reason": "string"
}
```

---

### DE-012 — `ConsentSigned@1`

| Field | Value |
|-------|-------|
| Trigger | Patient signs consent form |
| Source context | Clinical Encounter |
| Aggregate | ConsentForm |
| Consumers | dental-audit |

**Payload:**
```json
{
  "consent_form_id": "uuid",
  "visit_id": "uuid",
  "patient_id": "uuid",
  "signed_at": "ISO8601",
  "form_type": "string"
}
```

---

### DE-013 — `ConsentRevoked@1`

| Field | Value |
|-------|-------|
| Trigger | Patient revokes consent |
| Source context | Clinical Encounter |
| Aggregate | ConsentForm |
| Consumers | dental-audit |

**Payload:**
```json
{
  "consent_form_id": "uuid",
  "visit_id": "uuid",
  "patient_id": "uuid",
  "revoked_at": "ISO8601"
}
```

---

### DE-014 — `LabOrderCreated@1`

| Field | Value |
|-------|-------|
| Trigger | Dentist creates lab order |
| Source context | Clinical Encounter |
| Aggregate | LabOrder |
| Consumers | dental-audit |

**Payload:**
```json
{
  "lab_order_id": "uuid",
  "visit_id": "uuid",
  "patient_id": "uuid",
  "lab_name": "string",
  "created_at": "ISO8601"
}
```

---

### DE-015 — `LabOrderCompleted@1`

| Field | Value |
|-------|-------|
| Trigger | Lab marks order complete |
| Source context | Clinical Encounter |
| Aggregate | LabOrder |
| Consumers | notifs (dentist alert), dental-audit |

**Payload:**
```json
{
  "lab_order_id": "uuid",
  "visit_id": "uuid",
  "completed_at": "ISO8601"
}
```

---

### DE-016 — `PrescriptionWritten@1`

| Field | Value |
|-------|-------|
| Trigger | Dentist writes prescription |
| Source context | Clinical Encounter |
| Aggregate | Prescription |
| Consumers | dental-audit |

**Payload:**
```json
{
  "prescription_id": "uuid",
  "visit_id": "uuid",
  "patient_id": "uuid",
  "written_at": "ISO8601"
}
```

---

### DE-017 — `PMDGenerated@1`

| Field | Value |
|-------|-------|
| Trigger | PMD generation after visit completion |
| Source context | Records |
| Aggregate | PMDDocument |
| Consumers | notifs (patient download link), dental-audit |

**Payload:**
```json
{
  "pmd_id": "uuid",
  "visit_id": "uuid",
  "patient_id": "uuid",
  "generated_at": "ISO8601",
  "download_token": "string"
}
```

---

### DE-018 — `ImagingStudyUploaded@1`

| Field | Value |
|-------|-------|
| Trigger | DICOM/image file upload |
| Source context | Imaging |
| Aggregate | ImagingStudy |
| Consumers | dental-audit |

**Payload:**
```json
{
  "study_id": "uuid",
  "patient_id": "uuid",
  "modality": "string",
  "image_count": 0,
  "uploaded_at": "ISO8601"
}
```

---

### DE-019 — `ImagingFindingConfirmed@1`

| Field | Value |
|-------|-------|
| Trigger | Annotation state → confirmed |
| Source context | Imaging |
| Aggregate | ImagingAnnotation |
| Consumers | dental-clinical (safety floor reference), dental-audit |

**Payload:**
```json
{
  "finding_id": "uuid",
  "study_id": "uuid",
  "patient_id": "uuid",
  "confirmed_at": "ISO8601"
}
```

---

### DE-020 — `CephAnalysisComputed@1`

| Field | Value |
|-------|-------|
| Trigger | Math engine computation complete |
| Source context | Imaging |
| Aggregate | CephAnalysis |
| Consumers | dental-audit |

**Payload:**
```json
{
  "analysis_id": "uuid",
  "study_id": "uuid",
  "patient_id": "uuid",
  "computed_at": "ISO8601",
  "measurement_count": 0
}
```

---

### DE-021 — `PatientRegistered@1`

| Field | Value |
|-------|-------|
| Trigger | Staff creates patient record |
| Source context | Patient Management |
| Aggregate | Patient |
| Consumers | dental-audit, notifs (welcome) |

**Payload:**
```json
{
  "patient_id": "uuid",
  "branch_id": "uuid",
  "registered_at": "ISO8601"
}
```

---

### DE-022 — `MembershipAssigned@1`

| Field | Value |
|-------|-------|
| Trigger | Owner adds staff member |
| Source context | Identity & Access |
| Aggregate | DentalMembership |
| Consumers | notifs (welcome email), dental-audit |

**Payload:**
```json
{
  "membership_id": "uuid",
  "branch_id": "uuid",
  "role": "string",
  "assigned_at": "ISO8601"
}
```

---

### DE-023 — `MembershipRevoked@1` [INFERRED]

| Field | Value |
|-------|-------|
| Trigger | Owner removes staff member |
| Source context | Identity & Access |
| Aggregate | DentalMembership |
| Consumers | dental-audit, session revoke |

**Payload:**
```json
{
  "membership_id": "uuid",
  "branch_id": "uuid",
  "revoked_at": "ISO8601"
}
```

---

### DE-024 — `PatientMergeRequested@1` [INFERRED — NOT IMPLEMENTED]

Stub. `POST /dental/patients/merge` returns 501. Event reserved for future.

---

## 3b. Publisher Audit-Trace Status (TR-P1-04)

Per ADR-006 each event is an **audit-log-only semantic marker**: its "publisher" is the
producer writing a synchronous `dental_audit_log` row (action string below) via
`logAuditEvent`. The table records which events have an *audit-row publisher trace test*
(`handlers/*/*-events.test.ts`, keyed by exact `DE-0xx` ID). DE-001..016 were already
traced; DE-017..022 are added this cycle; DE-021/023/024 are documented as
deferred/inferred below.

| Event | Producer (handler) | Audit action | Trace test | Status |
|-------|--------------------|--------------|-----------|--------|
| DE-017 PMDGenerated | `dental-pmd/generatePMD.ts` | `pmd.generated` | `dental-pmd/dental-pmd-events.test.ts` | ✅ TRACED |
| DE-018 ImagingStudyUploaded | `dental-imaging/createImagingStudy.ts` | `imaging_study.create` | `dental-imaging/dental-imaging-events.test.ts` | ✅ TRACED |
| DE-019 ImagingFindingConfirmed | `dental-imaging/updateFinding.ts` | `imaging_finding.confirmed` | `dental-imaging/dental-imaging-events.test.ts` | ✅ TRACED |
| DE-020 CephAnalysisComputed | `dental-imaging/recomputeCephAnalysis.ts` | `imaging_ceph_analysis.computed` | `dental-imaging/dental-imaging-events.test.ts` | ✅ TRACED |
| DE-021 PatientRegistered | `patient/createPatient.ts` | _(none — Pino `info` only)_ | — | ⚠️ DEFERRED |
| DE-022 MembershipAssigned | `dental-org/createMember.ts` (+ routed `DentalMembershipManagement_create.ts`) | `membership.create` | `dental-org/dental-org-events.test.ts` (+ `membership-audit-regression.test.ts`) | ✅ TRACED |
| DE-023 MembershipRevoked `[INFERRED]` | `dental-org/deactivateMember.ts` (+ routed `_deactivate.ts`) | `membership.deactivate` | `membership-audit-regression.test.ts` (action-keyed, not DE-ID-keyed) | ⚠️ INFERRED |
| DE-024 PatientMergeRequested `[INFERRED — NOT IMPLEMENTED]` | `POST /dental/patients/merge` → 501 stub | _(no producer — 501)_ | — | ⛔ NOT IMPLEMENTED |

**DE-021 (DEFERRED):** the `dental-patient` MODULE_SPEC §Events states DE-021 is "written as
a `patient.registered` audit row", but `createPatient.ts` currently emits only a Pino
`logger.info({ action: 'create' })` line — it does **not** write a `dental_audit_log`
row. There is therefore no audit-row marker to assert against, so no publisher-trace test
can be added without first introducing that producer (a behavior change). Wiring a
`patient.registered` audit write is tracked as a follow-up; until then DE-021 has no
audit-row publisher and is intentionally untraced.

**DE-023 (INFERRED):** the deactivate path (`membership.deactivate`) is the closest
existing producer and is already audit-locked by `membership-audit-regression.test.ts`,
but the `MembershipRevoked@1` event itself is `[INFERRED]` (not a first-class implemented
event) so it is not given a dedicated DE-ID-keyed trace test.

**DE-024 (NOT IMPLEMENTED):** the merge endpoint returns 501; no producer exists, so no
audit-row marker and no trace test are possible until the feature ships.

---

## 4. Consumer Subscription Table

| Consumer | Subscribes to |
|----------|-------------|
| dental-billing | DE-001, DE-004, DE-005, DE-006 |
| dental-pmd | DE-002 |
| dental-audit | ALL (DE-001 through DE-023) |
| notifs | DE-007, DE-008, DE-010, DE-011, DE-015, DE-017, DE-021, DE-022 |
| dental-clinical | DE-019 |

---

## 5. DLQ Handling

Events in `dental_event_dlq` after 3 retries:
- Alert: Pino structured log at `level: error` with full event envelope
- Operations: manual replay via `pg-boss` admin job
- PHI check: DLQ entries audited for accidental PHI inclusion (G-005 fix)

---

## 6. Event Schema Evolution

| Change type | Version bump? | Notes |
|-------------|--------------|-------|
| Add optional field | NO | Backward compatible |
| Rename field | YES | Bump version, run dual-publish during migration |
| Remove field | YES | Bump version |
| Change field type | YES | Always bump |
