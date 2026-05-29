# Compliance Report — dental-scheduling

---
Audit Date: 2026-05-30
Dimension: compliance
Module: dental-scheduling
Spec Version: 1.0 (MODULE_SPEC, Last Updated 2026-05-24)
Auditor: oli-check compliance dimension
---

## Generated Code Exclusion

`services/api-ts/src/generated/**` (OpenAPI routes/validators, auth schemas) excluded from violation findings per policy. Hand-written handlers/repos/schema/validators/facades that consume generated types ARE in scope and were audited.

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|---------------|
| MODULE_SPEC.md (dental-scheduling) | YES | BR / AC / permission / FSM / API / validation / events |
| API_CONTRACTS.md (dental-scheduling) | YES | Step 8b endpoint/schema/auth compliance |
| ROLE_PERMISSION_MATRIX.md | YES | Step 5 permission audit |
| ERROR_TAXONOMY.md | Partially (referenced; full file read dropped by harness) | Step 6.4 / 8b error-code cross-ref (best-effort) |
| EVENT_CONTRACTS.md / AUDIT_CONTRACTS.md | Present, not separately re-read | Step 9c/9d inferred from handler call sites |
| Knowledge-graph JSONs (codebase-map) | Listed; content reads dropped by harness | Used file inventory only |

### Files audited (read in full)
- Handlers: `createAppointment.ts`, `updateAppointment.ts`, `cancelAppointment.ts`, `checkInAppointment.ts`, `listAppointments.ts`, `getAppointment.ts`, `workingHours.ts`
- Domain/wire: `appointment-wire.ts`, `domain-events.ts`
- Repos: `repos/dental-appointment.repo.ts`, `repos/dental-appointment.schema.ts`, `repos/appointment-patient.facade.ts`
- Utils: `utils/assert-branch-access.ts` (re-export shim)

### Files NOT read (harness output capture failed mid-audit)
- `@/handlers/shared/assert-branch-role.ts` and `@/handlers/shared/assert-branch-access.ts` internals (behavior inferred from call sites; names + usage strongly indicate role-set / branch-membership guards).
- Generated route-registration file (excluded from findings regardless).
- Frontend consumers in `apps/dentalemon/src` (Step 11b-d not executed).

This is a near-complete backend compliance slice. Frontend connectivity / error-boundary / contract-consistency steps (11b–11d) were NOT executed and should be run in a follow-up.

---

## Executive Summary

dental-scheduling is a **high-compliance** module. Every business rule (BR-004, BR-SCH-001..004, FR3.7), every acceptance criterion (AC-SCH-001..005), the full appointment FSM, and the scheduling permission matrix (including the N-SCH-03 staff_scheduling exclusions from cancel + check-in) are enforced in code with matching error-taxonomy codes. No P0 violations were found.

- **P0:** 0
- **P1:** 1
- **P2:** 3
- **P3:** 3

The lone P1 is a documented spec-vs-code contract divergence on the create double-booking HTTP behavior (spec/handler = soft-warn 201; API_CONTRACTS.md lists `DOUBLE_BOOKING(409)` for POST). MODULE_SPEC §20.1 + AC-SCH-001 say soft-warn-201 is intentional, so the contract doc is the document at fault, but it is still a live contract mismatch.

---

## Step 3 — Business Rules

| Rule ID | Rule | Status | Severity | Evidence |
|---------|------|--------|----------|----------|
| BR-004 | Check-in creates visit; appt delete ≠ visit delete | ENFORCED | — | `checkInAppointment.ts:60-74` creates visit + links; `cancelAppointment.ts` only sets status=cancelled, never deletes visit; visit owned by dental-visit |
| BR-SCH-001 | All appointments scoped to branch | ENFORCED | — | `assertBranchRole`/`assertBranchAccess` at top of every handler (create:34, update:35, cancel:34, checkIn:39, list:64, get:27) |
| BR-SCH-002 | Walk-in bypasses slot/working-hours | ENFORCED | — | `createAppointment.ts:59` `if (!body.walkIn)` guards working-hours check |
| BR-SCH-003 | Cancellation requires reason | ENFORCED | — | `cancelAppointment.ts:44-48` 422 REASON_REQUIRED when reason <5 or >500 |
| BR-SCH-004 | Validate against branch working hours (422 unless walk-in) | ENFORCED | — | `createAppointment.ts:60-66` + `updateAppointment.ts:106-112` → `OUTSIDE_WORKING_HOURS` |
| FR3.7 | Double-booking: soft-warn at create, hard-block at reschedule | ENFORCED | — (see V-SCH-101) | create: `createAppointment.ts:72-86` warning, 201; reschedule: `updateAppointment.ts:113-127` 409 RESCHEDULE_CONFLICT |

