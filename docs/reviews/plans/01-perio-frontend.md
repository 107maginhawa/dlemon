# P0-1 — Perio Charting Frontend (Implementation Design Plan)

> Plan date 2026-06-02 · Status: PROPOSED (no code) · Owner: clinical workspace
> Sources: `docs/reviews/modules/perio-review.md`, `docs/reviews/research/perio.md`,
> `services/api-ts/src/handlers/dental-perio/`, `docs/architecture/DESIGN.md`,
> `apps/dentalemon/src/features/workspace/`.

This plan covers **only the frontend**. The backend is complete, wired, and tested.
No backend changes are required for the MVP slices; the two backend P1 features
(CAL, AAP staging/grading) already landed and the frontend simply surfaces them.

---

## 1. Problem & current state

The perio module is a **fully-built, role-gated, audit-logged, tested backend with
ZERO frontend** — capability stranded and unreachable by any user (perio-review §4/§5,
finding **[P0]**). There is no `features/perio` dir, no route, no wireframe, and no
perio entry point in the workspace toolbar or tabs.

**What the backend already gives us (no work needed):**

- **Endpoints** (all wired in `generated/openapi/routes.ts`, 4 OpenAPI paths):
  - `POST /dental/perio-charts` — create one chart per visit (BR-P01); role-gated
    `dentist_owner | dentist_associate | hygienist`; audit `perio.chart.created`.
  - `PUT /dental/perio-charts/{chartId}/readings/{toothNumber}` — upsert a tooth
    reading (draft only → 409 `CHART_COMPLETED` once completed/locked). Validates
    FDI tooth (BR-P04), depths 0–20mm (BR-P03), mobility/furcation 0–3 (V-PER-004),
    gingival margin −5..20mm. **Returns the reading with the six derived per-site
    CAL values** (`calBM…calLD`) merged in (`computeReadingCal`).
  - `POST /dental/perio-charts/{chartId}/complete` — requires ≥16 readings adult /
    ≥8 primary (BR-P07); computes `summaryBopPercent`, `summaryMeanDepth`,
    `summaryDeepPocketCount` (depth ≥5mm). **Returns 2017 AAP/EFP `stage` / `grade`
    / `extent`** (optional risk-factor body: smoking, HbA1c, age, %bone-loss).
  - `GET /dental/perio-charts/{chartId}` and `GET …/visits/{visitId}/perio-chart` —
    read chart + readings, each reading carrying derived per-site CAL; lock cascades
    from the parent visit (`perio-lock-cascade.ts`).
- **SDK hooks already generated** (`packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts`):
  `createPerioChartMutation`, `upsertToothReadingMutation`, `completePerioChartMutation`,
  `getPerioChartOptions/Query`, `getVisitPerioChartOptions/Query`. **No SDK regen needed.**
- **Data shape**: `dental_perio_chart` (one per `visitId`, immutable once completed —
  `status` locks, `completedAt` set, summary stats frozen) + `dental_perio_tooth_reading`
  (one per chart×tooth; 6-point `depth*`, 6 per-site `bop*`, 6 per-site `gm*`,
  single `recession`, `mobility`, `furcation`, `plaque`, `suppuration`, `notes`).

**What's missing (this plan):** every pixel. The full-mouth adult exam is ~500 discrete
inputs (perio-review §4), so the UI must lead with auto-advance keyboard entry and a
red-line threshold view, not a naive 500-field grid.

---

## 2. Industry / clinical target

Grounded in `docs/reviews/research/perio.md`. The frontend must surface:

| Capability | Target | Backend support today |
| --- | --- | --- |
| 6-point probing depths | MB/B/DB + ML/L/DL per tooth, 0–20mm, rounded up | ✅ `depthBM…depthLD` |
| Per-site BOP | 6 booleans/tooth, recorded even at ≤3mm | ✅ `bopBM…bopLD` |
| Per-site gingival margin (signed vs CEJ) | −5..20mm | ✅ `gmBM…gmLD` (P1-5) |
| **Auto-CAL (read-only)** | per-site `CAL = PD + GM`, clamped ≥0 | ✅ derived server-side, returned on every read/upsert |
| Recession | per-tooth signed value | ✅ `recession` |
| Mobility (Miller 0–3) | N/1/2/3 | ✅ `mobility` |
| Furcation (Glickman/Hamp 0–3) | grade; gate to multi-rooted | ✅ `furcation` (no multi-root gate — FE soft-gates) |
| Plaque / suppuration | per-tooth boolean (per-site is a future backend P2) | ✅ `plaque`, `suppuration` |
| % BOP bucketed | health <10 / localized 10–30 / generalized >30 | ⚠️ raw % returned; **FE buckets** |
| **AAP stage I–IV / grade A/B/C / extent** | surfaced on completion | ✅ returned by `…/complete` (P1-6) |
| Red-line threshold viz | configurable depth threshold (default ≥5mm), out-of-range sites highlighted + count | ❌ FE-only |
| Multi-exam comparison | 4–6 exams side-by-side, trend arrows | ❌ FE-only (Phase 4 — see §6 deps) |
| Keyboard auto-advance entry | maxillary-first / facial-first sequencing | ❌ FE-only (this plan) |
| Voice / hands-free entry | spoken depths | **out of scope — separate plan** |

