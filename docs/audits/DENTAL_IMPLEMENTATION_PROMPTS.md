# Dental Implementation Prompts

AI-ready implementation prompts for each remediation task. Paste directly into a new Claude Code session.

---

## PROMPT-001 — BR-011 Consent Gate in createDentalInvoice

```
Context: I'm working on the Dentalemon dental management system (services/api-ts, Bun + Hono + Drizzle ORM).

Background: Business rule BR-011 requires that a signed consent form exists before a dental invoice can be created. The `createDentalInvoice.ts` handler currently does NOT check for this. A STOP CONDITION was explicitly logged in `billing-gate-http.test.ts`: "createDentalInvoice does NOT check for a signed consent form before creating an invoice."

Task: Implement BR-011 enforcement in createDentalInvoice.

Steps:
1. First, write a FAILING test in `services/api-ts/src/handlers/dental-billing/billing-gate-http.test.ts`:
   - Test name: "createDentalInvoice blocked when no signed consent form exists"
   - Seed: patient, org, branch, membership (dentist role), performed treatment, NO consent form
   - Expected: 422 response with code CONSENT_REQUIRED
   - Run test, confirm it FAILS (patient can currently get an invoice without consent)

2. In `createDentalInvoice.ts`, after validating performed treatments exist:
   - Query `consent_form` table for the patient/branch where `signed = true`
   - If count === 0, throw `BusinessLogicError('Signed consent required before invoicing', 'CONSENT_REQUIRED')`

3. Also write passing test: "createDentalInvoice succeeds when signed consent exists"
   - Same seed + add a signed consent form row
   - Expected: 201

4. Run: `cd services/api-ts && bun test src/handlers/dental-billing/billing-gate-http.test.ts`
   - Both tests must pass

5. Run: `cd services/api-ts && bun test` — no regressions

Constraints:
- Follow existing pattern in business-rules.test.ts exactly
- Use real DB (createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' }))
- Use unique UUID prefixes to avoid collision with existing test seeds
- Do NOT mock the database
```

---

## PROMPT-002 — dental_chart_version Audit Table

```
Context: Dentalemon dental management system (services/api-ts, Bun + Hono + Drizzle ORM + PostgreSQL).

Background: The `dental_chart` table stores each visit's tooth chart as a mutable JSONB column. There is no version table. When a clinician edits a tooth, the previous state is permanently lost. The visit_note_version table (append-only) shows the correct pattern we want to replicate.

Task: Add a `dental_chart_version` append-only audit table.

Relevant files:
- `services/api-ts/src/handlers/dental-visit/repos/dental-chart.schema.ts` — schema to update
- `services/api-ts/src/handlers/dental-visit/repos/dental-chart.repo.ts` — repo to update
- `services/api-ts/src/handlers/dental-visit/upsertDentalChart.ts` — handler to update
- `services/api-ts/src/handlers/dental-visit/repos/dental-chart.test.ts` — test to update

Steps:
1. In `dental-chart.schema.ts`, add:
   ```ts
   export const dentalChartVersions = pgTable('dental_chart_version', {
     ...baseEntityFields,
     chartId: uuid('chart_id').notNull().references(() => dentalCharts.id, { onDelete: 'cascade' }),
     version: integer('version').notNull(),
     teeth: jsonb('teeth').notNull().$type<ToothChartState[]>(),
     savedBy: uuid('saved_by').notNull(),
     savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
   }, (table) => ({
     chartVersionUniq: unique('dental_chart_version_chart_version_uniq').on(table.chartId, table.version),
   }));
   ```

2. Generate migration: `cd services/api-ts && bun run db:generate`

3. In `dental-chart.repo.ts`, add method:
   ```ts
   async saveVersion(chartId: string, teeth: ToothChartState[], savedBy: string): Promise<void>
   ```
   This should: (a) count existing versions for this chartId, (b) insert with version = count + 1

4. In `upsertDentalChart.ts`, after updating/inserting the chart row, call `repo.saveVersion(chartId, teeth, user.id)`

5. Write tests in `dental-chart.test.ts`:
   - "upsert chart twice → dental_chart_version has 2 rows"
   - "dental_chart_version rows have correct teeth snapshots"
   - "version numbers are sequential"

6. Run: `bun test src/handlers/dental-visit/repos/dental-chart.test.ts` — all pass

Constraints:
- Append-only: never update or delete from dental_chart_version
- Do NOT add version checking to the read path (dental_chart row is still the canonical current state)
- Follow baseEntityFields pattern from existing schemas
```