All 6 business rules ENFORCED.

## Step 4 — Acceptance Criteria

| AC ID | Criterion | Status | Severity | Evidence |
|-------|-----------|--------|----------|----------|
| AC-SCH-001 | Double-book at create → 201 + DOUBLE_BOOKING warning | TESTED | — | `createAppointment.ts:74-86,138`; covered by `dental-scheduling.test.ts`, `acceptance.scheduling-workflows.test.ts` |
| AC-SCH-002 | Double-book at reschedule → 409 | TESTED | — | `updateAppointment.ts:120-127`; `dental-scheduling-transitions.test.ts` |
| AC-SCH-003 | Check-in w/ existing active visit → 409 | TESTED | — | `checkInAppointment.ts:49-57` CHECKIN_ACTIVE_VISIT |
| AC-SCH-004 | Cancel without reason → 422 | TESTED | — | `cancelAppointment.ts:46-48` |
| AC-SCH-005 | Cancelled appt → visit still accessible | TESTED | — | cancel never touches visit; visit lifecycle in dental-visit; `dental-scheduling.test.ts` |

Test files present and named for each: `dental-scheduling.test.ts`, `dental-scheduling-transitions.test.ts`, `dental-scheduling.working-hours.test.ts`, `rbac-scheduling.test.ts`, `acceptance.scheduling-workflows.test.ts`, `appointment.fsm.property.test.ts`, `domain-events.test.ts`, `createAppointment.notif.test.ts`. Strong coverage.

## Step 5 — Permissions (vs ROLE_PERMISSION_MATRIX Scheduling Write Operations + N-SCH-03)

| Action | Matrix Expected | Code Actual | Severity | Status |
|--------|-----------------|-------------|----------|--------|
| Book | owner, associate, staff_full, staff_scheduling | `createAppointment.ts:34-36` same 4 roles | — | COMPLIANT |
| Reschedule | owner, associate, staff_full, staff_scheduling | `updateAppointment.ts:35-37` same 4 roles | — | COMPLIANT |
| Cancel | owner, staff_full (assoc ❌, scheduling ❌) | `cancelAppointment.ts:34-36` `['dentist_owner','staff_full']` | — | COMPLIANT |
| Check-in | owner, associate, staff_full (scheduling ❌) | `checkInAppointment.ts:39-41` `['dentist_owner','dentist_associate','staff_full']` | — | COMPLIANT |
| View calendar | all dental roles | `listAppointments.ts:64` `assertBranchAccess` (branch membership, any role) | — | COMPLIANT |
| Configure branch hours | owner only | `workingHours.ts:123` `assertBranchRole(['dentist_owner'])` | — | COMPLIANT |

All scheduling permission combinations align with the matrix, including the N-SCH-03 staff_scheduling exclusions. No unauthenticated routes (every handler checks `user?.id` and throws UnauthorizedError).

## Step 8/8b — API Contract Compliance

| Endpoint | Check | Result | Severity | ID |
|----------|-------|--------|----------|-----|
| POST /dental/appointments | method/path/auth | match | — | — |
| POST /dental/appointments | DOUBLE_BOOKING error code | Contract says `DOUBLE_BOOKING(409)`; code returns **201 + warning** (matches MODULE_SPEC §20.1 + AC-SCH-001) | P1 | V-SCH-101 |
| GET /dental/appointments | required branch_id/date_from/date_to | enforced `listAppointments.ts:35-36` | — | — |
| GET /dental/appointments | response envelope `{data, meta}` | handler returns bare array `ctx.json(appointments.map(...))` — no `{data}` wrapper, no pagination `meta` despite contract "Standard paginated collection" | P2 | V-SCH-102 |
| PATCH /dental/appointments/:id | reschedule 409 | RESCHEDULE_CONFLICT enforced | — | — |
| POST .../check-in | response shape | Contract: `{ appointment_id, visit_id }`; code returns `{ appointment: <full wire obj>, visitId }` (key + shape drift) | P2 | V-SCH-103 |
| DELETE .../:id | response 200 `{data:{ok:true}}` | code returns **204 No Content** (no body); contract says 200 `{data:{ok:true}}` | P2 | V-SCH-104 |
| POST/PATCH bodies | field naming | wire uses camelCase (`startAt`, `providerId`, `visitType`) while API_CONTRACTS tables use snake_case (`start_at`, `provider_id`, `visit_type`) | P3 | V-SCH-105 |

