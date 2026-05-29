# Compliance Report — dental-patient

---
Audit Date: 2026-05-30
Module Audited: dental-patient
Dimension: compliance (oli-check)
Spec Version: MODULE_SPEC 1.0 (validated against PRD v3-dentalemon)
Auditor: oli-check compliance subagent
---

## Scope & Method

Audited the dental-patient handler module exhaustively for the core spec surface:
all 10 MODULE_SPEC API endpoints + their handlers, repos, validators, the
generated route registration (`generated/openapi/routes.ts` — excluded from
findings but read to verify auth wiring), and the manual route block in
`app.ts`. Verified against MODULE_SPEC, ROLE_PERMISSION_MATRIX, API_CONTRACTS
(dental-patient), AUDIT_CONTRACTS, ERROR_TAXONOMY, and the codebase-map
(CODE_MODULE_MAP, CODE_ROUTE_MAP). `src/generated/` excluded from violation
findings per dimension rules.

The sub-feature handler families (alerts, contacts, insurance, recalls, sync,
tasks, treatment-plans — wired manually in app.ts:238-480) are NOT enumerated in
MODULE_SPEC (which defines BRs/ACs only for the core registry+safety-floor+
statement+follow-up+archive surface). They are treated as SPEC-GAP territory,
not violations, and were not deep-audited for spec compliance (no spec to audit
against). Frontend consumers and per-BR test-assertion grading were not covered.

## Key Architectural Finding (drives severity)

**Route layer does NOT enforce context roles.** Every dental-patient route in
`generated/openapi/routes.ts` (lines 880-971) and `app.ts` (lines 238-480) is
guarded only by `authMiddleware({ roles: ['user'] })` — the Better-Auth SYSTEM
role. Context-role authorization (dentist_owner / staff_full / staff_scheduling
etc.) is enforced SOLELY inside each handler via `assertBranchRole` /
`assertBranchAccess`. Therefore any handler that uses `assertBranchAccess`
(membership check, role-agnostic) where the matrix requires a role restriction
is a real, unmitigated authz gap — there is no route-layer backstop.

## Executive Summary

- **P0:** 0
- **P1:** 1
- **P2:** 2
- **P3:** 1
- Compliance rate (core surface): high — all business rules, acceptance
  criteria, state transitions, and audit-event contracts for the core surface
  are enforced. The single P1 is a role-granularity gap on patient creation.

## Verified COMPLIANT

