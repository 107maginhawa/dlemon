# Dental Visit Module Specification

**Module:** `dental-visit`
**Version:** 1.0
**Status:** Implemented (partial — see Known Gaps)

## Overview

The dental-visit module is the central clinical encounter record. It anchors the per-visit dental chart, SOAP notes, and treatment recordings. A visit progresses through a strict linear state machine (`draft → active → completed → locked`). All clinical sub-resources (chart, treatments, notes) hang off the visit and become immutable once the visit reaches `completed` or `locked`.

## Schema

### Tables

| Table | Purpose |
|-------|---------|
| `dental_visit` | Visit container: patient, branch, dentist, status, timestamps |
| `dental_treatment` | Individual treatment line items recorded during or planned for a visit |
| `visit_notes` | SOAP notes authored by a clinician for a visit |
| `dental_chart` | Full-mouth tooth state snapshot attached to a visit |
| `treatment_template` | Reusable treatment protocol definitions (not visit-scoped) |

### `dental_visit`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `patient_id` | UUID | NOT NULL, FK → patients |
| `branch_id` | UUID | NOT NULL, FK → dental_branches |
| `dentist_member_id` | UUID | NOT NULL, FK → dental_memberships |
| `status` | enum | NOT NULL, default `draft` |
| `activated_at` | timestamptz | nullable |
| `completed_at` | timestamptz | nullable |
| `locked_at` | timestamptz | nullable |
| `chief_complaint` | text | nullable |

**Unique index:** `(patient_id, status) WHERE status = 'active'` — enforces at most one active visit per patient across all branches.

**Visit status enum:** `draft | active | completed | locked`

### `dental_treatment`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `visit_id` | UUID | NOT NULL, FK → dental_visit ON DELETE CASCADE |
| `patient_id` | UUID | NOT NULL |
| `tooth_number` | integer | nullable |
| `surfaces` | JSONB (`string[]`) | nullable |
| `cdt_code` | text | NOT NULL |
| `description` | text | NOT NULL |
| `condition_code` | text | nullable |
| `status` | enum | NOT NULL, default `diagnosed` |
| `dismiss_reason` | text | nullable |
| `price_cents` | integer | NOT NULL — locked at recording time |
| `carried_over` | boolean | NOT NULL, default `false` |
| `source_visit_id` | UUID | nullable — origin visit if carried over |
| `auto_dismissed` | boolean | nullable |

**Treatment status enum:** `diagnosed | planned | performed | verified | dismissed`

### `visit_notes`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `visit_id` | UUID | NOT NULL, FK → dental_visit ON DELETE CASCADE |
| `author_member_id` | UUID | NOT NULL, FK → dental_memberships |
| `subjective` | text | nullable |
| `objective` | text | nullable |
| `assessment` | text | nullable |
| `plan` | text | nullable |
| `notes` | text | nullable |

### `dental_chart`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `visit_id` | UUID | NOT NULL, FK → dental_visit ON DELETE CASCADE |
| `patient_id` | UUID | NOT NULL |
| `teeth` | JSONB (`ToothChartState[]`) | NOT NULL |

**ToothChartState shape:**
```typescript
{
  toothNumber: number;
  state: ToothState;
  surfaces?: ToothSurface[];
  conditionCode?: string;
  note?: string;
}
```

**Tooth state enum:** `healthy | caries | fractured | filled | crown | missing | implant | extracted | watchlist`

**Tooth surface enum:** `mesial | distal | buccal | lingual | occlusal | incisal | cervical`

### `treatment_template`

Stores reusable treatment protocols that can be applied to a visit via `applyTemplate`. Not visit-scoped — shared across the branch.

---

## State Machines

### SM-01: Visit Status

```
draft → active → completed → locked
```

- Transitions are strictly linear. No reversal at any step.
- Source of truth: `VISIT_TRANSITIONS` constant in `visit.schema.ts`.
- `activated_at`, `completed_at`, `locked_at` are stamped at the moment of each transition.

### SM-02: Treatment Status

```
diagnosed → planned → performed → verified
          ↘         ↘           ↘          ↘
           dismissed  dismissed   dismissed   dismissed
```