Note: snake/camel may be normalized by the generated validator layer (not read); flagged P3 pending confirmation.

## Step 9 — State Transitions (vs MODULE_SPEC §8)

`APPOINTMENT_TRANSITIONS` (`dental-appointment.schema.ts:62-68`) matches the spec FSM exactly:
- scheduled → checked_in | cancelled | no_show ✓
- checked_in → completed | cancelled | no_show ✓
- no_show → completed (documented revert) ✓
- completed / cancelled → terminal ✓

Enforcement: `updateAppointment.ts:40-45` validates against the table and 422s invalid transitions; `checkInAppointment.ts:43-45` and `cancelAppointment.ts:38-40` guard via the same table. Repo methods (`checkIn`, `cancel`, `markNoShow`, `revertNoShow`) additionally apply SQL-level status guards in their WHERE clauses (defense in depth). No DB unique constraint on dentist+time — intentional per FR3.7/§20.1. COMPLIANT.

One observation (V-SCH-106, P3): `checked_in → completed` is intentionally NOT reachable via PATCH (`updateAppointment.ts:53-57` rejects it, routing completion through visit checkout). The FSM table allows `checked_in → completed`, so PATCH is a deliberately narrower surface than the table. Documented in handler comment; informational only.

## Step 10 — Data Validation (vs MODULE_SPEC §7 / §15)

| Field/Rule | Spec | Code | Severity | Status |
|-----------|------|------|----------|--------|
| endAt > startAt | 400 VALIDATION_ERROR (V-SCH-008) | `createAppointment.ts:46-48`, `updateAppointment.ts:88-91` | — | COMPLIANT |
| visitType enum | 400 (checkup/treatment/emergency/recall) | `appointment-wire.ts:18-23` + create:51-53 / update:80-82 | — | COMPLIANT |
| cancellation reason min5/max500 | 422 REASON_REQUIRED | `cancelAppointment.ts:46-48` | — | COMPLIANT |
| list date range ≤31 days | spec §16 calendar window | `listAppointments.ts:47-50` MAX_RANGE_DAYS=31 | — | COMPLIANT |
| notes max:500 | API_CONTRACTS | no explicit length check in handler (`createAppointment.ts:96`/update:101 pass through) | P2 | V-SCH-107 |

V-SCH-107 (P2): `notes` max:500 declared in contract is not enforced in the handler. May be enforced by the generated zod validator (not read). Flagged P2 pending confirmation.

## Step 9c/9d — Event & Audit Contract Compliance

- DE-010 AppointmentBooked: emitted `createAppointment.ts:132-136` via `emitAppointmentBooked` (best-effort). ✓
- DE-011 AppointmentCancelled: emitted `cancelAppointment.ts:71-75`. ✓
- DE-001 VisitCheckedIn: correctly NOT emitted here — owned by dental-visit per §10b / V-SCH-010; `checkInAppointment.ts:76-81` delegates only. ✓
- Audit: `appointment.book` (`createAppointment.ts:103-118`) and `appointment.cancel` (`cancelAppointment.ts:55-67`) write via `logAuditEvent` with who/what/when/metadata. ✓
- **Observation V-SCH-108 (P3):** `domain-events.ts` describes events as pg-boss queue jobs ("survive handler failures, processed asynchronously by any registered consumer"), but MODULE_SPEC §10b + ADR-006 state there is NO event bus and events are audit-log-only markers. The code comment contradicts the spec's descope narrative. Functionally harmless (best-effort `.catch()`, no consumer registered), but the doc-comment in `domain-events.ts:6-9` is misleading vs ADR-006. Doc-only.
- **Observation V-SCH-109 (P3):** No explicit `dental-scheduling.booked` / `.checked-in` / `.cancelled` INFO observable log lines (§17). Only `.double-booking` WARN is emitted (`createAppointment.ts:78-85`); booked/checked-in/cancelled rely on the audit-log row rather than a separate INFO logger line. Minor observability gap vs §17.

