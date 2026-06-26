# Timeline Carousel — Per-Visit Status Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make historical visit cards in the workspace timeline carousel display accurate Existing / Planned / Completed / Declined status layers for the work recorded in *that* visit, so the past→present timeline is clinically coherent instead of rendering every historical tooth as "Existing".

**Architecture:** The `GET /dental/visits/{visitId}/chart` response gains an optional `layers` field (proposed/completed/declined FDI-number arrays) derived server-side from *that visit's own* treatments using the existing canonical `deriveLayerSets()` precedence fold. The frontend `VisitChartCard` reads those per-visit layer sets from its own chart fetch and feeds them to `DentalChart` for historical cards; the open ("Current — all visits") card keeps its cumulative cross-visit overlay unchanged. A read-only layer key is added to historical cards so the colors are interpretable.

**Why backend-first (locked decision from independent review):** A FE-only fix that filters the live patient treatment-plan aggregate by `visitId` would render *status-as-of-today*, not *status-as-of-that-visit* — a tooth planned at V2 and performed at V3 would wrongly show "Completed" on V2. The correct per-visit status only exists by scoping to a visit's own (immutable, once completed) treatment rows server-side.

**Tech Stack:** Bun, Hono, Drizzle, TypeSpec → OpenAPI codegen, React 19, TanStack Query/Router, `@monobase/sdk-ts` generated client, Bun test, Playwright E2E.

## Global Constraints

- Runtime is **Bun**, never Node. Backend = Hono + Drizzle only.
- **Vertical TDD is mandatory** (`docs/development/VERTICAL_TDD.md`): tests before code (RED→GREEN→refactor); one vertical slice end-to-end. Per-module sequence: TypeSpec → codegen → backend tests → backend → contract → FE tests → FE → E2E → verify.
- **Never edit generated files** (`specs/api/dist/**`, `services/api-ts/src/generated/**`, `packages/sdk-ts/src/generated/**`). Regenerate them.
- Tooth identity is always the **canonical FDI number**; only labels change per notation.
- Run backend tests via `bun run test` with `DATABASE_URL=…/monobase_test` — **never** `bun test <path>` directly (pollutes the clone template → phantom regressions). FE tests run from `apps/dentalemon`.
- Backend verify gate = `bun run typecheck` + `bun run lint` + `bun run test` + `bun run check:boundaries`.
- **No parallel-agent fan-out** during execution — run subagents sequentially.
- Layer precedence (must stay identical in BE `chart-export.ts` and FE `chart-layers.ts`): `completed > proposed > declined > baseline`. `completed = performed|verified`; `proposed = diagnosed|planned`; `declined = declined`; `dismissed → off-chart`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `services/api-ts/src/handlers/dental-visit/chart/chart-export.ts` | Canonical layer derivation | Export `deriveLayerSets` (was private) |
| `specs/api/src/modules/dental-visit.tsp` | API contract | Add `DentalChartLayerSets` model + optional `layers` on `DentalChart` |
| `services/api-ts/src/handlers/dental-visit/chart/getDentalChart.ts` | GET chart handler | Load visit treatments, attach `layers` |
| `services/api-ts/src/handlers/dental-visit/chart/__tests__/getDentalChart.test.ts` | Backend unit test | New / extend |
| `specs/api/tests/contract/*` | Contract test | Assert `layers` shape on GET chart |
| `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx` | Carousel + per-card chart fetch | Read `layers`, wire to historical cards, add read-only layer key |
| `apps/dentalemon/src/features/workspace/__tests__/timeline-carousel.test.ts` | FE unit test | New cases |
| `apps/dentalemon/tests/e2e/*` (or existing workspace E2E) | E2E | New assertion |

---

## P0 — Per-visit layer sets on historical cards (the true blocker)

### Task 1: Export the canonical `deriveLayerSets` for reuse

**Files:**
- Modify: `services/api-ts/src/handlers/dental-visit/chart/chart-export.ts:89`
- Test: `services/api-ts/src/handlers/dental-visit/chart/__tests__/chart-export.test.ts` (existing — confirm still green)

**Interfaces:**
- Produces: `export function deriveLayerSets(treatments: ChartExportTreatmentInput[]): { completed: Set<number>; proposed: Set<number>; declined: Set<number> }`

- [ ] **Step 1:** Change the function declaration from private to exported. In `chart-export.ts:89`, replace `function deriveLayerSets(` with `export function deriveLayerSets(`. No body change — precedence stays exactly as-is (`completed` first, `completed` wins over proposed, proposed supersedes declined).

