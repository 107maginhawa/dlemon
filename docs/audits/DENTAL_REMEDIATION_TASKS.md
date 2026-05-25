# Dental Remediation Tasks

Generated: 2026-05-25 | Run: 001

Tasks are ordered by risk. P1 tasks are release blockers.

---

## P1 Tasks — Release Blockers

### TASK-DENTAL-P1-001
**Gap:** GAP-DENTAL-001  
**Title:** Enforce BR-011 consent gate in createDentalInvoice  
**Module:** dental-billing  
**Files:** `services/api-ts/src/handlers/dental-billing/createDentalInvoice.ts`  
**Description:**  
`createDentalInvoice` allows invoice creation even when no signed consent form exists for the patient. The handler only checks that performed/verified treatments exist. Add a check for a signed consent form (or at minimum a signed visit note) before allowing invoice creation.

**Implementation steps:**
1. Write failing test in `billing-gate-http.test.ts`: `createDentalInvoice blocked when patient has no signed consent`
2. Confirm test fails (RED) with 201 instead of 422
3. In `createDentalInvoice.ts`, query `consent_form` for the patient's branch with `signed = true`
4. If no signed consent exists, throw `BusinessLogicError('Signed consent required before invoicing', 'CONSENT_REQUIRED')` → 422
5. Confirm test passes (GREEN)
6. Add passing test: `createDentalInvoice succeeds when signed consent exists`

**Verification:** `billing-gate-http.test.ts` + `ac-billing.test.ts` both pass with no regressions.

**Seed coverage:** Requires test seed with: patient, branch, membership, performed treatment, no consent form (fail case) + signed consent form (pass case).

---

### TASK-DENTAL-P1-002
**Gap:** GAP-DENTAL-002  
**Title:** Add dental_chart_version append-only audit table  
**Module:** dental-visit  
**Files:**  
- `services/api-ts/src/handlers/dental-visit/repos/dental-chart.schema.ts`  
- `services/api-ts/src/handlers/dental-visit/repos/dental-chart.repo.ts`  
- `services/api-ts/src/handlers/dental-visit/upsertDentalChart.ts`  
- New migration in `src/generated/migrations/`  

**Description:**  
The `dental_chart` table has no version history. Any edit to a tooth on a non-locked visit silently overwrites the historical snapshot. Add a `dental_chart_version` table (append-only) analogous to `visit_note_version`.

**Implementation steps:**
1. Add `dental_chart_version` table to `dental-chart.schema.ts`:
   - `id`, `chartId` (FK → dental_chart), `version` (int), `teeth` (JSONB), `savedAt`, `savedBy`
   - Unique constraint: `(chartId, version)`
2. Generate migration: `bun run db:generate`
3. In `dental-chart.repo.ts`, add `saveVersion(chartId, teeth, savedBy)` method that inserts into `dental_chart_version`
4. In `upsertDentalChart.ts`, call `saveVersion` after every upsert
5. Write test: upsert chart twice → `dental_chart_version` has 2 rows with correct teeth snapshot
6. Write test: completed/locked visit chart — upsert is rejected with `VISIT_LOCKED` (if not already enforced)

**Verification:** `dental-chart.test.ts` + new `dental-chart-version.test.ts` both pass.

**Seed coverage:** Requires visit with 2 sequential chart saves to produce 2 version rows.

---

### TASK-DENTAL-P1-003
**Gap:** GAP-DENTAL-003  
**Title:** Show error feedback when treatment save fails  
**Module:** frontend / workspace  
**Files:**  
- `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts`  
- `apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts` (verify same pattern)  
- `apps/dentalemon/src/features/workspace/components/treatment-table.tsx`  
- `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`  

**Description:**  
Treatment mutation `onError` callback is a no-op. Failed saves (network error, 422 from FSM guard, 500) give no feedback to the clinician.

**Implementation steps:**
1. Write failing component test for `treatment-table.tsx`: mock `use-save-treatment` to throw → assert error toast visible
2. In `use-save-treatment.ts`, add `onError: (err) => toast.error('Treatment could not be saved. Please try again.')` to the mutation options
3. Verify `use-save-chart.ts` and `use-update-treatment.ts` have the same fix
4. Verify `tooth-slideout.tsx` surfaces the error state
5. Run component tests (GREEN)

**Verification:** `treatment-table.test.ts` passes. Manual test: disconnect network, try to save treatment → error toast appears.

---

### TASK-DENTAL-P1-004
**Gap:** GAP-DENTAL-004  
**Title:** Make E2E CI a hard gate  
**Module:** CI  
**Files:** `.github/workflows/quality.yml`  