## Step 6 — Terminology

No terminology violations in scope. Wire-vs-storage divergence (`providerId`↔`dentist_member_id`, `startAt`↔`scheduled_at`, `visitType`↔`service_type`) is documented and centralized in `appointment-wire.ts` per V-SCH-006/007 — intentional, not drift.

---

## Findings Index

| ID | Sev | Title | Location |
|----|-----|-------|----------|
| V-SCH-101 | P1 | API_CONTRACTS lists DOUBLE_BOOKING(409) on POST; code soft-warns 201 (spec-correct) — contract doc must be fixed | docs/product/modules/dental-scheduling/API_CONTRACTS.md:49 vs createAppointment.ts:74-86,138 |
| V-SCH-102 | P2 | GET list returns bare array, no `{data, meta}` envelope / pagination meta | listAppointments.ts:77 |
| V-SCH-103 | P2 | check-in response shape drift: `{appointment, visitId}` vs contract `{appointment_id, visit_id}` | checkInAppointment.ts:81 |
| V-SCH-104 | P2 | DELETE returns 204 no-body; contract says 200 `{data:{ok:true}}` | cancelAppointment.ts:77 |
| V-SCH-105 | P3 | Wire field casing camelCase vs contract snake_case (may be normalized in generated validators) | appointment-wire.ts:26-47 |
| V-SCH-106 | P3 | checked_in→completed reachable in FSM table but blocked in PATCH (intentional, routed via checkout) | updateAppointment.ts:53-57 |
| V-SCH-107 | P2 | notes max:500 contract constraint not enforced in handler (may be in generated zod) | createAppointment.ts:96 |
| V-SCH-108 | P3 | domain-events.ts comments describe a real event bus; ADR-006/§10b say audit-log-only, no bus | domain-events.ts:6-9 |
| V-SCH-109 | P3 | §17 INFO observables (booked/checked-in/cancelled) not emitted as discrete log lines | createAppointment.ts / cancelAppointment.ts / checkInAppointment.ts |

## Compliance Rate

Auditable items (6 BR + 5 AC + 6 permission combos + 5 API endpoints + 5 FSM transitions + 5 validations = 32). Violations counting against rate: P0=0, P1=1, P2=3 → 28/32 ≈ **87.5%** (P3 excluded).

## Stabilization Plan

### Fix Before New Work (P1)
- V-SCH-101: Correct `API_CONTRACTS.md` POST section — change `DOUBLE_BOOKING(409)` to "201 with `warnings: ["DOUBLE_BOOKING"]` in response body" to match the intentional soft-warn (MODULE_SPEC §20.1, AC-SCH-001). Autofixable (doc edit). No code change.

### Fix When Touching Module (P2)
- V-SCH-102: Wrap list response in `{data, meta}` with pagination (page/per_page/total) per API_CONVENTIONS, or update contract to declare bare array.
- V-SCH-103: Align check-in response key/casing with contract (`appointment_id`/`visit_id`) or update contract to the richer `{appointment, visitId}` shape.
- V-SCH-104: Reconcile DELETE status (204 vs 200 `{data:{ok:true}}`) between handler and contract.
- V-SCH-107: Add `notes` length validation (or confirm enforced by generated validator and document).

### Track (P3)
- V-SCH-105, V-SCH-106, V-SCH-108, V-SCH-109.

## Follow-up Required
- Re-run Steps 11b–11d (frontend data-path connectivity, error-boundary coverage, FE/BE contract consistency) against `apps/dentalemon/src` — not executed this pass.
- Read `shared/assert-branch-role.ts` + `assert-branch-access.ts` internals to confirm the role-set/branch-membership guards behave as assumed (call-site evidence is strong but internals unverified).