| Spec Item | Enforced At | Status |
|---|---|---|
| BR-015 consent required -> 422 CONSENT_REQUIRED | createDentalPatient.ts:38 | OK |
| BR-015b archived read-only -> 403 PATIENT_ARCHIVED | updateDentalPatient.ts:35-37; followUpNotes.ts:67-69 | OK |
| BR-015c follow-up append-only (no edit/delete) | followUpNotes.ts exposes only GET list + POST append; NO PATCH/DELETE route exists in routes.ts (lines 937-950 register only list+add); addFollowUpNote.ts is a re-export shim | OK |
| BR-020 merge "not implemented" -> 501 | patient/mergePatients.ts:29-35 (501 NOT_IMPLEMENTED), admin-only at :19-21 | OK (merge wired but correctly stubbed) |
| AC-PAT-001 registration consent gate | createDentalPatient.ts:38 | OK |
| AC-PAT-002 archived = read-only | updateDentalPatient.ts:35-37; followUpNotes.ts:67-69 | OK |
| AC-PAT-003 safety-floor aggregation | getDentalPatient.ts:65-83 (counts); getDentalPatientSafetyFloor.ts:39-54 (full lists) | OK |
| AC-PAT-004 search branch-scoped | listDentalPatients.ts:30-56 (branchId required; strict filters.branchId; assertBranchRole on branch) | OK |
| State active->archived (owner only) | archiveDentalPatient.ts:37 | OK |
| State archived->active (owner only) | restoreDentalPatient.ts:34 | OK |
| Perm Archive = dentist_owner | archiveDentalPatient.ts:37 | OK |
| Perm Restore = dentist_owner | restoreDentalPatient.ts:34 | OK |
| Perm Bulk-archive = dentist_owner | bulkArchiveDentalPatients.ts:52-54 | OK |
| Perm Export = dentist_owner | exportDentalPatients.ts:56 | OK |
| Perm Update = owner/associate/hygienist/staff_full; archive-via-PATCH = owner | updateDentalPatient.ts:44,48 | OK |
| Perm Follow-up = staff_full/associate/owner | followUpNotes.ts:19,43,75 | OK |
| Perm List READ = 9 dental context roles (V-PAT-008 floor) | listDentalPatients.ts:35-45 | OK |
| Perm Merge = admin only | mergePatients.ts:19-21 | OK |
| V-PAT-002 branchless DENY (no guard bypass) | update:41, archive:34, restore:31, followUpNotes:40/72 throw ForbiddenError; regression test dental-patient-branchless-auth.test.ts | OK |
| V-PAT-009 already-archived -> 409 (not 422) | archiveDentalPatient.ts:58-59 | OK |
| V-PAT-014 no undeclared PII leak in profile | getDentalPatient.ts:118-126 returns declared person subset (does not spread full person row) | OK |
| AUDIT Create patient = CREATED | createDentalPatient.ts:75-82 (patient.registered) | OK |
| AUDIT View profile = READ | getDentalPatient.ts:87-93 (patient.view) | OK |
| AUDIT Archive = UPDATED | archiveDentalPatient.ts:68-77 (patient.archive) | OK |
| AUDIT Export = ACCESSED | exportDentalPatients.ts:74-81 (patient.export) | OK |
| AUDIT extra PHI READ (safety-floor, statement) | getDentalPatientSafetyFloor.ts:59-65; getDentalPatientStatement.ts:85-91 | OK |
| AUDIT PHI rule (metadata = IDs/counts only) | archive/export metadata carry reason/format/count — no names/DOB | OK |
| DE-021 PatientRegistered (audit-only per ADR-006) | createDentalPatient.ts:72-82 | OK |
| Import all-or-nothing tx + per-branch authz | importPatients.ts:124-161 | OK |
| Input validation: bulk-archive ids 1-50 / reason 5-500 | bulkArchiveDentalPatients.ts:21-24 | OK |
| Input validation: follow-up text 5-2000 | followUpNotes.ts:22-24 | OK |

## Violations

### P1 — Fix Before New Work

| ID | Category | Description | File:Line | Suggested Fix | Autofix |
|----|----------|-------------|-----------|---------------|---------|
| V-PAT-002 | Permissions (Step 5) — CONFIRMED gap (no route-layer role backstop) | `createDentalPatient` authorizes with `assertBranchAccess` (branch MEMBERSHIP, role-agnostic), not `assertBranchRole`. ROLE_PERMISSION_MATRIX + API_CONTRACTS DENY `staff_scheduling` from creating patients, but a `staff_scheduling` member of the branch passes `assertBranchAccess`. Route layer only checks `authMiddleware({roles:['user']})` (routes.ts:882), so there is no backstop. Separately, `importPatients` (importPatients.ts:126) grants create to `['dentist_owner','dentist_associate','staff_full']` while API_CONTRACTS declares import = `dentist_owner` only — broader than contract. | createDentalPatient.ts:45; importPatients.ts:126 | createDentalPatient: replace `assertBranchAccess(db, user.id, body.branchId)` with `assertBranchRole(db, user.id, body.branchId, ['dentist_owner','dentist_associate','staff_full'])` (mirroring updateDentalPatient.ts:44). importPatients: narrow role set to `['dentist_owner']` to match API_CONTRACTS, or amend the contract to record the broader intent. | false |

### P2 — Fix When Touching Module

