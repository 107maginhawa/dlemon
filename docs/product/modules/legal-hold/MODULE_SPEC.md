<!-- oli-version: 1.1 | generated: 2026-06-02 | skill: oli-module-specs (manual, F9 — anchor orphan-by-design governance code to a spec, TR-LH-001) -->

# Module Specification: legal-hold

---
Spec Version: 1.0 | Last Updated: 2026-06-02
implementation_status: implemented
handler_dir: services/api-ts/src/handlers/dental-legalhold/
namespace: /dental/legal-holds
---

## 0. Why this spec exists

The `dental-legalhold` handler has code + tests but no MODULE_SPEC, so traceability
flagged it as an orphan (**TR-LH-001**). This is a lightweight spec that anchors the
handlers, the `dental_legal_hold` table, and the legal-hold workflows to a contract
so the code→test chain resolves. It is **governance infrastructure**, not a product
feature surface — it has no patient-facing UI and is admin-only.

This module is **platform/governance-level** (it operates on the generic `person`
subject), not a clinical `dental-*` domain module, even though its routes and table
carry the `dental` prefix (legacy namespace alignment with the other compliance
tables).

---

## 1. Module Overview
**Purpose:** Suspend data-governance actions for a subject while litigation or an
investigation is pending. A legal hold is a durable record that the
[retention](../retention/MODULE_SPEC.md) engine and the erasure engine
(`dental-erasure`, WFG-006) **both consult**: a subject with an ACTIVE hold is never
auto-archived and never erased. Releasing the hold resumes normal schedules.

**Users:** `admin` only (place / list / release). No patient or clinician access.

**Related:**
- [retention](../retention/MODULE_SPEC.md) — the retention engine excludes legally-held records.
- `dental-erasure` (GDPR erasure, WFG-006) — erasure of a held subject is blocked.
- [dental-audit](../dental-audit/MODULE_SPEC.md) — every place/release writes a `compliance` audit event.

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| Legal Hold | A durable record that suspends retention + erasure for a subject person while litigation/investigation is pending |
| Subject | The `person` whose records are held (`subject_person_id`, UUID, no DB FK) |
| Place | Create an `active` hold (admin) |
| Release | Transition an `active` hold to `released` (admin); resumes normal schedules |

---

## 3. Workflows
> Not yet enumerated in WORKFLOW_MAP.md — these are the module's own workflows.

- **WF-LH-001: Place legal hold.** Admin places an `active` hold on a subject person
  (reason required). Audited as `legal_hold.placed`.
- **WF-LH-002: List legal holds.** Admin lists holds, filterable by `status`,
  `subjectPersonId`, `tenantId`.
- **WF-LH-003: Release legal hold.** Admin releases an `active` hold → `released`
  (records `releasedBy`/`releasedAt`). Audited as `legal_hold.released`. Releasing a
  non-active hold is rejected.
- **WF-LH-004 (consumed): Hold exemption.** The retention + erasure engines query
  active holds and exclude held subjects from any action (no endpoint — engine-side).

---

## 5. Business Rules
- A hold is created in `active` status.
- Only `admin` may place / list / release holds (handler-level RBAC; non-admin → 403).
- Releasing a non-`active` hold is rejected (`ValidationError`, "already released").
- An ACTIVE hold on a subject **blocks erasure** and **excludes the subject from
  retention** — enforced in the consuming engines, never bypassable by a policy edit.
- `subject_person_id`, `initiated_by`, `released_by` are bare UUIDs — **no DB-level
  foreign keys** (mirrors the audit/erasure decoupling).
- Every transition writes a `compliance`-category audit event.

---

## 6. Permissions
| Operation | Roles |
|-----------|-------|
| Place (`POST /dental/legal-holds`) | `admin` |
| List (`GET /dental/legal-holds`) | `admin` |
| Release (`POST /dental/legal-holds/{id}/release`) | `admin` |
| Delete | NEVER (no delete path) |

---

## 7. Data Requirements
**`dental_legal_hold`** (`legal-hold.schema.ts`): base entity fields + `tenant_id`
(uuid, not null), `branch_id` (uuid, nullable), `subject_person_id` (uuid, loose ref,
not null), `name` (text), `reason` (text), `status` (`legal_hold_status` enum:
`active` | `released`, default `active`), `initiated_by` (uuid), `released_by` (uuid,
nullable), `released_at` (timestamp, nullable), `note` (text, nullable). Indexed on
`tenant_id`, `subject_person_id`, `status`.

---

## 8. State Transitions
`active → released` (**terminal**). `active` is the only state from which release is
allowed; releasing a non-active hold is rejected.

---

## 10. API Expectations
Namespace `/dental/legal-holds` (`specs/api/src/modules/dental-legal-hold.tsp` →
`DentalLegalHoldMgmt`, codegen-registered — see `legal-hold-route-registration.test.ts`):

- `POST /dental/legal-holds` — `placeLegalHoldHandler` → 201, returns the hold.
  Body: `tenantId`, `subjectPersonId`, `name`, `reason`, optional `branchId`, `note`.
- `GET /dental/legal-holds` — `listLegalHoldsHandler` → 200, array. Query:
  `status?`, `subjectPersonId?`, `tenantId?`.
- `POST /dental/legal-holds/{id}/release` — `releaseLegalHoldHandler` → 200, returns
  the released hold.

> Responses are returned **un-wrapped** (`ctx.json(hold, ...)`), matching the
> governance handlers (not the dental `{ data, meta }` envelope).

---

## 10b. Domain Events / Audit
| Operation | Audit action | Category |
|-----------|--------------|----------|
| Place | `legal_hold.placed` | `compliance` |
| Release | `legal_hold.released` | `compliance` |

---

## 11. Acceptance Criteria
- **AC-LH-001:** A non-admin caller to any legal-hold endpoint → 403.
- **AC-LH-002:** Place returns an `active` hold owned by the tenant, with the
  subject/reason recorded; a `legal_hold.placed` audit event is written.
- **AC-LH-003:** Releasing an `active` hold sets `status=released`,
  `releasedBy`/`releasedAt`, and writes `legal_hold.released`.
- **AC-LH-004:** Releasing an already-released hold → validation error.
- **AC-LH-005:** A subject with an ACTIVE hold is excluded from retention and blocked
  from erasure (verified by `retention-legalhold.test.ts` /
  `erasure-legalhold.test.ts`).

---

## 14. Dependencies
**Internal:** [dental-audit](../dental-audit/MODULE_SPEC.md) (audit writer). Consumed
by [retention](../retention/MODULE_SPEC.md) and `dental-erasure`.
**External:** none.

---

## 20. AI Instructions
1. Admin-only — enforce RBAC at the handler layer on every endpoint.
2. No DB-level FKs — subject/actor references are bare UUIDs.
3. The hold is a hard gate consulted by retention + erasure engines — never add a
   bypass; the exemption lives in the consuming engines.
4. Every transition must write a `compliance` audit event.
5. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