**Description:**  
The E2E job runs with `continue-on-error: true`, meaning E2E failures do not block CI. Either fix the job to run against a real backend, or confirm the `journey-verification` job is a hard gate.

**Implementation steps:**  
**Option A (preferred):** Verify that the `journey-verification` job in `quality.yml` does NOT have `continue-on-error: true` and DOES start a real postgres+seed backend. If confirmed, add a comment documenting this explicitly and remove `continue-on-error` from the E2E job.

**Option B:** Add postgres service + seed step to the E2E job and remove `continue-on-error: true`.

**Verification:** Introduce a deliberate regression (comment out a workspace route handler), push to a test branch, confirm CI fails.

---

## P2 Tasks — Important Remediation

### TASK-DENTAL-P2-001
**Gap:** GAP-DENTAL-008  
**Title:** Add dental-perio handler-level tests  
**Module:** dental-perio  
**Files:** `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts` (new)  

**Description:**  
Only `repos/perio-chart.repo.test.ts` exists. Add handler-level tests for all 4 perio endpoints.

**Tests to add:**
- `createPerioChart` — creates chart, returns 201, linked to visit
- `upsertToothReading` — creates/updates reading for tooth number, returns correct data
- `completePerioChart` — transitions chart to `completed` state
- `getVisitPerioChart` — returns chart for visit, returns 404 for unknown visit
- Branch access: request from wrong branch → 403

**Seed coverage:** visit, patient, branch membership, perio chart rows.

---

### TASK-DENTAL-P2-002
**Gap:** GAP-DENTAL-006  
**Title:** Fix N+1 query in getToothHistory  
**Module:** dental-visit  
**Files:** `services/api-ts/src/handlers/dental-visit/getToothHistory.ts`  

**Description:**  
The for-loop fetches chart and treatments separately per visit (2 await per visit = 2N DB round-trips). Batch-fetch all data for the patient in 2 queries.

**Implementation steps:**
1. Write benchmark test (or note count): assert that for a patient with 10 visits, getToothHistory issues ≤ 4 DB queries total
2. Refactor `getToothHistory.ts`: fetch all visits in one query, all charts for those visit IDs in one query, all treatments for those visit IDs in one query, join in memory
3. Verify test passes; verify `dental-visit.test.ts` regression-free

---

### TASK-DENTAL-P2-003
**Gap:** GAP-DENTAL-005  
**Title:** Create SLICE_SPEC.md and TDD_PROOF.md for G1 execution slices  
**Module:** process / G1 phase  
**Files:**  
- `docs/execution/slices/g1-s1-branch-access-rbac/SLICE_SPEC.md` (new)  
- `docs/execution/slices/g1-s1-branch-access-rbac/TDD_PROOF.md` (new)  
- (one pair per G1 slice)  

**Description:**  
No SLICE_SPEC.md or TDD_PROOF.md exist anywhere. For G1 and all future phases, create these per the oli-execution-gate format before executing.

**Steps:**
1. Complete `G1-CONTEXT.md` and `G1-PLAN.md` for the G1 phase
2. For each G1 slice, create SLICE_SPEC.md with AC/BR items extracted from MODULE_SPEC.md
3. For each slice, create TDD_PROOF.md per oli-execution-gate §TDD_PROOF.md format
4. Populate RED output and GREEN evidence after tests pass

---

### TASK-DENTAL-P2-004
**Gap:** GAP-DENTAL-009  
**Title:** Wire pediatric dentition in frontend workspace  
**Module:** dental-visit / frontend  
**Files:**  
- `apps/dentalemon/src/features/workspace/components/dental-chart.tsx`  
- `apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts` (or visit initialization)  
- `services/api-ts/src/handlers/dental-visit/initializeDentition.ts`  

**Description:**  
The backend `initializeDentition` accepts `dentitionType` but the frontend always sends `permanent`. Pediatric patients (children) need a 20-tooth primary dentition chart.

**Steps:**
1. Add `dentitionType` field to `DentalPatient` (or derive from `dateOfBirth` age check)
2. In workspace initialization, pass `dentitionType: 'primary'` for patients under ~12 years old
3. In `DentalChart`, when `dentitionType === 'primary'`, use 20-tooth layout (TOOTH_NUMBERS 1-20)
4. Test: create pediatric patient → workspace shows 20 teeth

---