Out of scope for this plan (tracked elsewhere): voice entry, per-site plaque/suppuration/
calculus, MGJ/keratinized width, PDF export. These are backend-shaped changes or a
distinct voice plan and must not block P0.

---

## 3. Proposed UI design

### 3.1 Entry point & route

Match the existing workspace overlay/tab convention (`_workspace/$patientId.tsx`).
Perio is a per-visit clinical surface, so it opens **from the workspace**, scoped to
`currentVisitId` — identical lifecycle to Imaging / Recalls / Plans.

- **Tab trigger** in the workspace year-filter bar, next to `Imaging`/`Recalls`/`Plans`
  (`workspace-top-bar` area in `$patientId.tsx` lines ~241–269), `data-testid="perio-tab-btn"`,
  label **"Perio"**. Disabled with a tooltip when `currentVisitId === null`.
- **State**: add `const [perioOpen, setPerioOpen] = useState(false)` and render
  `<PerioChartOverlay … />` alongside the other overlays.
- **Optional deep-link route** (Phase 1, low cost): `routes/_workspace/$patientId.perio.tsx`
  so a perio exam is shareable/bookmarkable; the route just sets `perioOpen` on mount.
  PIN guard + `_workspace` auth already cover it.

The overlay (not a bottom sheet — perio needs near-full-screen real estate for the grid)
is a `role="dialog" aria-modal` full-screen panel using `useSheetA11y({ open, onClose })`
for Escape-to-close + focus return (same hook used by `recalls-sheet.tsx`).

**Chart bootstrap flow** inside the overlay:
1. On open, `getVisitPerioChartQuery({ visitId })`.
2. `404` (no chart yet) → show an empty state with a **"Start perio exam"** button →
   `createPerioChartMutation` → refetch. Mirrors recalls/imaging empty-state copy +
   `CalendarClock`-style centered icon.
3. Chart exists → render the grid in `draft` (editable) or read-only
   (`completed`/`locked`, or parent visit locked — backend already cascades).

### 3.2 Component tree (`apps/dentalemon/src/features/workspace/components/perio/`)

Co-located under `workspace/` because perio is a workspace surface (consistent with
the `dental/` subfolder convention). Components:

- **`perio-chart-overlay.tsx`** — dialog shell: header (patient/visit/examiner, status
  badge, threshold control, Complete button), bootstrap/empty/loading/error states,
  summary strip, and the grid. Owns open/close + a11y.
- **`perio-chart-grid.tsx`** — the chart matrix. Two arches (maxillary FDI 11–28 / 18–11
  then 21–28; mandibular 48–31 / 41–38), buccal row group above lingual row group, each
  tooth a column with its six site cells. Renders depth row, BOP dots, GM row, derived
  CAL row (read-only, muted), and per-tooth mobility/furcation/plaque/suppuration footer.
  Pure-ish; receives readings + handlers, no data fetching.
- **`perio-tooth-column.tsx`** — one tooth: 3 buccal + 3 lingual site inputs, recession,
  and the per-tooth controls. Furcation control disabled (soft-gated) on single-rooted
  teeth (incisors/canines/premolars per a small FDI→roots lookup helper).
- **`perio-site-cell.tsx`** — single editable depth/GM cell: numeric, 1–2 chars,
  auto-advances focus on entry, red text when over threshold (`text-destructive`),
  `aria-label` describing tooth+site (e.g. "Tooth 16 mesiobuccal depth").
- **`perio-bop-dot.tsx`** — toggle marker above each depth (per-site BOP); colored dot
  per research convention (markers above probing numbers).
- **`perio-summary-bar.tsx`** — headline metrics from `…/complete` / persisted summary:
  BOP% **with bucket label** (Healthy <10 / Localized 10–30 / Generalized >30 — FE
  buckets the raw %), mean depth, deep-pocket count, red (out-of-threshold) tooth count,
  and **Stage / Grade / Extent** chips once completed.
- **`perio-classification-panel.tsx`** — surfaces AAP `stage`/`grade`/`extent` with a
  short "assisted, clinician-confirmed" disclaimer; offers the optional risk-factor
  inputs (smoking cig/day, diabetes + HbA1c, age) passed to `completePerioChartMutation`
  so grade modifiers apply. Defaults sourced from medical history where available.