---

## PROMPT-003 — Fix Silent Treatment Save Error

```
Context: Dentalemon dental management system (apps/dentalemon, React + TanStack Query + Bun).

Background: The treatment save mutation in the dental workspace has a no-op onError handler. When a treatment save fails (network error, 422 from FSM guard, 500), the UI gives no feedback. The clinician believes the save succeeded but the clinical record is incorrect.

Relevant files:
- `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-update-treatment.ts`
- `apps/dentalemon/src/features/workspace/components/treatment-table.tsx`
- `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`
- `apps/dentalemon/src/features/workspace/components/treatment-table.test.ts`

Task: Add error feedback when treatment or chart saves fail.

Steps:
1. First, write a FAILING component test in `treatment-table.test.ts`:
   - Mock `use-save-treatment` to simulate an error response
   - Assert that an error toast/alert with text "Treatment could not be saved" is visible
   - Confirm it fails (currently no error UI)

2. In `use-save-treatment.ts`, add `onError` to the useMutation options:
   ```ts
   onError: (error) => {
     toast.error('Treatment could not be saved. Please try again.');
     console.error('[use-save-treatment] save failed:', error);
   }
   ```

3. Apply the same pattern to `use-save-chart.ts` and `use-update-treatment.ts`

4. Verify the component surfaces the error:
   - In `treatment-table.tsx` or `tooth-slideout.tsx`, if using mutation.isError, show inline error message

5. Run component tests: pass
6. Run `bun test src/ --coverage` — no regressions

Constraints:
- Use the existing toast library (check how other mutations surface errors — follow the same pattern)
- Do NOT change the mutation logic itself, only the error handling
- Keep the error message user-friendly (avoid technical error codes in the toast)
```

---

## PROMPT-004 — Fix E2E CI Gate

```
Context: Dentalemon monorepo CI (.github/workflows/quality.yml).

Background: The E2E job in quality.yml has `continue-on-error: true`, meaning E2E test failures do not block CI. There is a separate `journey-verification` job that runs E2E tests against a real backend with postgres and seed data.

Task: Determine and document the correct authoritative E2E gate.

Steps:
1. Read `.github/workflows/quality.yml` fully.

2. Find the `journey-verification` job:
   - Does it have `continue-on-error: true`? If yes, this is a blocker — remove it.
   - Does it start a real postgres backend with seed data? If yes, it IS the real gate.
   - Does it have a real "fail the build" path? If yes, document this.

3. If `journey-verification` is the real gate (runs postgres + seed + real backend):
   - Add a comment to the `e2e` job: "Note: this job runs without a backend. journey-verification is the authoritative E2E gate and is a hard fail."
   - Remove `continue-on-error: true` from `e2e` job (or leave with comment explaining it's intentional for the lightweight job only)

4. If journey-verification ALSO has continue-on-error or lacks postgres:
   - Fix it: add postgres service container + seed step + remove continue-on-error

5. Verify by: introducing a deliberate regression (comment out a workspace API route), pushing to a test branch, confirming CI fails.

Constraints:
- Do not break the workflow for unrelated jobs
- The backend unit test jobs (`api-tests`) must continue to be hard-fail gates
```

---

## PROMPT-005 — dental-perio Handler Tests