- `dismissed` is terminal — no further transitions.
- All non-terminal states can reach `dismissed` directly.
- Source of truth: `TREATMENT_TRANSITIONS` constant in `visit.schema.ts`.

---

## Business Rules

### BR-001: One active visit per patient

**Rule:** No patient may have more than one visit in `active` status at any point in time (across all branches).

**Implementation:** Enforced at two layers:
1. Database: unique partial index on `(patient_id, status) WHERE status = 'active'`.
2. Handler: `createDentalVisit` checks for an existing active visit before insert. Conflict returns HTTP **409**.

---

### BR-002: Visit state is strictly linear

**Rule:** Visit status advances only forward: `draft → active → completed → locked`. No reversal or skip.

**Implementation:** `updateDentalVisit` validates the requested `status` against `VISIT_TRANSITIONS[currentStatus]`. Invalid transitions throw `BusinessLogicError` (HTTP 422).

---

### BR-003: Visit is immutable after `completed`

**Rule:** Once a visit reaches `completed` or `locked`, no chart entries, treatments, SOAP notes, prescriptions, or lab orders may be added, edited, or deleted.

**Implementation:** All write handlers for `dental_treatment`, `dental_chart`, and `visit_notes` check `visit.status` before applying changes. If `status` is `completed` or `locked`, the handler throws `BusinessLogicError` (HTTP 422).

---

### BR-005: Auto-discard draft visit with no clinical data

**Rule:** A `draft` visit with no chart snapshot and no treatment recorded at end of session should be automatically discarded to prevent ghost visit accumulation.

**Implementation:** **Not implemented — deferred to v1.3.** No session-expiry or cleanup job exists. Draft visits persist indefinitely.

---

### BR-006: Treatment state is forward-only

**Rule:** Treatment status advances only forward per `TREATMENT_TRANSITIONS`. `dismissed` is terminal; no reversal from any state.

**Implementation:** `TREATMENT_TRANSITIONS` is defined. Handler enforcement is **partial** — the state machine constant exists but not all transition paths have been validated in `updateDentalTreatment`. Full enforcement is a known gap (see Known Gaps).

---

### BR-007: Completed treatment is immutable

**Rule:** Once a treatment reaches `performed` or `verified`, the clinical fields (`cdt_code`, `tooth_number`, `surfaces`, `price_cents`) cannot be modified. Only status advancement is permitted.

**Implementation:** `updateDentalTreatment` checks current treatment status before allowing field updates. Mutation of locked fields throws `BusinessLogicError` (HTTP 422).

**Note:** `price_cents` is locked at the moment the treatment is first recorded, not at `performed`. This prevents price-list changes from retroactively altering historical charges.

---

### BR-008: Carried-over treatments are indicators only

**Rule:** Treatments from a prior visit's treatment plan that are flagged `carried_over = true` are surfaced as visual indicators in the current visit. They do not automatically appear as billable line items — the dentist must explicitly record them.

**Implementation:** `carryOverTreatments` creates `dental_treatment` rows with `carried_over = true` and `source_visit_id` pointing to the originating visit. The frontend renders these with a distinct visual state. Billing handlers exclude `carried_over = true` rows from invoice generation until explicitly promoted by the dentist.

---

## Permission Matrix

| Operation | Dentist Owner | Dentist Associate | Hygienist | Front Desk |
|-----------|:---:|:---:|:---:|:---:|
| `createDentalVisit` | Yes | Yes | Yes | Yes |
| `getDentalVisit` | Yes | Yes | Yes | Yes |
| `listDentalVisits` | Yes | Yes | Yes | Yes |
| `updateDentalVisit` (status transition) | Yes | Yes | No | No |
| `updateDentalVisit` (chiefComplaint) | Yes | Yes | Yes | No |
| `createDentalTreatment` | Yes | Yes | No | No |
| `listDentalTreatments` | Yes | Yes | Yes | Yes |
| `updateDentalTreatment` | Yes | Yes | No | No |
| `upsertDentalChart` | Yes | Yes | Yes | No |
| `getDentalChart` | Yes | Yes | Yes | Yes |
| `upsertVisitNotes` | Yes | Yes | Yes | No |
| `getVisitNotes` | Yes | Yes | Yes | No |
| `carryOverTreatments` | Yes | Yes | No | No |
| `applyTemplate` | Yes | Yes | No | No |
| `createTreatmentTemplate` | Yes | No | No | No |
| `updateTreatmentTemplate` | Yes | No | No | No |
| `deleteTreatmentTemplate` | Yes | No | No | No |
| `listTreatmentTemplates` | Yes | Yes | Yes | No |