### 3.3 Data entry ergonomics (the core UX bet)

Per perio-review §4, manual keyboard entry of ~500 inputs must be efficient:

- **Auto-advance sequencing**: typing a depth (single keystroke for 1–9; two for 10+
  with a short debounce, or Tab/Space to commit) advances to the next site in a
  clinically standard order. Default **maxillary-first, facial (buccal) pass then lingual
  pass**, matching Open Dental's configurable sequencing. Sequence is a pure generator
  (testable in isolation).
- **Keyboard map**: digits = depth; `b` = toggle BOP at current site; `s`/`p` = toggle
  suppuration/plaque (per-tooth); arrow keys = manual navigation; `Enter` = next tooth;
  `Shift+Tab` = back. A small always-visible legend explains the keys.
- **Optimistic upsert**: each tooth's reading PUTs on tooth-complete (or debounced),
  via `upsertToothReadingMutation`; reuse the SDK's optimistic-mutation helper pattern
  where practical. Errors surface hook-level (one toast, per V-FE-ERR-001), never silent.
- **Red-line threshold**: a control in the header sets the depth threshold (default 5mm,
  matching the backend deep-pocket definition); cells ≥ threshold render red and a live
  count feeds the summary bar. Client-side only.
- **Read-only mode**: completed/locked charts (or locked parent visit) render
  non-editable with the summary + classification visible; the Complete button hides.
- **Completion**: "Complete exam" calls `completePerioChartMutation`; the
  `INSUFFICIENT_READINGS` 422 (and `CHART_COMPLETED` 409 / `VISIT_LOCKED`) are mapped to
  clear inline messages ("Chart 16/16 teeth before completing"). On success the overlay
  switches to read-only and shows Stage/Grade/Extent.

### 3.4 Reuse & design tokens

- **SDK hooks**: use the generated TanStack hooks directly. A thin
  `hooks/use-perio-chart.ts` wrapper (mirroring `use-recalls.ts`) exposes
  `{ chart, readings, isLoading, isError, startChart, upsertReading, completeChart,
  isCompleting }` and centralizes query-key invalidation — keeps components dumb.
- **Existing components**: reuse `universal-tooth-fdi.tsx` / `dental/types.ts` for tooth
  numbering + labels; reuse `useSheetA11y`; follow the `chart-compare-overlay.tsx`
  reduced-motion + `role="dialog"` pattern for the (later) comparison view.
- **DESIGN.md tokens** (`docs/architecture/DESIGN.md`): Apple-HIG surfaces, `rounded-2xl`
  panels, `text-sm`/`text-xs` hierarchy, 44px min touch targets (iPad chairside).
  Lemon accent for primary actions only — `bg-lemon hover:bg-lemon-hover
  text-lemon-foreground` (Complete / Start exam), exactly as the workspace footer/recalls
  Save button. Red-line uses the semantic `text-destructive`; BOP dots and out-of-range
  emphasis must not co-opt the lemon accent (DESIGN.md "Don't" — accent is for primary
  action, not data state). Status badge styling matches the recalls `STATUS_BADGE_CLASS`
  convention.

---

## 4. Vertical-TDD test plan

Per `docs/development/VERTICAL_TDD.md`, tests are written RED first. Backend layers are
already green; this plan starts at step 7 (frontend tests) and step 9 (E2E).

**Frontend unit (Bun + Testing Library), co-located `*.test.ts(x)`:**

1. `perio-sequence.test.ts` — auto-advance generator: maxillary-first/facial-then-lingual
   order, wrap to next tooth, primary vs adult tooth sets, back-navigation.
2. `perio-cal-display.test.ts` — CAL is rendered read-only from the API value and never
   editable; null CAL (partial site) shows a placeholder, not 0.
3. `perio-threshold.test.tsx` — cells ≥ threshold get `text-destructive`; out-of-range
   count updates when threshold changes; default 5mm.
4. `perio-bop-bucket.test.ts` — raw BOP% → bucket label (9.9→Healthy, 10→Localized,
   30.1→Generalized) boundary cases.
5. `perio-site-cell.test.tsx` — keystroke advances focus; `b` toggles BOP; depth clamps
   to 0–20; non-numeric rejected.
6. `perio-chart-overlay.test.tsx` — bootstrap states: 404→empty/Start, draft→editable,
   completed→read-only + Stage/Grade chips; Complete disabled under 16 readings;
   `INSUFFICIENT_READINGS`/`CHART_COMPLETED` map to inline messages.
