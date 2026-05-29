<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-module-specs (manual, EMR namespace re-scope Item #3) -->

# Module Specification: emr-consultation

---
Spec Version: 1.0 | Last Updated: 2026-05-29
implementation_status: implemented
handler_dir: services/api-ts/src/handlers/emr/
namespace: /emr
---

## 0. Naming Note (why this spec exists)

The handler directory `services/api-ts/src/handlers/emr/` ships a **telemedicine
consultation-notes** system, ported from the `monobase-mycure` upstream template.
For a period the word "EMR" was overloaded: this live code, versus a *planned,
unbuilt* external-record-import bridge. That bridge has been renamed to
**[external-records-import](../external-records-import/MODULE_SPEC.md)** and moved
to the `/dental/emr-import` namespace. This spec documents what the `emr` handler
**actually is** so enforcement maps the code to the right contract.

- **`emr` (this module)** → telemedicine consultation notes, namespace `/emr`,
  table `consultation_note`. **Implemented.**
- **`external-records-import`** → read-only third-party EMR/EHR import bridge,
  namespace `/dental/emr-import`, table `emr_record`. **Future phase (Phase 3+).**

These are distinct concerns with non-overlapping routes and tables.

---

## 1. Module Overview
**Purpose:** Clinical consultation documentation for minor-ailment / telemedicine
encounters. A provider records a consultation note (chief complaint, assessment,
plan, vitals, symptoms, prescriptions, follow-up) and optionally finalizes it.
Finalize is terminal — there is no amend-after-finalize workflow (see §8 and
V-EMR-001). Notes belong to a patient and the authoring provider.

**Users:** `provider` (create/update/finalize own notes), `patient` (read own
notes), `admin` (read all).

**Related (loose coupling, UUID refs only — no DB FKs):**
- `patient` — patient the note documents (via `patient-emr.facade`)
- `provider` — authoring provider (via `provider-emr.facade`)
- `person` — name/identity, surfaced only through the two facades above on `expand=person`

This module is a **platform-level** module (it consumes the generic
`patient`/`provider`/`person` primitives), not a `dental-*` domain module. The
active EMR for native dental visit/chart/treatment records is **`dental-visit`**.

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| Consultation Note | A documented clinical encounter; the aggregate root of this module |
| Context | Optional idempotency key (e.g. `appointment:123`, `walkin:456`); unique when present |
| Finalize | Lock a draft note as the authoritative record (sets `finalizedAt`/`finalizedBy`). Terminal — no amend-after-finalize (V-EMR-001) |

---

## 3. Workflows
- WF-EMRC-001: Provider creates a draft consultation note for a patient.
- WF-EMRC-002: Provider updates clinical fields on a draft note.
- WF-EMRC-003: Provider finalizes a draft note (terminal).
- WF-EMRC-004: ~~Provider amends a finalized note, then re-finalizes.~~ **STRUCK (V-EMR-001)** — no amend endpoint exists and finalize rejects non-draft notes, so this workflow was unreachable. Removed rather than built (lower-risk per audit). If amend-after-finalize is required later, re-introduce it with a dedicated `POST /emr/consultations/{id}/amend` endpoint + an `amendedBy`/lineage column.
- WF-EMRC-005: Patient/provider/admin reads a note, optionally expanding patient/provider/person.
- WF-EMRC-006: Provider lists the patients they have consulted (with consultation stats).

---

## 5. Business Rules
- A note is created in `draft` status.
- `context`, when supplied, is unique — a duplicate context is a conflict (`CHART_EXISTS`-style 409 at repo level / surfaced as create error).
- Only the authoring provider may update/finalize their own notes (`provider:owner`).
- Patients may read only their own notes; admins may read any.
- Finalizing a non-draft note is rejected (`CONSULTATION_NOT_DRAFT`, 422).
- Cross-module references (`patient`, `provider`, `finalizedBy`) are bare UUIDs — **no DB-level foreign keys** (loose coupling).

---

## 6. Permissions
| Operation | Roles |
|-----------|-------|
| Create | `provider` (self only) |
| List (consultations) | `provider` (own), `patient` (own), `admin` (all) |
| Read one | `admin`, `provider:owner`, `patient:owner` |
| Update | `provider:owner` |
| Finalize | `provider:owner` |
| List EMR patients | `provider` (own), `admin` |

---

## 7. Data Requirements
**`consultation_note`** (`emr.schema.ts`): id + base entity fields, `patient_id`
(uuid, loose), `provider_id` (uuid, loose), `tenant_id` (nullable — not the
isolation mechanism; see schema note), `context`, `chief_complaint`, `assessment`,
`plan`, `vitals` (jsonb), `symptoms` (jsonb), `prescriptions` (jsonb[]),
`follow_up` (jsonb), `external_documentation` (jsonb), `status`, `finalized_at`,
`finalized_by` (uuid, loose).

---

## 8. State Transitions
`draft → finalized` (**terminal**). `draft` is the only state from which finalize
is allowed; finalizing a non-draft note is rejected (`CONSULTATION_NOT_DRAFT`, 422).
The `amended` status value exists in the enum but is **reserved/unreachable** — no
endpoint produces it (V-EMR-001). The earlier
`draft → finalized → amended → finalized` re-finalizable machine was never built
and has been struck.

---

## 10. API Expectations
Namespace `/emr` (`specs/api/src/modules/emr.tsp`, `EMRModule`):
- `POST /emr/consultations` — createConsultation
- `GET /emr/consultations` — listConsultations
- `GET /emr/consultations/{consultation}` — getConsultation (`?expand=patient,provider,person`)
- `PATCH /emr/consultations/{consultation}` — updateConsultation
- `POST /emr/consultations/{consultation}/finalize` — finalizeConsultation
- `GET /emr/patients` — listEMRPatients

---

## 11. Acceptance Criteria
- **AC-EMRC-001:** Create returns a `draft` note owned by the authenticated provider.
- **AC-EMRC-002:** Finalize on a non-draft note → 422 `CONSULTATION_NOT_DRAFT`.
- **AC-EMRC-003:** A provider cannot read/update another provider's note → 403.
- **AC-EMRC-004:** `getConsultation?expand=patient,provider,person` returns nested
  patient and provider objects, each with a nested `person` — composed via the
  patient/provider facades (no direct cross-module schema access).

---

## 12b. Audit Logging

Every PHI create / read / mutation / bulk-read writes a `dental_audit_log` row via
`logAuditEvent` (in addition to the Pino `logger.info` trail):

| Operation | Audit action | Notes |
|-----------|--------------|-------|
| createConsultation | `emr.consultation.create` | V-EMR (existing) |
| getConsultation | `emr.consultation.read` | PHI read |
| updateConsultation | `emr.consultation.update` | V-EMR-003 — records changed field NAMES only, never PHI values |
| finalizeConsultation | `emr.consultation.finalize` | V-EMR-002 — locks authoritative record |
| listConsultations | `emr.consultation.list` | V-EMR-004 — PHI bulk read; records counts/filter scope only |
| listEMRPatients | `emr.patients.list` | V-EMR-004 — PHI bulk read; records counts/scope only |

**Verb convention (V-EMR-006):** EMR is a platform-level module with no rows in the
dental `AUDIT_CONTRACTS.md` (which is `dental-*`-only). It uses dotted-lowercase
`emr.<resource>.<verb>` action names rather than the dental `CREATED|READ|UPDATED`
verbs by design — this is the documented convention for this module, not drift.

**Tenant slot (V-EMR-005):** `consultation_note.tenant_id` is nullable and is NOT the
isolation mechanism. When null, the audit `tenantId` uses a non-PHI sentinel
(`EMR_AUDIT_TENANT_SENTINEL`, `emr-audit.ts`) — it never falls back to the patient
UUID (which would leak a PHI identifier into the append-only log).

---

## 14. Dependencies
**Internal (via facades only):** `patient` (`patient-emr.facade`), `provider`
(`provider-emr.facade`). `person` data is surfaced through those facades'
`*WithPerson` variants.
**Note:** No dependency on `dental-*` modules.

---

## 20. AI Instructions
1. Cross-module access is **facade-only** — never import `patient`/`provider`/`person`
   repos or schemas into `handlers/emr/` (MODULE_BOUNDARIES.md EX-004/005/006).
2. Field expansion is composed in the handler from facade results, not joined in `emr.repo`.
3. No DB-level FKs — UUID refs only.
4. Do not confuse with [external-records-import](../external-records-import/MODULE_SPEC.md)
   (the future `/dental/emr-import` bridge).