**Default-deny:** Any role not listed as "Yes" receives `ForbiddenError` (HTTP 403).

**Note:** `createDentalVisit` is open to any branch member because front-desk staff create visits on patient check-in.

---

## API Endpoints

| Method | Path | Handler | BR |
|--------|------|---------|----|
| POST | `/dental/visits` | createDentalVisit | BR-001 |
| GET | `/dental/visits` | listDentalVisits | — |
| GET | `/dental/visits/:visitId` | getDentalVisit | — |
| PATCH | `/dental/visits/:visitId` | updateDentalVisit | BR-002, BR-003 |
| POST | `/dental/visits/:visitId/treatments` | createDentalTreatment | BR-003 |
| GET | `/dental/visits/:visitId/treatments` | listDentalTreatments | — |
| PATCH | `/dental/visits/:visitId/treatments/:treatmentId` | updateDentalTreatment | BR-006, BR-007 |
| POST | `/dental/visits/:visitId/chart` | upsertDentalChart | BR-003 |
| GET | `/dental/visits/:visitId/chart` | getDentalChart | — |
| PATCH | `/dental/visits/:visitId/chart/tooth` | updateTooth | BR-003 |
| GET | `/dental/visits/:visitId/notes` | getVisitNotes | — |
| POST | `/dental/visits/:visitId/notes` | upsertVisitNotes | BR-003 |
| GET | `/dental/patients/:patientId/treatment-plan` | getTreatmentPlan | — |
| POST | `/dental/visits/:visitId/carry-over` | carryOverTreatments | BR-008 |
| GET | `/dental/patients/:patientId/tooth-history` | getToothHistory | — |
| POST | `/dental/treatment-templates` | createTreatmentTemplate | — |
| GET | `/dental/treatment-templates` | listTreatmentTemplates | — |
| PATCH | `/dental/treatment-templates/:templateId` | updateTreatmentTemplate | — |
| DELETE | `/dental/treatment-templates/:templateId` | deleteTreatmentTemplate | — |
| POST | `/dental/visits/:visitId/apply-template` | applyTemplate | BR-003 |
| POST | `/dental/visits/:visitId/initialize-dentition` | initializeDentition | BR-003 |

---

## TypeSpec Source

`specs/api/src/modules/dental-visit.tsp`

---

## Dependencies

- `dental_patients` — `patient_id` FK source
- `dental_branches` — `branch_id` FK source; all visit endpoints implicitly scoped to branch
- `dental_memberships` — `dentist_member_id` FK; permission role resolution
- `dental_billing` — invoice generation reads `dental_treatment` rows with `status = 'performed'` and `carried_over = false`
- `@/handlers/shared/assert-branch-access` — branch isolation (should be applied to all visit endpoints)

---

## Known Gaps

| ID | Description | Severity | Target |
|----|-------------|----------|--------|
| BR-005 | Auto-discard of empty draft visits not implemented. Ghost drafts accumulate. | Low | v1.3 |
| BR-006 | `TREATMENT_TRANSITIONS` constant defined but not fully enforced in `updateDentalTreatment` — not all invalid transition paths throw 422. | Medium | v1.3 |
| Permission matrix | Role gates are not uniformly applied across all handlers. Some endpoints accept any authenticated branch member regardless of role. | Medium | v1.3 |
| Branch isolation | `assertBranchAccess` is not confirmed to be called in every handler — audit pending. | Medium | v1.3 |
| `initializeDentition` | Handler exists but behavior (adult vs. pediatric dentition, idempotency) is undocumented. | Low | v1.3 |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-19 | 1.0 | Initial spec — visit + treatment state machines, all 5 tables, BR-001–BR-008, permission matrix, 21 endpoints |