7. `use-perio-chart.test.ts` — query-key invalidation after upsert/complete; single
   error toast on failure (V-FE-ERR-001).
8. `furcation-gate.test.ts` — furcation control disabled for single-rooted FDI teeth.

**E2E (Playwright):** `perio-charting.e2e.ts` against the seeded demo (`db:reseed`):
open workspace → active visit → Perio tab → Start exam → enter ≥16 teeth via keyboard
auto-advance → verify a red (≥5mm) cell + out-of-range count → verify CAL renders →
Complete → assert Stage/Grade/Extent + BOP bucket appear and the chart is read-only;
reopen and confirm a completed chart is immutable (no inputs editable). Per the
"real wiring" memory, the E2E must hit the real server (not a mocked SDK).

**Gate:** all FE unit + E2E pass; `bun run test` and `bun run typecheck` green with no
regressions before the slice is "done". (Backend `check:boundaries` unaffected — no
backend edits.)

---

## 5. Phasing & effort (S / M / L per slice)

| # | Slice | Scope | Effort |
| --- | --- | --- | --- |
| 1 | **Entry + bootstrap** | Perio tab + overlay shell, `use-perio-chart` wrapper, getVisit→404→Start→create flow, empty/loading/error/read-only states, deep-link route | **M** |
| 2 | **6-point grid + entry** | grid/column/cell/BOP-dot, depths + GM + recession + per-tooth controls, optimistic upsert, **keyboard auto-advance** + legend | **L** |
| 3 | **CAL + threshold + summary** | read-only per-site CAL row, red-line threshold control + out-of-range count, summary bar with BOP bucketing | **M** |
| 4 | **Completion + AAP** | Complete flow, risk-factor inputs panel, Stage/Grade/Extent chips, completion error mapping, read-only lock | **M** |
| 5 | **Multi-exam comparison** | side-by-side ≥2 exams (target 4–6), per-site diff + trend arrows, reduced-motion; carousel integration | **L** — *depends on §6* |

MVP = slices 1–4 (closes the P0 stranded-capability gap and surfaces both backend P1s).
Slice 5 is the carousel anchor and may ship as a fast-follow.

---

## 6. Dependencies

- **SDK hooks**: already generated — none required. (If the `…/complete` body or
  CAL/Stage response shape changes, `cd specs/api && bun run build` then SDK regen.)
- **Seed data**: E2E needs visits with ≥16-tooth perio charts in `db:reseed`. Current
  demo seed has no perio charts — **add a perio fixture to the seed** (one completed
  chart per a couple of demo patients) as part of slice 4/E2E. Small backend/seed task.
- **Comparison (slice 5)** depends on the **perio comparison P1-7** work and the approved
  **carousel/snapshot concept** (perio-review §6; `project_carousel_design_approved.md`).
  The data model is already snapshot-shaped (immutable per-visit charts + frozen
  summaries), so slice 5 reuses the carousel frame model and `chart-compare-overlay`
  diff/reduced-motion patterns; do not block slices 1–4 on it.
- **Risk-factor sourcing**: smoking/HbA1c/age ideally pre-filled from medical history
  (`features/pmd` / medical-history hooks); acceptable to start with manual entry and
  wire the prefill in a follow-up.

---

## 7. Risks

- **Auto-advance UX is the make-or-break and the hardest part.** A ~500-input full-mouth
  exam is unusable without correct, fast keyboard sequencing; getting the order, the
  multi-digit commit (10+mm), and focus management wrong makes the feature DOA chairside.
  Mitigation: isolate the sequence as a pure, exhaustively-tested generator (test #1);
  prototype the cell-input interaction early in slice 2 and dogfood on iPad.
- **No multi-root furcation gate or per-site plaque/suppuration in the backend** — FE
  soft-gates furcation and treats plaque/suppuration as per-tooth; risk of later schema
  change. Mitigation: keep these behind small mapping helpers so a future per-site
  backend change is localized.
- **CAL trust**: CAL is derived server-side and must be rendered strictly read-only;
  any editable/locally-recomputed CAL would risk drift from the backend formula.
  Mitigation: display only the API-returned value; test #2 asserts non-editability.
- **Read-only/lock correctness**: parent-visit lock cascade is server-side; FE must
  honor `status` and the cascade on read, or a clinician could think they edited a
  locked chart. Mitigation: drive editability solely off the fetched `status`.
- **Seed gap** blocks E2E until a perio fixture exists (dependency above).

---

### Single biggest risk
The **keyboard auto-advance entry ergonomics** — without correct, fast sequencing the
~500-input full-mouth exam is impractical chairside and the feature fails on day one
(Nielsen efficiency-of-use). It is isolated as a pure, exhaustively-tested generator and
prototyped first in slice 2.