| ID | Category | Description | File:Line | Suggested Fix | Autofix |
|----|----------|-------------|-----------|---------------|---------|
| V-PAT-001 | Error contract (Step 7) | `listDentalPatients` and `exportDentalPatients` return a hand-rolled `{ error: 'branchId is required' }` status 400, bypassing the ERROR_TAXONOMY §1 envelope `{ error:{code,message,details}, meta:{request_id,timestamp} }`. Missing `code`, `details`, and `meta`. Inconsistent with every other handler that throws typed errors. NOTE: branchId is already a required validator field, so these branches are largely defensive/unreachable, but the shape is still non-compliant. | listDentalPatients.ts:30-32; exportDentalPatients.ts:50-55 | Replace both ad-hoc 400 returns with `throw new ValidationError('branchId is required', { branchId: ['Required'] })` and let the global error middleware emit the canonical envelope. | true |
| V-PAT-005 | API contract shape (Step 8b) | `listDentalPatients` returns `{ data, pagination }`; the API_CONTRACTS header declares the collection envelope `{ data, meta }`. Pagination key name drifts from the documented standard collection shape used elsewhere. | listDentalPatients.ts:107 | Confirm the platform canonical collection envelope; if `meta` is canonical, wrap pagination under `meta` (or rename the key) for cross-module consistency. Low impact if `buildPaginationMeta` + `pagination` is the de-facto project convention — then update API_CONTRACTS instead. | false |

### P3 — Track

| ID | Category | Description | File:Line | Notes |
|----|----------|-------------|-----------|-------|
| V-PAT-010 | API contract path drift | API_CONTRACTS documents the follow-up route as `POST /:id/follow-up`; the wired route (routes.ts:945) and handler comments use `/:id/follow-up-notes`. The CODE is the truth; the CONTRACT doc is stale. | API_CONTRACTS.md line 170 vs routes.ts:945 | Update API_CONTRACTS path segment to `follow-up-notes` to match the implementation. |

## Spec Gaps (NOT code violations)

| Area | Gap | Recommendation |
|------|-----|----------------|
| Sub-feature handlers (alerts, contacts, insurance, recalls, sync, tasks, treatment-plans — app.ts:238-480, ~57 handlers) | MODULE_SPEC enumerates no BRs/ACs/permissions for these; they cannot be audited for spec compliance. | Extend MODULE_SPEC (or split into dedicated module specs) to define rules/permissions for these surfaces, then re-audit. |
| DE-008 InvoicePaid consumer | MODULE_SPEC §10b declares dental-patient CONSUMES DE-008 to update `has_active_payment_plan`, but no consumer was located in dental-patient (likely lives in dental-billing per ADR-006 audit-only model). | Confirm where `has_active_payment_plan` is synced; document the producer/consumer path. |

## Not Audited (out of this run's scope)

- Terminology (Step 6) — DOMAIN_GLOSSARY / DOMAIN_MODEL not loaded.
- Frontend consumers in apps/dentalemon/src (Steps 11b/11c/11d).
- Test assertion grading (Step 9b). 14 test files present, incl.
  dental-patient.test.ts (53KB), dental-patient-branchless-auth.test.ts,
  consent.fsm.property.test.ts, dental-patient.bulk-import.test.ts — strong
  existing coverage observed, not graded.
- Per-repo data-validation depth (Step 10) for sub-feature schemas (spec-gap).

## Health Score

| Dimension | Score (0-10) | Notes |
|-----------|-------------|-------|
| Business rule enforcement | 9 | BR-015/015b/015c/020 all enforced |
| Acceptance criteria coverage | 9 | AC-001..004 all enforced in code |
| Permission coverage | 6 | capped by V-PAT-002 (P1) — create role granularity; route layer has no role backstop |
| Error contract compliance | 7 | V-PAT-001 envelope drift (P2) |
| API contract compliance | 7 | V-PAT-005 key drift; import role set vs contract |
| State transition safety | 10 | active<->archived owner-gated + idempotent (409) |
| Audit logging compliance | 9 | all 4 AUDIT_CONTRACTS events + statement/safety-floor READ; PHI-safe metadata |

**Overall (audited dimensions):** ~8.1/10. **No P0.**

## What's Next

1. Fix V-PAT-002 (P1): swap `assertBranchAccess` -> `assertBranchRole` in
   createDentalPatient; reconcile importPatients role set with API_CONTRACTS.
2. Apply V-PAT-001 (P2, autofixable error-envelope fix).
3. Close spec gaps: add MODULE_SPEC rules for the sub-feature handler families,
   then re-audit alerts/contacts/insurance/recalls/sync/tasks/treatment-plans.
4. Update API_CONTRACTS follow-up path (V-PAT-010) and decide the collection
   envelope key (V-PAT-005).