- [ ] **Step 2:** Run the existing chart-export suite to confirm no regression.

Run: `cd services/api-ts && DATABASE_URL=postgres://…/monobase_test bun run test chart-export`
Expected: PASS (the export is behavior-neutral).

- [ ] **Step 3: Commit**

```bash
git add services/api-ts/src/handlers/dental-visit/chart/chart-export.ts
git commit -m "refactor(chart): export deriveLayerSets for per-visit chart layers"
```

---

### Task 2: TypeSpec — add `layers` to the chart response

**Files:**
- Modify: `specs/api/src/modules/dental-visit.tsp:166` (model `DentalChart`) and add a new model nearby.

**Interfaces:**
- Produces: generated SDK type `DentalChart.layers?: DentalChartLayerSets` and `DentalChartLayerSets { proposed: number[]; completed: number[]; declined: number[] }`.

- [ ] **Step 1:** Add the layer-sets model immediately above `model DentalChart` in `dental-visit.tsp`:

```tsp
/**
 * Per-visit treatment layer sets — FDI tooth numbers derived from THIS visit's
 * own treatments (precedence completed > proposed > declined). Lets historical
 * carousel snapshots paint Completed/Declined accurately as-of-that-visit,
 * instead of defaulting every tooth to Existing/baseline.
 */
model DentalChartLayerSets {
  proposed: int32[];
  completed: int32[];
  declined: int32[];
}
```

- [ ] **Step 2:** Add the optional field to `model DentalChart` (after `teeth: ToothChartState[];`):

```tsp
  /** Per-visit status layers for this visit's recorded treatments (see DentalChartLayerSets). Omitted on the baseline-fallback path. */
  layers?: DentalChartLayerSets;
```

- [ ] **Step 3:** Regenerate the spec + types (never hand-edit generated output).

Run: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`
Expected: OpenAPI + validators regenerate; `bun run typecheck` in `services/api-ts` still resolves `DentalChart`.

- [ ] **Step 4:** Regenerate the SDK so the FE sees `layers`.

Run: `cd packages/sdk-ts && bun run generate` (or the repo's SDK regen script)
Expected: `DentalChart` SDK type includes `layers?`.

- [ ] **Step 5: Commit**

```bash
git add specs/api/src/modules/dental-visit.tsp specs/api/dist services/api-ts/src/generated packages/sdk-ts/src/generated
git commit -m "feat(chart): add per-visit layers field to dental chart contract"
```

---

### Task 3 (RED→GREEN): Backend — populate `layers` in `getDentalChart`

**Files:**
- Modify: `services/api-ts/src/handlers/dental-visit/chart/getDentalChart.ts`
- Test: `services/api-ts/src/handlers/dental-visit/chart/__tests__/getDentalChart.test.ts`

**Interfaces:**
- Consumes: `deriveLayerSets` (Task 1), `TreatmentRepository.findByVisit(visitId): Promise<DentalTreatment[]>` (`repos/treatment.repo.ts:56`), `DentalChartRepository.findByVisit` (`repos/dental-chart.repo.ts:91`).
- Produces: GET chart response with `layers: { proposed: number[]; completed: number[]; declined: number[] }` when a per-visit chart row exists.

- [ ] **Step 1: Write the failing test.** Seed a visit with one `performed` treatment on tooth 11, one `planned` on tooth 21, one `declined` on tooth 46, plus a chart row covering those teeth. Assert the GET response's `layers`:

```ts
test('getDentalChart returns per-visit layers derived from this visit treatments', async () => {
  const app = buildTestApp();
  // ...seed visit + chart(teeth: 11,21,46) + treatments: 11 performed, 21 planned, 46 declined...
  const res = await app.request(`/dental/visits/${visitId}/chart`, { headers: authHeaders });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.layers.completed).toEqual([11]);
  expect(body.layers.proposed).toEqual([21]);
  expect(body.layers.declined).toEqual([46]);
});
```

- [ ] **Step 2: Run it — expect RED** ("layers" undefined).

Run: `cd services/api-ts && DATABASE_URL=postgres://…/monobase_test bun run test getDentalChart`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `getDentalChart.ts`, after the per-visit chart is found (the `if (chart) return ...` branch at line 32), derive and attach layers. Replace lines 30–32:

