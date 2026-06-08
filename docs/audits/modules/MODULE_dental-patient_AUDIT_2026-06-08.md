# Module Audit — dental-patient

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — 3 real cross-tenant PHI holes fixed (TDD), 1 stub-status fix, registry/doc drift reconciled; gates green.

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-patient/` | ✅ present (subdirs: identity, treatment-plans, insurance, recalls, contacts, alerts, household, consent, engagement, sync, case-presentation, jobs, repos, utils) |
| TypeSpec | `dental-patient.tsp` + `dental-patient-engagement.tsp` + `dental-patient-finance.tsp` | ✅ present |
| MODULE_SPEC / API_CONTRACTS | `docs/product/modules/dental-patient/` | ✅ present |
| Tests | 39 `*.test.ts` (40 incl. patient-merge in platform `patient/`) | ✅ present |
| Merge/unmerge handlers | `services/api-ts/src/handlers/patient/` (platform module, NOT dental-patient) | ✅ — br-registry source path was wrong (fixed) |

**/module-review result:** PASS — no `test.skip`/`xtest`, no `Not implemented` stubs in handler code (the lone `throw new Error('Not implemented')` was in the **platform** `patient/unmergePatients.ts`, now fixed), no TODO/FIXME, repos present, 1 boundary-justified `as any` in non-test code.

---

## STEP 6 — Traceability Matrix (representative; full evidence in §audit-notes)

| Item | Spec? | Impl? | KG | Test (file:line) | Strength | Verdict |
|------|-------|-------|----|-----------------|----------|---------|
| **BR-015** consent required → 422 CONSENT_REQUIRED | ✅ | ✅ createDentalPatient.ts:38 | NONE | createDentalPatient.test.ts:170; dental-patient.test.ts:927 | VERIFIED | 🟢 |
| **V-PAT-004** single-consent JSONB `{registrationConsent,capturedAt}` | ✅ | ✅ createDentalPatient.ts:69 | NONE | (HTTP shape only; no DB read-back) | WEAK | 🟡 |
| **BR-015b** archived → 403 PATIENT_ARCHIVED | ✅ | ✅ updateDentalPatient.ts:35; followUpNotes.ts:63; createRecall | NONE | dental-patient.test.ts:1282-1350 | VERIFIED (3 paths); sub-resources unguarded | 🟡 |
| **BR-015c** follow-up notes append-only | ✅ | ✅ routes register GET+POST only | NONE | (structural; no 405 test) | WEAK | 🟡 |
| **AC-PAT-003** safety-floor aggregation (2 allergies+1 med) | ✅ | ✅ getDentalPatientSafetyFloor.ts:40 | NONE | dental-patient-records.test.ts:340; dental-patient.test.ts:351 | VERIFIED (exact counts) | 🟢 |
| **AC-PAT-004** search branch-scoped (cross-branch excluded) | ✅ | ✅ listDentalPatients.ts | NONE | list-branch-isolation.test.ts:71; dental-patient.test.ts:1223 | VERIFIED (negative asserted) | 🟢 |
| **BR-020** merge/unmerge deferred → 501 | ✅ | ✅ patient/mergePatients.ts (501); unmergePatients.ts (**was 500 → now 501**) | NONE | patient-merge-auth.test.ts | VERIFIED (after fix) | 🟢 |
| **TP-BR-005** plan completion derivation | ✅ | ✅ treatment-plan.schema.ts:56; repo.ts:82 | NONE | treatment-plan-derivation.test.ts:14; item-completion.test.ts:89; approveTreatmentPlan.test.ts:130 | VERIFIED (unit+repo+HTTP) | 🟢 |
| **Plan FSM** illegal transition → 422 PLAN_INVALID_TRANSITION | ✅ | ✅ updateTreatmentPlan.ts:53 | NONE | dental-patient-treatment-plan.test.ts:297-401; status-history.test.ts:123 | VERIFIED (most edges) | 🟢 |
| **P2-9** approval (CR-05) binds items; 422 PLAN_NOT_APPROVABLE | ✅ | ✅ approveTreatmentPlan.ts:51 | NONE | approveTreatmentPlan.test.ts:107-168 | VERIFIED | 🟢 |
| **P2-8** status-history null→draft seed + transitions | ✅ | ✅ createTreatmentPlan.ts:51; updateTreatmentPlan.ts:81 | NONE | treatment-plan-status-history.test.ts:164 | VERIFIED | 🟢 |
| **P2-10** CDT versioning `cdtCodeSetYear` | ✅ | ✅ createTreatmentPlan.ts:45 | NONE | NONE | NONE (test gap) | 🟡 |
| **P1-19** treatment-options accept → siblings declined | ✅ | ✅ acceptTreatmentOption.ts | NONE | treatment-option-group.test.ts:113-156 (422/404 + declined sibling) | VERIFIED | 🟢 |
| **P1-21** treatment↔appointment link (cross-patient → 400) | ✅ | ✅ attach/detachTreatmentAppointment.ts | NONE | treatment-appointment-link.test.ts:115-163 | VERIFIED | 🟢 |
| **P1-28** communication-consent partial PATCH | ✅ | ✅ consent/update…Consent.ts | NONE | communication-consent.test.ts:100-156 (404; no non-member 403) | VERIFIED (RBAC weak) | 🟡 |
| **Sync FSM** terminal-state + stale-version 409 | ✅ | ✅ sync/*.ts | NONE | dental-patient-sync.test.ts:120-422 | VERIFIED | 🟢 |
| **Insurance/claim** draft FSM 422 + readiness | ✅ | ✅ insurance/*.ts | NONE | dental-patient-insurance.test.ts:247-410 | VERIFIED | 🟢 |
| **Coverage-authorization** HTTP handlers | ✅ | ✅ insurance/*CoverageAuthorization*.ts | NONE | authorization.fsm.property.test.ts (schema-only) | NONE (no HTTP test) | 🟡 |
| **RBAC** create patient: staff_scheduling → 403 | ✅ | ✅ createDentalPatient.ts:48 | NONE | dental-patient.test.ts:978 | VERIFIED | 🟢 |
| **RBAC** archive/export/bulk: non-owner → 403 | ✅ | ✅ archive/export/bulkArchive.ts | NONE | dental-patient.test.ts:1025/1088/1095 | VERIFIED | 🟢 |
| **RBAC** update demographics: staff_scheduling → 403 | ✅ | ✅ updateDentalPatient.ts:44 | NONE | NONE | NONE (test gap; impl correct) | 🟡 |
| **DE-021** patient.registered audit row | ✅ | ✅ createDentalPatient.ts:78 | NONE | NONE | NONE (impl correct; unverified) | 🟡 |

KG note: `grep` of `.understand-anything/domain-graph.json` returned **NONE** for dental-patient flow/step nodes — KG-backlog (lossy graph), not a blocker.

---

## STEP 7 — Gaps Closed This Round

### REAL bugs fixed (TDD: RED proven by source, GREEN verified)

| # | Bug | Class | Fix |
|---|-----|-------|-----|
| 1 | **`listPatientVisits` cross-tenant PHI leak** — `if (branchId) assertBranchAccess(...)` with `branchId` *optional*; omitting it ran ZERO authorization → any authenticated user reads any patient's visit charts across orgs. The existing test even asserted 200 for the no-branchId path. | cross-tenant hole | Derive `preferredBranchId` from the patient record and **always** `assertPatientBranchAccess`; 404 unknown patient. (`identity/listPatientVisits.ts`) |
| 2 | **`listPatientConditions` cross-tenant PHI leak** — identical omit-branchId bypass → leaks treatments/conditions. | cross-tenant hole | Same fix. (`identity/listPatientConditions.ts`) |
| 3 | **`getClaimReadiness` missing authorization** — only an auth check, no branch/patient assert → any authenticated principal of any org reads claim-readiness PHI. | cross-tenant hole | Added patient fetch + `assertPatientBranchAccess`. (`insurance/getClaimReadiness.ts`) |
| 4 | **`unmergePatients` returned 500, not 501** — threw raw `Error('Not implemented')` while sibling `mergePatients` returns a clean 501; asymmetric, and a misleading 500. | impl/stub drift | Mirror merge: clean `501 NOT_IMPLEMENTED`. (`patient/unmergePatients.ts`) |

New adversarial tests (RED→GREEN): visits/treatments cross-tenant 403 + unknown-patient 404 (`dental-patient-records.test.ts`), claim-readiness non-member 403 (`dental-patient-insurance.test.ts`), unmerge clean-501 (`patient-merge-auth.test.ts`).

### Doc / registry drift reconciled

| # | Drift | Fix |
|---|-------|-----|
| 5 | br-registry `dental-patient` block listed only BR-019 + BR-020; **BR-015, BR-015b, BR-015c, TP-BR-005** were implemented+tested but unregistered; BR-020 source path was `dental-patient/mergePatients.ts` (wrong — lives in platform `patient/`). | Added BR-015/015b/015c/TP-BR-005 with source+test refs; corrected BR-020 (path + both endpoints now 501 + flag-absent note). |
| 6 | **DUPLICATE_PATIENT(409) fiction** — MODULE_SPEC §15 + API_CONTRACTS POST errors claimed a 409 on duplicate; registration is actually **non-blocking 201 + `warning`**. The only 409 is `PATIENT_ALREADY_ARCHIVED`. | Corrected both docs. |
| 7 | **Consent-model drift** — MODULE_SPEC §3/§5 still described the 4-flag marketing/data-sharing/SMS/email consent; reality is single `consentGiven` (V-PAT-004) persisted as JSONB on person. | Reconciled WF-005 step 3 + BR-015 row. |
| 8 | **Update-demographics RBAC drift** — §6 said `staff_full, dentist_owner`; impl (`updateDentalPatient.ts:44`) also allows `dentist_associate`, `hygienist`. | Reconciled §6 to match impl. |
| 9 | **BR-001 over-claim** — `dental-patient-treatment-plan.test.ts` header declared "one draft per patient → 409"; neither implemented (no guard, no index) nor tested. | Removed the false claim with a traceability note (build as a real slice if wanted). |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**REAL test gaps (impl correct, assertion missing) — safe to add in a future pass:**
1. **Coverage-authorization has zero HTTP integration tests** — `authorization.fsm.property.test.ts` only validates the FSM constant in-memory; `create/list/updateStatus` handlers + the cross-patient profile-ownership guard (`createCoverageAuthorization.ts:41`) are untested end-to-end. *(highest-value remaining test gap)*
2. **P2-10 CDT versioning** — `cdtCodeSetYear` stamping has no test.
3. **DE-021 `patient.registered` audit row** — written synchronously but never asserted (archive/export audits ARE asserted).
4. **updateDentalPatient `staff_scheduling` → 403** — RBAC rule correct but unpinned.
5. **Bulk import RBAC (non-owner → 403)** and **transaction-rollback** — comment promises rollback test; none exists.
6. **`POST .../accept` sidecar snapshot** — no direct test that it writes `treatment_plan_version` and does NOT drive the FSM.
7. **Communication-consent / follow-up-notes non-member 403** — sibling sub-resources test this; these don't.
8. **`branchless-auth` regression test covers only 3 of ~29 `assertPatientBranchAccess` call sites.**

**Latent risk (not a test gap, surfaced for a product decision):**
- **BR-015b archived-write guard is NOT on sub-resource handlers** (insurance/contacts/alerts/tasks/household) — writing to an archived patient's sub-records is currently allowed. Decide whether the read-only rule should extend to sub-resources (then build + test) or whether the rule is scoped to core demographics/notes/recalls (then narrow the spec).
- **`bulkArchiveDentalPatients`** resolves all IDs before the per-branch role assert and can partially archive before a forbidden branch throws (logical correctness, not pure RBAC).

**KG-backlog:** dental-patient has NO domain-graph nodes — recommend a future KG regeneration includes the patient domain (lossy-extractor limitation, consistent with prior rounds).

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-patient module suite (`test-with-db.ts`, 40 files) | ✅ **382 pass / 0 fail** |
| `eslint` (changed files) | ✅ 0 errors (1 pre-existing unrelated warning) |
| `check:boundaries:dental-patient` | ✅ no cross-module violations |
| Contract suite (fresh `:7213`) | ✅ `dental-patient.hurl` Success (41 req); 43/46 files pass. 3 failures are **environmental, outside this module**: auth-password-reset + auth-verification (mailpit:8025 down), billing-lifecycle (`POST /billing/merchant-accounts` 500 — Stripe not configured). None touch dental-patient or this round's edits. |

---

## Files Changed

- `services/api-ts/src/handlers/dental-patient/identity/listPatientVisits.ts` — V-PAT-002 cross-tenant fix
- `services/api-ts/src/handlers/dental-patient/identity/listPatientConditions.ts` — V-PAT-002 cross-tenant fix
- `services/api-ts/src/handlers/dental-patient/insurance/getClaimReadiness.ts` — CONF-DP-002 auth fix
- `services/api-ts/src/handlers/patient/unmergePatients.ts` — 500 → clean 501 (EM-PAT-007)
- `services/api-ts/src/handlers/dental-patient/dental-patient-records.test.ts` — +3 cross-tenant/404 tests
- `services/api-ts/src/handlers/dental-patient/dental-patient-insurance.test.ts` — +1 readiness non-member 403 test
- `services/api-ts/src/handlers/patient/patient-merge-auth.test.ts` — unmerge 500→501 assertion
- `services/api-ts/src/handlers/dental-patient/dental-patient-treatment-plan.test.ts` — removed BR-001 over-claim
- `specs/api/docs/standards/br-registry.json` — added BR-015/015b/015c/TP-BR-005; corrected BR-020
- `docs/product/modules/dental-patient/MODULE_SPEC.md` — consent model, dup-409, update-demographics roles
- `docs/product/modules/dental-patient/API_CONTRACTS.md` — DUPLICATE_PATIENT(409) over-claim
- `docs/audits/modules/MODULE_dental-patient_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — rollup entry