```
Context: Dentalemon dental management system (services/api-ts, Bun + Hono + Drizzle ORM).

Background: dental-perio has only one test file (repos/perio-chart.repo.test.ts). There are no handler-level tests for createPerioChart, upsertToothReading, completePerioChart, or getVisitPerioChart. Periodontal charting is a clinical feature that needs handler-level verification.

Task: Create comprehensive handler tests for dental-perio.

Relevant files:
- `services/api-ts/src/handlers/dental-perio/` — all handlers
- Pattern to follow: `services/api-ts/src/handlers/dental-visit/dental-visit.test.ts` and `dental-billing/billing-gate-http.test.ts`

Create: `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts`

Tests to write (TDD: RED first, then implement if handler is missing anything):
1. `createPerioChart` — POST /dental/visits/{visitId}/perio-charts
   - happy path: returns 201 with chart object
   - unknown visitId: returns 404
   - wrong branch member: returns 403

2. `upsertToothReading` — POST /dental/perio-charts/{chartId}/readings
   - creates new reading for tooth 1: returns 201
   - updates existing reading: returns 200 with updated values
   - probing depths out of range: returns 400

3. `completePerioChart` — POST /dental/perio-charts/{chartId}/complete
   - completes chart: returns 200 with status = 'completed'
   - completing already-completed chart: returns 422 or 409

4. `getVisitPerioChart` — GET /dental/visits/{visitId}/perio-chart
   - returns chart with readings for visit
   - no chart for visit: returns 404

5. Branch access: staff from org B cannot access org A perio chart → 403

Constraints:
- Real DB required (postgres://postgres:password@localhost:5432/monobase)
- Use unique UUID prefixes (pp prefix) to avoid collisions
- Follow the seed pattern from dental-perio/repos/perio-chart.repo.test.ts
```

---

## PROMPT-006 — Fix N+1 in getToothHistory

```
Context: Dentalemon dental management system (services/api-ts).

Background: `getToothHistory.ts` has an N+1 query issue. For each completed/locked visit, it makes 2 sequential DB queries (chart + treatments). For a patient with 30 visits = 60 DB round-trips.

File: `services/api-ts/src/handlers/dental-visit/getToothHistory.ts` (lines ~42-77)

Task: Refactor getToothHistory to batch-fetch all required data.

Steps:
1. Write a test (or add to dental-visit.test.ts):
   - Create patient with 5 completed visits, each with chart data for tooth 14
   - Assert response returns 5 entries
   - (Optional) Assert the handler completes in < 100ms for 5 visits (performance check)

2. Refactor `getToothHistory.ts`:
   - Fetch all completed/locked visits for patient in one query (already done)
   - Batch-fetch all dental_chart rows for those visit IDs in ONE query: `WHERE visit_id = ANY($visitIds)`
   - Batch-fetch all dental_treatment rows for those visit IDs in ONE query: `WHERE visit_id = ANY($visitIds) AND tooth_number = $toothNumber`
   - Build lookup maps: `chartsByVisitId` and `treatmentsByVisitId`
   - Join in memory (replace the for-loop awaits with map lookups)

3. Run `bun test src/handlers/dental-visit/` — no regressions

Expected: 3 DB queries total regardless of visit count (visits, charts, treatments).

Constraints:
- Do not change the response shape
- Maintain reverse-chronological sort
- Use Drizzle `inArray()` for batch fetching
```

---

## PROMPT-007 — Wire Pediatric Dentition

```
Context: Dentalemon dental management system.

Background: The backend `initializeDentition` accepts `dentitionType: 'permanent' | 'primary'`. The `universal-tooth-fdi.tsx` component supports both layouts. But the frontend workspace always sends `permanent`, so pediatric patients (with primary/mixed dentition) always get a 32-tooth adult chart.

Relevant files:
- `apps/dentalemon/src/features/workspace/` — workspace feature
- `apps/dentalemon/src/features/workspace/components/dental-chart.tsx`
- `apps/dentalemon/src/features/patients/` — patient data includes dateOfBirth
- Backend: `initializeDentition.ts`, `dental-chart.schema.ts`

Task: Allow the workspace to use primary dentition (20 teeth) for pediatric patients.

Steps:
1. Determine dentition type from patient data:
   - If `patient.dateOfBirth` is present and age < 12: dentitionType = 'primary'
   - If age 12-18: dentitionType = 'mixed' (optional; use 'permanent' for now)
   - Otherwise: dentitionType = 'permanent'

2. Pass dentitionType to `initializeDentition` call when creating first visit

3. Store dentitionType on the dental_visit or dental_patient record (check backend schema)

4. In workspace, pass `dentitionType` to `DentalChart` component

5. In `DentalChart`, if `dentitionType === 'primary'`, render TOOTH_NUMBERS 1-20 only

6. Test:
   - Create pediatric patient (age 8) → workspace shows 20 teeth
   - Create adult patient → workspace shows 32 teeth

Constraints:
- Backward compatible: existing patients with no dateOfBirth get 'permanent' (default)
- Do NOT change the tooth numbering scheme — pediatric uses 1-20 universal notation
```
