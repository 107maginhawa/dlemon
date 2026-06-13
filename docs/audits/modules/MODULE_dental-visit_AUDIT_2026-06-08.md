# Module Audit — dental-visit

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — 5 real security gaps fixed (TDD): a treatment-template RBAC/privilege-escalation path, a cross-clinic template leak, and a 3-handler cross-tenant PHI leak across the treatment-plan surface; plus registry/spec/contract/workflow-map drift reconciled. Gates green.

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-visit/` | ✅ present (visits, treatments, treatment-plans, chart, notes, templates, repos, utils — 29 handler files) |
| TypeSpec | `specs/api/src/modules/dental-visit.tsp` | ✅ present (visit/chart/treatment/notes/template/treatment-plan interfaces) |
| MODULE_SPEC / API_CONTRACTS | `docs/product/modules/dental-visit/` | ✅ present (API_CONTRACTS was missing apply-template / accept / version and carried drifted shapes — reconciled) |
| Tests | 24 `*.test.ts` (was 23 + 1 added this round) | ✅ present |

**/module-review result:** **PASS** — no `test.skip`/`xit`/`xdescribe`, no real `Not implemented` stubs (the 2 grep hits are TDD comments in test files), no TODO/FIXME/HACK in handler code, 0 `as any` in non-test code. Audit logging present on create/activate/complete/lock visit, treatment diagnosed/performed/dismissed/declined.

---

## STEP 3 — KG mapping (query-only)

The domain graph carries accurate dental-visit coverage (visit is **folded into** the
broader `clinical-records` domain — a lossy projection, not a separate `domain:dental-visit`):
`flow:conduct-visit`, `flow:hygienist-led-hygiene-visit`, and steps
`step:conduct-visit:create-visit` / `update-tooth` / `create-treatment`.

Summaries are **honest** — they correctly state the visitType role gate ("hygiene visits
restricted to hygienist role; general to dentist roles"), "dental_assistant assists but
cannot sign", and "adds a treatment item … in 'diagnosed' state". No over-claims found.

**KG-backlog (lossy, not a blocker):** the graph does not model the treatment-plan
presentation/accept/version flow, treatment templates, carry-over, or the visit/treatment
FSM transitions as distinct nodes. Fix on next KG regeneration (not regenerated this round).

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file) | Strength | Verdict |
|------|-------|-------|----|-------------|----------|---------|
| **BR-001** no concurrent active visit → 409 ACTIVE_VISIT_EXISTS (per-patient, global) | ✅ | ✅ createDentalVisit.ts:43; updateDentalVisit.ts:76; visit.schema activePatientUnique | ✅ | dental-visit.test.ts (create + activate 409) | VERIFIED | 🟢 |
| **BR-002** visit FSM linear draft→active→completed→locked | ✅ | ✅ VISIT_TRANSITIONS; updateDentalVisit.ts:44-52 | ✅ | visit.fsm.property.test.ts (7); treatment-templates (locked) | VERIFIED | 🟢 |
| **BR-003** completed/locked visit immutable → 422 | ✅ | ✅ updateDentalVisit/createDentalTreatment/updateDentalTreatment/applyTemplate | ✅ | treatment-templates.test.ts (FR1.16 chiefComplaint/treatment/locked) | VERIFIED | 🟢 |
| **BR-005** empty-visit auto-discard, flag-gated default-OFF | ✅(V-VIS-004) | ✅ updateDentalVisit.ts:113-133 | NONE | (flag OFF default; transition + discarded state present) | PARTIAL (no flag-ON test) | 🟡 |
| **BR-006** treatment forward-only; dismissed/declined reachable from pre-performed only | ✅ | ✅ TREATMENT_TRANSITIONS; updateDentalTreatment.ts:58-66 | ✅ | treatment.fsm.property.test.ts; treatment-fsm-http.test.ts; treatment-status-transitions.test.ts (illegal → 4xx) | VERIFIED | 🟢 |
| **BR-007 / AC-VIS-003** performed/verified field-immutable → 422 | ✅ | ✅ updateDentalTreatment.ts:52-55 | NONE | dental-treatment.test.ts; treatment-status-transitions.test.ts | VERIFIED | 🟢 |
| **BR-008** carry-over → new rows carriedOver=true/sourceVisitId, status preserved | ✅ | ✅ carryOverTreatments.ts:104-120 | NONE | treatment-templates.test.ts (FR1.11) | VERIFIED | 🟢 |
| **Completion gates**: open-treatments→422, consent→422, notes→422 | ✅ | ✅ updateDentalVisit.ts:136-146 | ✅ | business-rules.test.ts; revenue-path-regression.test.ts | VERIFIED | 🟢 |
| **Treatment consent gate** →performed requires signed consent → 422 | ✅ | ✅ updateDentalTreatment.ts:70-77 | NONE | treatment-status-transitions.test.ts | VERIFIED | 🟢 |
| **Decline** requires refusalReason → 422; audited | ✅ | ✅ updateDentalTreatment.ts:100-120 | NONE | treatment-decline.test.ts; treatment-templates.test.ts (C2) | VERIFIED | 🟢 |
| **SOAP notes** single per-visit row; sign locks; addendum/version history | ✅(V-VIS-009/010) | ✅ signVisitNotes/upsert/addendum | NONE | signed-notes.test.ts (16); visit-note-persistence.test.ts | VERIFIED | 🟢 |
| **E3 hygiene** create/sign hygiene visit unlocks hygienist (general stays owner/associate) | ✅ | ✅ createDentalVisit.ts:32-37; signVisitNotes.ts:36-40 (conditional) | ✅ | hygienist.hygiene-visit.test.ts (13, incl. 403) | VERIFIED | 🟢 |
| **Dentition init** deciduous/mixed/permanent; idempotent | ✅ | ✅ initializeDentition.ts | ✅ step | treatment-templates.test.ts (FR1.19, 20/52/32) | VERIFIED | 🟢 |
| **Read-side cross-tenant** getVisit/list/chart/toothHistory assert branch access | ✅ | ✅ assertBranchAccess (toothHistory derives from patient visit) | NONE | dental-visit.test.ts (403/auth) | VERIFIED | 🟢 |
| **RBAC** create/treatment/carry-over write → owner/associate; staff_full→403 | ✅ | ✅ assertBranchRole on all write handlers | ✅ | dental-visit.test.ts (staff_full 403 blocks) | VERIFIED | 🟢 |
| **applyTemplate RBAC** → clinical role only (was any member) | §6 intent | ✅ **FIXED** | NONE | cross-tenant-rbac.test.ts (**NEW** staff_full→403) | VERIFIED (after fix) | 🟢 |
| **applyTemplate branch-scope** → foreign-branch template 404 | §13 intent | ✅ **FIXED** | NONE | cross-tenant-rbac.test.ts (**NEW**) | VERIFIED (after fix) | 🟢 |
| **Treatment-plan cross-tenant** (get/accept/version) → patient-branch auth | implied | ✅ **FIXED** (V-VIS-011) | NONE | cross-tenant-rbac.test.ts (**NEW** 3 cases) | VERIFIED (after fix) | 🟢 |
| **Carry-over cross-branch** (spec §13 "blocked") | ⚠ drift | ❌ not blocked (patient-scoped) | NONE | — | PRODUCT DECISION (surfaced) | 🟡 |

---

## STEP 7 — Gaps Closed This Round

### REAL security bugs fixed (TDD: RED proven by source + failing test, GREEN verified)

| # | Bug | Class | Fix |
|---|-----|-------|-----|
| 1 | **applyTemplate privilege escalation** — `createDentalTreatment` requires `assertBranchRole(['dentist_owner','dentist_associate'])`, but `applyTemplate` (an alternate path that creates billable treatments on a visit) only called `assertBranchAccess` → any branch member incl. `read_only`/`staff_full` could inject treatments, bypassing the clinical-role gate. (Same "alternate path, weaker RBAC" class carried forward from dental-scheduling.) | RBAC bypass | `assertBranchAccess` → `assertBranchRole(['dentist_owner','dentist_associate'])` parity with create-treatment. |
| 2 | **applyTemplate cross-clinic template leak** — the template was loaded by global id with **no** `template.branchId === visit.branchId` check. A user with access to clinic A's visit could apply clinic **B's** template (its CDT codes + pricing) into A's visit. | cross-tenant leak | Foreign-branch template → `NotFoundError(404)`. |
| 3-5 | **Treatment-plan cross-tenant PHI leak (×3)** — `getTreatmentPlan` (read), `acceptTreatmentPlan` (write), `getTreatmentPlanVersion` (read) all `assertBranchAccess(db, user.id, <branchId query param>)` then queried by `patientId` with no patient↔branch linkage. A caller passing **their own** branchId for another branch's patient leaked/snapshotted that patient's full plan. | cross-tenant PHI | Authorize against the **patient's** branch (`getPatientForDentalPatient` → `assertPatientBranchAccess(preferredBranchId)`); branchId query param is no longer the auth boundary (V-VIS-011, mirrors the dental-patient V-PAT-002 fix). |

New adversarial test file `dental-visit.cross-tenant-rbac.test.ts` (7 tests, 2 orgs/branches): staff_full apply→403, foreign-branch template→404, owner same-branch→201, foreign-branch owner→403 on plan/accept/version, patient-branch owner→200. All RED before fix, GREEN after.

### Doc / registry / spec / workflow-map drift reconciled

| # | Drift | Fix |
|---|-------|-----|
| 6 | **WORKFLOW_MAP error paths wrong** — BR-003/BR-007 listed `403` (impl returns `422 VISIT_IMMUTABLE`/`VISIT_LOCKED`/`TREATMENT_IMMUTABLE`); BR-005 marked **ORPHAN / "not yet enforced"** (it IS implemented behind the default-OFF `dental_visit_auto_discard` flag); `active → completed` precondition said "At least 1 chart entry" (real gates: no open treatments + consent + notes). | Corrected all four rows. |
| 7 | **BR-001 scope** — spec/registry said "per patient **per branch**"; impl is per-patient **global** (partial unique index `(patient_id, status) WHERE status='active'`, stricter). | MODULE_SPEC + br-registry wording corrected to match the safer impl; test refs added. |
| 8 | **br-registry stale** — BR-005 `not-implemented`/"Deferred to v1.3" (now flag-gated implemented); BR-007 source "dental-clinical handlers" (actually `updateDentalTreatment.ts`); BR-003/008 sources pointed at FE files only; no test refs. | Statuses/sources corrected; test refs added; **+BR-VIS-009** (template RBAC+branch) and **+BR-VIS-010** (treatment-plan patient-branch auth) registered. |
| 9 | **API_CONTRACTS missing + drifted** — apply-template, accept, version endpoints undocumented; treatment-plan documented as `Treatment[]` and carry-over as `{carried_over:N}` with snake_case body. | Documented the real shapes + the V-VIS-011 cross-tenant auth, and added a **Contract Drift table** (TypeSpec `TreatmentPlanResponse`/`ApplyTemplateResponse`/`CarryOverTreatmentsResponse`/`CarryOverTreatmentsRequest`/`TreatmentTemplate` are stringly-typed placeholders vs the richer real JSON). |
| 10 | **MODULE_SPEC §6/§13** — no template-apply permission row; §13 claimed cross-branch carry-over "blocked". | Added V-VIS-011/012 permission rows; rewrote §13 to state the real patient-scoped (not branch-blocked) behavior as a pending PRODUCT DECISION. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**Product/contract decisions (not unilaterally changed):**
1. **Carry-over cross-branch (spec §13 drift).** `carryOverTreatments` is patient-scoped, not branch-blocked: it authorizes on the current visit's branch + same-patient, but the source visit (and auto-discovery) may span other branches. Either add a source-branch guard or ratify patient-scoped continuity. CHECKPOINT before changing (touches real behavior + would churn the FR1.11 tests).
2. **TypeSpec contract reconciliation (drift #9).** The treatment-plan/template/carry-over response models lie vs the implemented (test-locked) shapes. Fixing TypeSpec → regen api-ts + sdk-ts → SDK type change for FE consumers. Needs FE verification; deliberately deferred from this audit round to avoid breaking unverified SDK consumers.

**REAL test gaps (impl present, assertion not added this round):**
3. **BR-005 flag-ON path** — auto-discard has no test exercising `DENTAL_VISIT_AUTO_DISCARD=true` → empty complete redirects to `discarded`. (Marked 🟡 PARTIAL.)
4. **Template create/update/delete RBAC** — these still use `assertBranchAccess` only (any member). Less severe than `applyTemplate` (config, no spec'd clinical-role requirement) — surfaced, not changed; decide whether template management should be clinical/admin-gated.

**KG-backlog:** treatment-plan/template/carry-over flows + visit/treatment FSMs are not modeled as distinct nodes (lossy projection) — fix on next KG regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-visit module suite (`test-with-db.ts`, 24 files) | ✅ **325 pass / 0 fail** (incl. new cross-tenant-rbac 7/7) |
| `eslint` (changed files) | ✅ 0 errors, 0 warnings |
| `check:boundaries:dental-visit` | ✅ no cross-module repo violations |
| Contract suite (fresh `:7213`) | ✅ **43/46 files** — `dental-visit.hurl` (35 req) Success + online-booking/provider/storage/person all Success. The 3 failures are **pre-existing environmental, outside this module** (auth-verification + auth-password-reset: mailpit:8025 down; billing-lifecycle: Stripe). Identical to the dental-scheduling/patient rounds. |

---

## Files Changed

- `services/api-ts/src/handlers/dental-visit/utils/treatmentTemplates.ts` — applyTemplate RBAC (clinical-role) + branch-match guard
- `services/api-ts/src/handlers/dental-visit/treatment-plans/getTreatmentPlan.ts` — patient-branch auth (V-VIS-011)
- `services/api-ts/src/handlers/dental-visit/treatment-plans/getTreatmentPlanVersion.ts` — patient-branch auth (V-VIS-011)
- `services/api-ts/src/handlers/dental-visit/treatments/acceptTreatmentPlan.ts` — patient-branch auth (V-VIS-011)
- `services/api-ts/src/handlers/dental-visit/dental-visit.cross-tenant-rbac.test.ts` — **NEW** 7 adversarial tests
- `specs/api/docs/standards/br-registry.json` — BR-001/005/007/008 corrected + test refs; +BR-VIS-009/010
- `docs/product/modules/dental-visit/MODULE_SPEC.md` — BR-001 scope, §6 permissions, §13 carry-over decision
- `docs/product/modules/dental-visit/API_CONTRACTS.md` — real shapes + cross-tenant auth + Contract Drift table + missing endpoints
- `docs/product/WORKFLOW_MAP.md` — BR-003/005/007 error paths + active→completed precondition
- `docs/audits/modules/MODULE_dental-visit_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — rollup entry