```ts
  const repo = new DentalChartRepository(db);
  const chart = await repo.findByVisit(visitId);
  if (chart) {
    const treatments = await new TreatmentRepository(db).findByVisit(visitId);
    const { completed, proposed, declined } = deriveLayerSets(
      treatments.map((t) => ({
        toothNumber: t.toothNumber,
        cdtCode: t.cdtCode,
        description: t.description,
        surfaces: t.surfaces,
        status: t.status,
        priceCents: t.priceCents,
      })),
    );
    return ctx.json({
      ...chart,
      layers: {
        proposed: [...proposed].sort((a, b) => a - b),
        completed: [...completed].sort((a, b) => a - b),
        declined: [...declined].sort((a, b) => a - b),
      },
    });
  }
```

Add imports at top: `import { TreatmentRepository } from '../repos/treatment.repo';` and `import { deriveLayerSets } from './chart-export';`. Leave the baseline-fallback branch (lines 37–42) unchanged — it omits `layers` (contract says optional).

- [ ] **Step 4: Run — expect GREEN.**

Run: `cd services/api-ts && DATABASE_URL=postgres://…/monobase_test bun run test getDentalChart`
Expected: PASS.

- [ ] **Step 5: Full backend verify gate.**

Run: `cd services/api-ts && bun run typecheck && bun run lint && bun run check:boundaries && DATABASE_URL=…/monobase_test bun run test`
Expected: all green, no regressions.

- [ ] **Step 6: Commit**

```bash
git add services/api-ts/src/handlers/dental-visit/chart/getDentalChart.ts services/api-ts/src/handlers/dental-visit/chart/__tests__/getDentalChart.test.ts
git commit -m "feat(chart): derive per-visit layers in getDentalChart"
```

---

### Task 4 (RED→GREEN): Contract test for the `layers` shape

**Files:**
- Modify/Create: `specs/api/tests/contract/` (follow the existing chart scenario pattern; reuse `/skill test-contract`)

- [ ] **Step 1:** Add a Hurl assertion to the chart-GET scenario verifying `layers.proposed`, `layers.completed`, `layers.declined` exist and are arrays for a visit that has treatments.
- [ ] **Step 2:** Run the contract suite — confirm RED if the impl weren't deployed, then GREEN against the running impl.