### TASK-DENTAL-P2-005
**Gap:** GAP-DENTAL-012  
**Title:** Fix TypeSpec int32 path param bug; remove app.ts manual overrides  
**Module:** specs/api + services/api-ts  
**Files:**  
- `specs/api/src/` (TypeSpec source for affected routes)  
- `services/api-ts/src/app.ts` (remove manual overrides after fix)  

**Description:**  
Three routes have manual overrides in `app.ts` because generated validators incorrectly typed path params as `int32` instead of `string`/`uuid`. Fix the TypeSpec source, regenerate, and remove overrides.

**Affected routes:** `/dental/branches`, `/dental/visits/history/:patientId/teeth/:toothNumber`, `/dental/admin/audit`.

**Steps:**
1. In TypeSpec source, change affected path param types to `string` (or `uuid`)
2. Run `cd specs/api && bun run build`
3. Run `cd services/api-ts && bun run generate`
4. Remove the 3 manual route overrides from `app.ts`
5. Run contract tests to verify compliance

---

### TASK-DENTAL-P2-006
**Gap:** GAP-DENTAL-007  
**Title:** Scope dental-emr module or mark as future phase  
**Module:** dental-emr / product  
**Files:** `docs/product/MODULE_MAP.md`, `docs/product/modules/dental-emr/MODULE_SPEC.md`  

**Description:**  
dental-emr has only INFERRED workflows and no backend. Either define concrete workflows and add to a future phase roadmap, or add `status: FUTURE_PHASE` to MODULE_MAP.md entry.

**Steps:**
1. Decide: is dental-emr the product name for dental-visit (rename), or a separate future module (external EMR integration)?
2. Update MODULE_MAP.md accordingly
3. If future module: update dental-emr/MODULE_SPEC.md with concrete workflows and mark `implementation_status: planned`

---

### TASK-DENTAL-P2-007
**Gap:** GAP-DENTAL-011  
**Title:** Complete G1 phase planning artifacts  
**Module:** process / .planning  
**Files:**  
- `.planning/phases/G1-foundation-stabilization/G1-CONTEXT.md` (new)  
- `.planning/phases/G1-foundation-stabilization/G1-PLAN.md` (new)  

**Description:**  
G1 has only `G1-RESEARCH.md`. Without CONTEXT.md and PLAN.md, it is not possible to verify G1 completion criteria.

**Steps:**
1. Create `G1-CONTEXT.md` with: phase goal, scope (files to change), verification commands, test baseline
2. Create `G1-PLAN.md` with: ordered task list, each task scoped to specific files
3. After executing G1, create `G1-VERIFICATION.md` confirming all acceptance criteria met

---

## P3 Tasks — Polish / Future Phase

### TASK-DENTAL-P3-001
**Gap:** GAP-DENTAL-013  
**Title:** Fix panelOpen dead code in ToothSlideout  
**File:** `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`  
**Fix:** Wire `panelOpen` prop to control the internal `open` state (use `useEffect` or derive from prop).

### TASK-DENTAL-P3-002
**Gap:** GAP-DENTAL-014  
**Title:** Complete tooth state legend  
**File:** `apps/dentalemon/src/features/workspace/components/dental-chart.tsx`  
**Fix:** Add `implant`, `extracted`, `watchlist` to the legend rendered when `showLegend={true}`.

### TASK-DENTAL-P3-003
**Gap:** GAP-DENTAL-015  
**Title:** Implement time-lapse playback for carousel  
**Description:** See CAROUSEL-CONCEPT §11 Prompt 3 for full implementation spec. Add `useTimelapse` hook, Play/Pause button, speed control. Use Swiper programmatic API. Test with Playwright.

### TASK-DENTAL-P3-004
**Gap:** GAP-DENTAL-016  
**Title:** Wire year-segment-control into carousel  
**File:** `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx` + `year-segment-control.tsx`  
**Fix:** Pass visit years array to `year-segment-control`; on year select, scroll carousel to first visit of that year.

### TASK-DENTAL-P3-005
**Gap:** GAP-DENTAL-017  
**Title:** Add prefers-reduced-motion check to Swiper CoverFlow config  
**File:** `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx`  
**Fix:** Read `window.matchMedia('(prefers-reduced-motion: reduce)')`. If true, disable CoverFlow effect and use plain slide transition.

### TASK-DENTAL-P3-006
**Gap:** GAP-DENTAL-018  
**Title:** Add HMAC tamper-evidence to chart snapshots (future phase)  
**Description:** Deferred per design doc. When dental_chart_version is implemented (P1-002), consider adding a server-side HMAC of the `teeth` JSON keyed to the visit and user ID, stored alongside the version row.