Run: `bun run scripts/run-contract-tests.ts` (boot impl first per `/skill test-contract`)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add specs/api/tests/contract
git commit -m "test(contract): assert per-visit layers on GET chart"
```

---

### Task 5 (RED→GREEN): Frontend — feed per-visit layers to historical cards

**Files:**
- Modify: `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx`
- Test: `apps/dentalemon/src/features/workspace/__tests__/timeline-carousel.test.ts`

**Interfaces:**
- Consumes: SDK `DentalChart.layers` (Task 2). Existing `DentalChart` props `completedToothNumbers/proposedToothNumbers/declinedToothNumbers: Set<number>`.
- Produces: historical cards render teeth on their correct layer; open card unchanged.

- [ ] **Step 1: Write the failing test.** Mock the chart fetch to return `layers: { completed: [11], proposed: [], declined: [46] }` for a *completed* (historical) visit, render the carousel, and assert that tooth 11 resolves to the `completed` layer and tooth 46 to `declined` on the historical card (via the `data-tooth-layer` attribute the DentalChart already emits at `dental-chart.tsx:251`).

```ts
test('historical card paints per-visit completed/declined layers from chart.layers', async () => {
  global.fetch = () => Promise.resolve(new Response(JSON.stringify({
    teeth: [{ toothNumber: 11, state: 'crown' }, { toothNumber: 46, state: 'healthy' }],
    layers: { completed: [11], proposed: [], declined: [46] },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  renderCarousel({ visits: [VISIT_OLD], patientId: 'p', onSelectVisit: () => {}, onNewVisit: () => {} });
  const t11 = await screen.findByTestId('tooth-11');
  expect(t11.getAttribute('data-tooth-layer')).toBe('completed');
  expect(screen.getByTestId('tooth-46').getAttribute('data-tooth-layer')).toBe('declined');
});
```

> NOTE: the FE test harness currently stubs `DentalChart` (`dental-chart-stub`). If the stub is in force, assert on the props forwarded to the stub instead of `data-tooth-layer` — confirm which by checking `test-setup.ts` before writing the assertion. Keep the assertion on the stable contract (layer per tooth), not styling.

- [ ] **Step 2: Run — expect RED.**

Run: `cd apps/dentalemon && bun run test timeline-carousel`
Expected: FAIL (historical card currently passes `undefined` layer sets).

- [ ] **Step 3: Implement.** In `VisitChartCard`'s `useQuery` (`timeline-carousel.tsx:166`), widen the `select` to keep `layers`:

```ts
  const { data, isLoading, isError, refetch } = useQuery({
    ...getDentalChartOptions({ path: { visitId: visit.id } }),
    select: (raw) => {
      const chart = raw as { teeth?: ToothData[]; layers?: { proposed: number[]; completed: number[]; declined: number[] } } | null;
      return { teeth: chart?.teeth ?? [], layers: chart?.layers };
    },
  });
  const teeth = data?.teeth ?? [];
  // Per-visit layer sets for HISTORICAL (non-open) snapshots. The open card keeps
  // the cumulative cross-visit sets passed via props (living-document semantics).
  const perVisitLayers = data?.layers;
  const toSet = (xs?: number[]) => (xs && xs.length ? new Set(xs) : undefined);
```

Update the `onTeethLoaded` effect to use `data?.teeth` (it reads `teeth.length` — unchanged var still valid). Then in the `<DentalChart .../>` block (`timeline-carousel.tsx:349`), change the three layer props to fall back to the per-visit sets on historical cards:

```tsx
            completedToothNumbers={isOpenVisit ? completedToothNumbers : toSet(perVisitLayers?.completed)}
            proposedToothNumbers={isOpenVisit ? proposedToothNumbers : toSet(perVisitLayers?.proposed)}
            declinedToothNumbers={isOpenVisit ? declinedToothNumbers : toSet(perVisitLayers?.declined)}
            carriedOverToothNumbers={isOpenVisit ? carriedOverToothNumbers : undefined}
            conflictedToothNumbers={isOpenVisit ? conflictedToothNumbers : undefined}
            visibleLayers={isOpenVisit ? visibleLayers : undefined}
```

(Only the first three lines change; the rest stay as-is. `visibleLayers` stays open-card-only so historical cards show all layers.)

- [ ] **Step 4: Run — expect GREEN.**

Run: `cd apps/dentalemon && bun run test timeline-carousel`
Expected: PASS.

- [ ] **Step 5:** Run the full FE suite to catch regressions in the existing carousel tests (esp. the P0-1 provenance and scope-label cases).

Run: `cd apps/dentalemon && bun run test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx apps/dentalemon/src/features/workspace/__tests__/timeline-carousel.test.ts
git commit -m "feat(workspace): paint per-visit status layers on historical carousel cards"
```

---

### Task 6 (RED→GREEN): Read-only layer key on historical cards

**Files:**
- Modify: `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx` (the header `else` branch at `:261-265`, currently an empty `<div aria-hidden />`)
- Test: `apps/dentalemon/src/features/workspace/__tests__/timeline-carousel.test.ts`

**Interfaces:** uses `getLayerLabel` (already imported) for "Existing / Planned / Completed / Declined" wording. Declined entry shown only when the card has declined teeth.

- [ ] **Step 1: Write the failing test.** Assert a historical card renders a non-interactive layer key (`data-testid="chart-layer-key"`) listing "Existing", "Planned", "Completed" (and "Declined" only when present).

- [ ] **Step 2: Run — expect RED.**

- [ ] **Step 3: Implement.** Replace the empty `<div aria-hidden />` in the non-open header branch with a static, non-button layer key (mirrors the open card's tab labels but read-only, so colors on the snapshot are interpretable). Show the Declined entry only when `toSet(perVisitLayers?.declined)` is non-empty. Keep height parity with the open card's `min-h-[44px]` row.

- [ ] **Step 4: Run — expect GREEN.** Then full FE suite.

Run: `cd apps/dentalemon && bun run test`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(workspace): show read-only status-layer key on historical cards"
```

---

### Task 7: E2E — past→present coherence

**Files:**
- Add to the existing workspace E2E flow (use `/skill test-e2e`; per memory, prefer Playwright E2E over human checkpoints).

- [ ] **Step 1:** With the demo seed (patient with ≥1 completed historical visit that had a performed treatment — e.g. P1 Maria Santos), open the workspace, page to a historical card, and assert the treated tooth carries the `completed` layer and the layer key is visible.
- [ ] **Step 2:** Run E2E (auto-boot per infra).

Run: `cd apps/dentalemon && bun run test:e2e` (or the repo E2E entrypoint)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git commit -am "test(e2e): historical card shows completed layer for past treatment"
```

---

### Task 8: Verify gate (P0 complete)

- [ ] Backend: `cd services/api-ts && bun run typecheck && bun run lint && bun run check:boundaries && DATABASE_URL=…/monobase_test bun run test` — all green.
- [ ] Frontend: `cd apps/dentalemon && bun run typecheck && bun run lint && bun run test` — all green.
- [ ] Contract: `bun run scripts/run-contract-tests.ts` — green.
- [ ] No regressions in the carousel provenance/scope-label tests.

A module is not complete until backend unit + contract + FE unit + E2E all pass.

---

## P1 / P2 / P3 — Follow-ups (scope after P0 ships; each is its own slice)

These were confirmed by review as real but non-blocking. Implement after P0 is merged. Each follows the same RED→GREEN→commit discipline; spell out the exact test before coding.

### P2-A: Completed teeth must be visibly distinct on the open card
- **Problem (confirmed, claim 6):** a `completed`-layer tooth whose `state` is `healthy` renders with no fill and no outline (`getLayerOutline` returns `undefined` for `completed`, `dental-chart.helpers.ts:273`) — indistinguishable from an untreated tooth.
- **Fix:** give the `completed` layer a subtle non-color affordance (e.g. a small ✓ corner badge or a faint solid neutral edge) in `dental-chart.tsx`/`getLayerOutline`, keeping lemon reserved for interaction. Add a CVD-safe redundant mark like the caries/fractured stipple pattern.
- **Files:** `dental-chart.helpers.ts:261`, `dental-chart.tsx:235`. Test: assert a completed+healthy tooth has a distinguishing marker.

### P2-B: Seed enrichment so demo snapshots read as a progression
- **Problem:** historical per-visit charts store only 1–4 teeth (`seed-demo.ts` templates `:200-313`). Snapshots are honest but sparse; with per-visit layers (P0) they're now meaningful, but richer snapshots demo better.
- **Fix:** in `scripts/seed-demo.ts`, have each historical template carry forward the prior visit's resulting tooth states (or seed the post-treatment state, e.g. caries→filled after a restoration) so paging past→present shows the mouth evolving.
- **Decision needed:** keep "snapshot = this encounter only" (P0 already makes this coherent) vs. "snapshot = full mouth as-of-date". Recommend the former (smaller, matches the existing "Visit snapshot" label). Treat P2-B as demo polish only.

### P3-A: Cross-module precedence contract test
- **Problem (confirmed gap):** FE `deriveChartLayerSets` (`chart-layers.ts`) and BE `deriveLayerSets` (`chart-export.ts`) must agree but share no code and have no cross-check.
- **Fix:** add a single shared fixture of (treatments → expected sets) consumed by a test in each workspace, OR document that both are pinned to the same fixture file. Low effort, prevents silent drift.

### P3-B: Rename "Existing" to reduce the "= all" misread
- **Problem:** "Existing" reads as "all teeth that exist" rather than "charted, no active treatment".
- **Fix:** change `LAYER_LABELS.baseline` in `dental-chart.helpers.ts:238` to "Untreated" or "No plan" (copy decision). Update `getLayerLabel` consumers + the export legend `CHART_EXPORT_LEGEND` (`chart-export.ts:79`) for consistency. Pure copy change; update snapshot/label tests.

---

## Self-Review

- **Spec coverage:** P0 Tasks 1–8 cover the confirmed root cause (historical cards can't show Completed/Declined → finding #3/#7 and the Declined-tab request, which review confirmed is the *same* root cause and resolves automatically via Task 5). Backend-first ordering honors the review's locked correction. Claim-6 invisibility → P2-A. Non-cumulative seed → P2-B (downgraded: P0 makes snapshots coherent; accumulation is by-design per the "Visit snapshot" label). Contract-drift gap → P3-A. "Existing" misread → P3-B.
- **Placeholder scan:** backend/FE code steps carry concrete diffs; contract/E2E steps reference the project's own `/skill test-contract` and `/skill test-e2e` patterns rather than inventing fixtures, and flag the one runtime check needed (is `DentalChart` stubbed in the FE harness — Task 5 Step 1 note).
- **Type consistency:** `deriveLayerSets` returns `Set<number>` everywhere; the wire shape is `number[]` (TypeSpec `int32[]`); the FE converts arrays→`Set` via `toSet`. `layers` is optional end-to-end (omitted on baseline fallback).
