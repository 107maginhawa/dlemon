# Timeline Carousel — Concept Reference

> **How to use this doc:** §1 is the standalone paste-to-stranger summary. §2–§9 embed the actual implementation code. §10 lists known gaps with code excerpts showing the problem. §11 contains five ready-to-paste prompts for asking another AI to help with specific gaps. §12 tells you how to regenerate this doc when the code changes.

---

## §1. The Concept (paste-this-first)

The **timeline carousel** is the core UX of the dental workspace. It's a horizontally-swipeable 3D coverflow (Apple Cover Flow style) where each card represents one patient visit. Every card renders a full interactive SVG chart of all 32 teeth, color-coded by their state at the time of that visit. The clinician swipes left/right through the patient's history — the leftmost card is the oldest visit, the rightmost is the most recent. The most recent visit is auto-selected on load. Below the carousel is a dashed "+ New Visit" button.

The design rationale is the **cumulative snapshot model**: each visit stores a *full* snapshot of all 32 teeth, not a diff. Like git commits — each one is self-contained, and the diff is implicit between adjacent cards. Past visits are read-only once locked. This is the product differentiator: a clinician can watch a tooth's condition evolve across years without manually reconstructing history from a table. Traditional dental software uses a flat chart that overwrites itself; this system shows *when* things changed and *in what context*.

---

## §2. The Carousel Component — Swiper Config

The carousel is built with [Swiper.js](https://swiperjs.com/) using the `EffectCoverflow` module. Visits are sorted oldest → newest; `initialSlide = sorted.length - 1` means the most recent visit is selected on mount. Keyboard arrows work out of the box via the `Keyboard` module. Clicking any non-active slide selects it and fires `onSelectVisit(visitId)` to sync the rest of the workspace.

```tsx
// apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx

export function TimelineCarousel({ visits, patientId, onSelectVisit, onNewVisit, onSelectTooth, panelOpen = false }) {
  const lockMutation = useUpdateVisit(patientId);
  // Sort oldest → newest so initialSlide = last index = most recent
  const sorted = [...visits].sort(
    (a, b) =>
      new Date(a.activatedAt ?? a.createdAt).getTime() -
      new Date(b.activatedAt ?? b.createdAt).getTime(),
  );

  const initialSlide = Math.max(0, sorted.length - 1);
  const [activeIndex, setActiveIndex] = useState(initialSlide);

  function handleSlideChange(swiper: { activeIndex: number }) {
    const idx = swiper.activeIndex;
    setActiveIndex(idx);
    const visit = sorted[idx];
    if (visit) onSelectVisit(visit.id);
  }

  return (
    <div
      data-testid="timeline-carousel"
      className="flex flex-col gap-4 py-4 transition-all duration-300"
      style={{ width: panelOpen ? 'calc(100% - 340px)' : '100%' }}
    >
      <Swiper
        modules={[EffectCoverflow, Pagination, Keyboard]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        observer
        observeParents
        initialSlide={initialSlide}
        onSlideChange={handleSlideChange}
        // ↓ the magic numbers for the 3D coverflow look
        coverflowEffect={{ rotate: 35, stretch: 0, depth: 200, modifier: 1, scale: 0.72, slideShadows: false }}
        pagination={{ clickable: true }}
        keyboard={{ enabled: true }}
        className="dental-swiper"
      >
        {sorted.map((visit, idx) => {
          const isActive = idx === activeIndex;
          return (
            <SwiperSlide key={visit.id}>
              <VisitChartCard
                visit={visit}
                isActive={isActive}
                onSelectTooth={onSelectTooth}
                onLockVisit={(visitId) =>
                  lockMutation.mutate({ path: { visitId }, body: { status: 'locked' } })
                }
                lockPending={lockMutation.isPending}
              />
            </SwiperSlide>
          );
        })}
      </Swiper>

      <button type="button" data-testid="new-visit-btn" onClick={onNewVisit} ...>
        + New Visit
      </button>
    </div>
  );
}
```

> **Note:** `panelOpen` prop exists but is hardcoded to `false` at the call site — sizing is handled by outer container padding instead. See G9 in §10.

---

## §3. Each Card — Per-Visit Chart Query

Each slide renders a `VisitChartCard` component that **fetches its own chart** independently via TanStack Query. The active card shows teeth at `toothSize='md'` (interactive, clickable); flanking cards show at `toothSize='xs'` (tiny, display-only). Slide selection simply flips `isActive`, which drives the size and whether `onSelectTooth` is wired.

```tsx
// apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx

/** Per-card component that fetches its own chart data */
function VisitChartCard({ visit, isActive, onSelectTooth, onLockVisit, lockPending }) {
  const { data } = useQuery({
    ...getDentalChartOptions({ path: { visitId: visit.id } }),
    select: (raw) => {
      const chart = raw as { teeth?: ToothData[] } | null;
      return chart?.teeth ?? [];
    },
  });
  const teeth = data ?? [];

  return (
    <div
      data-testid="visit-slide"
      data-active-card={isActive ? '1' : undefined}
      className={`h-full rounded-2xl border bg-card p-3 pt-4 flex flex-col gap-2 ...
        ${isActive ? 'border-[#FFCC5E] border-2 shadow-...' : 'border-border shadow-...'}`}
    >
      {isActive && <div data-accent-bar className="h-1 rounded-full bg-[#FFE97D]" />}
      <DentalChart
        teeth={teeth}
        onSelectTooth={isActive ? onSelectTooth : undefined}
        toothSize={isActive ? 'md' : 'xs'}
        showLegend={false}
      />
      {/* footer: visit date, status pill, Lock Visit button */}
    </div>
  );
}
```

> **N+1 note:** Each `VisitChartCard` fires `GET /dental/visits/{visitId}/chart` on mount. 20 visits = 20 simultaneous HTTP calls. There is no prefetch coordination and no priority for the active card. See G7 in §10.

---

## §4. Data Model — Snapshot Semantics

`dental_chart` is **one row per visit**. The `teeth` column is a `jsonb` array of `ToothChartState` objects — it is *not* a fixed 32-slot array. Teeth the clinician hasn't touched are simply absent from the array; the client-side `DentalChart` component treats missing entries as `'healthy'`. Each visit's chart is a complete snapshot of only the teeth that have been recorded for that patient up to that visit.

Each new visit's chart is seeded from the previous visit's chart by the server (the client never carries state forward). Once a visit is `completed` or `locked`, the chart row is frozen by convention (no DB constraint enforces this — see G2 in §10).

```ts
// services/api-ts/src/handlers/dental-visit/repos/dental-chart.schema.ts

export const toothStateEnum = pgEnum('tooth_state', [
  'healthy',
  'caries',
  'fractured',
  'filled',
  'crown',
  'missing',
  'implant',
  'extracted',
  'watchlist',
]);

export const toothSurfaceEnum = pgEnum('tooth_surface', [
  'mesial', 'distal', 'buccal', 'lingual', 'occlusal', 'incisal', 'cervical',
]);

export const chartEntryClassificationEnum = pgEnum('chart_entry_classification', [
  'existing',       // work done before this practice
  'existing_other', // done at another practice
  'treatment_plan', // planned future work
  'condition',      // observation / finding only
]);

export type ChartEntryClassification = typeof chartEntryClassificationEnum.enumValues[number];

export interface ToothChartState {
  toothNumber: number;
  state: string;                            // one of toothStateEnum values
  surfaces?: string[];                      // tooth surfaces affected
  conditionCode?: string;                   // ICD-10 or custom code
  note?: string;
  surfaceConditionMap?: Record<string, unknown>;
  entryClassification?: ChartEntryClassification;
}

export const dentalCharts = pgTable('dental_chart', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  teeth: jsonb('teeth').notNull().$type<ToothChartState[]>(),
}, (table) => ({
  visitIdx: index('dental_chart_visit_id_idx').on(table.visitId),
  patientIdx: index('dental_chart_patient_id_idx').on(table.patientId),
}));
```

> **Notice:** there is no `dental_chart_version` table. Compare to `visit_note_version` (§6) which is append-only. See G2 in §10.

---

## §5. State Model — Design Intent vs Code Reality

There are **two orthogonal state axes** in the code that the design doc attempts to fuse into a single visual model. Understanding this split is essential.

**Axis A — Tooth appearance** (`tooth_state` enum): describes what the tooth *looks like* or what's structurally present. This is stored on `ToothChartState.state` in the chart row. Clinically: "this tooth has a crown," "this tooth is missing," "this tooth has caries."

**Axis B — Treatment workflow** (`dental_treatment_status` enum): describes where a *piece of recommended work* is in the clinical workflow. This is stored on `DentalTreatment.status` in the treatments table — completely separate from the chart.

```ts
// apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts:10
export type ToothState =
  | 'healthy' | 'caries' | 'fractured' | 'filled' | 'crown'
  | 'missing' | 'implant' | 'extracted' | 'watchlist';
```

```ts
// services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts:13-20
export const dentalTreatmentStatusEnum = pgEnum('dental_treatment_status', [
  'diagnosed',  // clinician observed a problem
  'planned',    // treatment scheduled / accepted
  'performed',  // work done
  'verified',   // reviewed and confirmed complete
  'dismissed',  // dropped (terminal)
  'declined',   // patient refused (terminal)
]);
```

**Design vs code mapping:**

| Design intent (6+2 model) | What it actually maps to in code |
|---|---|
| Healthy | `tooth_state = 'healthy'` |
| Diagnosed | `treatment_status = 'diagnosed'` (on a `DentalTreatment` row) |
| Planned | `treatment_status = 'planned'` |
| In Progress | **No code equivalent** — design-only concept |
| Completed | `treatment_status = 'performed'` or `'verified'` |
| Existing Restoration | `chart_entry_classification = 'existing'` + `tooth_state = 'filled'` or `'crown'` |
| Missing (structural) | `tooth_state = 'missing'` or `'extracted'` |
| Impacted (structural) | **No code equivalent** — design-only concept |

The design's unified "6 status + 2 structural" language makes sense as a UX vocabulary for clinicians, but the implementation keeps appearance and workflow as separate concerns. Any AI working on this needs to hold both axes in mind simultaneously.

---

## §6. Treatment FSM — Allowed Transitions

Treatment status follows a strict forward-only FSM enforced at the HTTP layer (`updateDentalTreatment.ts`). **You cannot jump `diagnosed` → `performed` in a single PATCH** — it returns 422. You must do two: `diagnosed` → `planned`, then `planned` → `performed`. Performing also requires a signed consent form for the visit (`TREATMENT_CONSENT_REQUIRED` error).

```ts
// services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts:89-97

/** Valid forward-only transitions. dismissed/declined are reachable from any non-terminal state. */
export const TREATMENT_TRANSITIONS: Record<DentalTreatmentStatus, DentalTreatmentStatus[]> = {
  diagnosed: ['planned', 'dismissed', 'declined'],
  planned:   ['performed', 'dismissed', 'declined'],
  performed: ['verified', 'dismissed'],
  verified:  ['dismissed'],
  dismissed: [], // terminal
  declined:  [], // terminal — patient declined recommended treatment
};
```

Visit status also has a separate FSM: `draft → active → completed → locked`, `active → discarded` (auto business rule BR-005).

Visit notes use append-only versioning: `visit_note_version` table gets a new snapshot row on each sign or addendum:

```ts
// services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts:71-77
export const visitNoteVersions = pgTable('visit_note_version', {
  ...versionedSnapshotFields(),
  noteId: uuid('note_id').notNull().references(() => visitNotes.id, { onDelete: 'cascade' }),
}, (table) => ({
  uniqueNoteVersion: unique('visit_note_version_note_version_uniq').on(table.noteId, table.version),
  noteIdx: index('visit_note_version_note_id_idx').on(table.noteId),
}));
```

**Note the contrast:** visit notes are append-only and versioned; `dental_chart` rows are mutable in place (see G2 in §10).

---

## §7. Save Flow — Chart + Treatment Dual Mutation

When the clinician edits a tooth in the slideout and hits Save, `useSaveToothFlow` orchestrates two sequential mutations:

1. **Chart save** — `POST /dental/visits/{visitId}/chart` with the full updated `teeth[]` array.
2. **Treatment save (optional)** — `POST /dental/visits/{visitId}/treatments` if a CDT code was entered. Only fires on chart-save success. Treatment failure is **non-fatal and silently swallowed**.

```ts
// apps/dentalemon/src/features/workspace/hooks/use-save-tooth-flow.ts (full implementation)

export function useSaveToothFlow({ visitId, patientId, teeth, selectedTooth, onSuccess }) {
  const saveChartMutation = useSaveChart();
  const saveTreatmentMutation = useSaveTreatment();

  const isSaving = saveChartMutation.isPending || saveTreatmentMutation.isPending;

  function saveToothData(data: ToothSlideoutData) {
    const toothNumber = selectedTooth;
    if (!visitId || !toothNumber) return;
    if (!isValidFdiNumber(toothNumber)) {
      console.error(`Invalid FDI tooth number: ${toothNumber}`);
      return;
    }

    // Build updated teeth array — full snapshot, not a delta
    const updatedTeeth: ToothData[] = [...teeth];
    const toothEntry: ToothData = {
      toothNumber,
      state: data.state,
      surfaces: data.surfaces,
      conditionCode: data.conditionCode,
      surfaceConditionMap: data.surfaceConditionMap,
      entryClassification: data.entryClassification,
    };
    const idx = updatedTeeth.findIndex((t) => t.toothNumber === toothNumber);
    if (idx >= 0) updatedTeeth[idx] = toothEntry;  // update existing
    else updatedTeeth.push(toothEntry);             // or append new

    // Parse price (dollars, not cents — conversion happens in saveTreatment)
    let priceAmount: number | undefined;
    if (data.cdtCode && data.description && data.priceInput !== undefined && data.priceInput !== '') {
      const raw = parseFloat(data.priceInput);
      if (isNaN(raw)) {
        console.error('Invalid price input — treatment not saved');
        return;
      }
      priceAmount = raw;
    }

    saveChartMutation.mutate(
      { visitId, patientId, teeth: updatedTeeth },
      {
        onSuccess: () => {
          onSuccess?.(); // clears slideout / tooth selection
          if (data.cdtCode && data.description && priceAmount !== undefined) {
            saveTreatmentMutation.mutate(
              {
                visitId, patientId, cdtCode: data.cdtCode, description: data.description,
                toothNumber, surfaces: data.surfaces, conditionCode: data.conditionCode,
                priceAmount, currency: 'PHP', clinicalNotes: data.clinicalNotes,
              },
              {
                onError: (err) => {
                  // ⚠️ G8: treatment failure is console.error only — no UI feedback
                  console.error(
                    'Treatment save failed — chart was saved but treatment was not recorded',
                    err,
                  );
                },
              },
            );
          }
        },
      },
    );
  }

  return { saveToothData, isSaving };
}
```

> **G8 visible here (line `onError`):** treatment failure logs to console but shows no toast, no inline error, nothing. The user sees a successfully saved chart and reasonably assumes the treatment was also recorded. It wasn't.

---

## §8. Cumulative History — Server-Side Reconstruction

`GET /dental/visits/history/{patientId}/teeth/{toothNumber}` gives a per-tooth timeline: the state and active treatment for that tooth across every completed/locked visit, reverse-chronologically. The server iterates visits individually — there is no batch fetch.

```ts
// services/api-ts/src/handlers/dental-visit/getToothHistory.ts:42-77

const completedVisits = visits.filter(v => v.status === 'completed' || v.status === 'locked');

const entries: Array<{
  visitId: string;
  visitDate: Date;
  toothNumber: number;
  state: string;
  conditionCode?: string;
  treatmentCdtCode?: string;
  treatmentDescription?: string;
}> = [];

// ⚠️ G6: two awaits per visit inside a for-loop = N+1 query pattern
for (const visit of completedVisits) {
  const chart = await chartRepo.findByVisit(visit.id);        // await #1
  if (!chart) continue;

  const tooth = chart.teeth.find(t => t.toothNumber === toothNumber);
  if (!tooth) continue;

  const treatments = await treatmentRepo.findByVisit(visit.id); // await #2
  const toothTreatment = treatments.find(
    t => t.toothNumber === toothNumber && t.status !== 'dismissed'
  );

  entries.push({
    visitId: visit.id,
    visitDate: visit.completedAt ?? visit.createdAt,
    toothNumber,
    state: tooth.state,
    conditionCode: tooth.conditionCode,
    treatmentCdtCode: toothTreatment?.cdtCode,
    treatmentDescription: toothTreatment?.description,
  });
}

// Reverse-chronological
entries.sort((a, b) => b.visitDate.getTime() - a.visitDate.getTime());
```

> **G6 visible here:** 30 visits = 60 sequential database round-trips (`chart` + `treatments` per visit). No batch query, no JOIN.

---

## §9. Endpoints Reference

All routes served from `services/api-ts` (Hono + OpenAPI):

- `GET /dental/visits/{visitId}/chart` — returns the visit's full `teeth[]` snapshot.
- `POST /dental/visits/{visitId}/chart` — upserts the **entire** `teeth[]` array (full snapshot write, not a delta).
- `POST /dental/visits/{visitId}/carry-over` — copies `diagnosed`/`planned` non-dismissed treatments from up to **5** prior visits into the current visit.
- `GET /dental/visits/history/{patientId}/teeth/{toothNumber}` — reverse-chrono per-tooth slice across all completed/locked visits (see §8).
- `POST /dental/visits/{visitId}/notes/sign` — flips note `signed=true`, writes `visit_note_version` v1 snapshot, locks the note (addendums only from here).
- `POST /dental/visits/{visitId}/templates/{templateId}/apply` — fans `template.items[]` into `dental_treatment` rows with `status='planned'`; blocked when visit is `completed`/`locked`.
- `PATCH /dental/visits/{visitId}/treatments/{treatmentId}` — transitions treatment status (see FSM in §6).
- `GET /dental/visits/{visitId}` / `GET /dental/visits?patientId={id}` — visit CRUD backing the carousel `visits[]` prop.

---

## §10. Known Gaps & Divergences

### G1 — Design state taxonomy ≠ code
The design doc specifies "6 status + 2 structural" states. Code has 9 `ToothState` (appearance) + 6 `DentalTreatmentStatus` (workflow) as orthogonal axes. See §5 for the full mapping table. "In Progress" and "Impacted" have no code equivalent at all. An AI working on the UI vocabulary must decide which axis drives color coding, which drives icon overlays, and how they compose.

### G2 — No `dental_chart_version` table
Visit notes have `visit_note_version` (append-only, one row per sign/addendum). The `dental_chart` table has no parallel. A clinician who edits a tooth on a past `active` visit silently overwrites the historical snapshot with no audit trail.

```ts
// dental-chart.schema.ts — no version table alongside dentalCharts
export const dentalCharts = pgTable('dental_chart', {
  ...baseEntityFields,          // id, createdAt, updatedAt — but no version column
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  teeth: jsonb('teeth').notNull().$type<ToothChartState[]>(), // ← mutable in place
});
// contrast: visitNoteVersions has unique(noteId, version) and is never updated
```

### G3 — Time-lapse playback not implemented
The design doc describes a Play button that steps through visit cards with 300ms CSS fill transitions, so the tooth chart "animates" through history. Not in code. No `useTimelapse` hook, no animation orchestrator, no speed control.

### G4 — Year-grouping tabs not implemented
PRD §3.4: "When patient history spans >1 year, show tabs `[2026][2025][2024][All]`." Not implemented. No tab UI above the carousel.

### G5 — No reduced-motion fallback
PRD AC3.6: when `prefers-reduced-motion: reduce`, fall back to flat 2D snap-scroll carousel instead of 3D coverflow. The Swiper config in §2 has no media-query branch.

```tsx
// timeline-carousel.tsx — no reduced-motion guard
coverflowEffect={{ rotate: 35, stretch: 0, depth: 200, ... }}
// needs: if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) use flat scroll
```

### G6 — N+1 in `getToothHistory`
See §8. Two `await`s per completed visit inside a serial `for` loop. 30-visit patient = 60 sequential DB calls.

### G7 — Per-card chart fetch fan-out
Every `VisitChartCard` fires `GET /dental/visits/{id}/chart` independently on mount (see §3). No `batchGetCharts` endpoint. No priority queue (active card should load first). 20 visits on a slow connection = 20 concurrent requests.

### G8 — Treatment save error silently swallowed
See §7. `onError` in `saveTreatmentMutation` only `console.error`s. User gets no feedback. Chart row is persisted; treatment row may not be.

### G9 — `panelOpen` prop is dead-coded
`TimelineCarousel` accepts `panelOpen` and uses it to set `width: calc(100% - 340px)`. But the route (`$patientId.tsx:277`) passes `panelOpen={false}` hardcoded and instead adds `paddingRight: 340` to the outer container when the slideout opens. Two layout systems doing the same job.

### G10 — Incomplete legend
`dental-chart.tsx` legend only renders 7 of the 9 `ToothState` values. `watchlist` and `implant` are defined and color-mapped but absent from the legend.

### G11 — Pediatric charting unwired
`PEDIATRIC_TOOTH_NUMBERS` (20 deciduous teeth, FDI E1–E5 per quadrant) is exported from `dental-chart.helpers.ts` but not used by the carousel, chart component, or any route. Pediatric dentition support is scaffolded but not wired.

### G12 — Tamper-evidence deferred
`dental_chart` and `treatment_plan_version` tables have no DB-level `REVOKE UPDATE/DELETE` to enforce immutability. Schema comment in `treatment-plan-version.schema.ts` explicitly defers this to "a future hardening pass." Only application-layer conventions prevent retroactive edits.

---

## §11. Ready-to-Paste Prompts for Another AI

**How to use:** Paste the full content of §1–§9 into your chat first (so the AI has the concept + code). Then paste one of the prompts below.

---

**Prompt 1 — Reconcile the state model (G1)**

```
Context: I've pasted the carousel concept doc above. The core issue is in §5: the design specifies 6 status states + 2 structural states as a unified clinical vocabulary, but the code separates tooth appearance (tooth_state enum, 9 values) from treatment workflow (dental_treatment_status enum, 6 values). These are orthogonal axes.

Task: Propose a concrete reconciliation. Options might include: (a) updating the design vocabulary to match the code axes, (b) adding a computed "display status" derived from both axes for UI purposes, or (c) introducing a thin mapping layer. Give me a decision matrix (option × tradeoff), pick one, and outline the exact code changes needed.

Constraints: Vertical TDD — tests first. No new tables unless the approach genuinely requires persistence. The two DB enums (tooth_state, dental_treatment_status) must remain orthogonal — do not conflate them.

What good looks like:
- A clear, documented mapping from design vocabulary → code fields (extends the table in §5).
- If UI code changes: updated ToothState or a new computed type, with test coverage.
- Zero migration required if it's purely a UI-layer change.
```

---

**Prompt 2 — Design `dental_chart_version` (G2)**

```
Context: I've pasted the carousel concept doc above. The gap is in §10/G2: dental_chart rows are mutable in place, but visit_note_version is append-only. The design intent ("git commits, not diffs") implies past charts should be immutable once a visit is completed/locked.

Task: Design an append-only version table for dental_chart that mirrors visit_note_version. Specify:
1. Schema (Drizzle pgTable) — what columns, what indexes, what FK.
2. Trigger points — when should a new version row be written? (on visit completed transition? on every POST /dental/visits/{id}/chart? both?)
3. Repository changes — new methods on DentalChartRepository.
4. Migration SQL — safe to run on existing data (no data loss).
5. Any changes needed to the getDentalChart / upsertDentalChart handlers.

Constraints: Vertical TDD. Do not add a version table to dental_treatment — scope this to dental_chart only. The version table must have a unique(chartId, version) constraint mirroring visit_note_version_note_version_uniq.

What good looks like:
- Drizzle schema compiles, migration is additive (no dropped columns).
- Existing GET /dental/visits/{id}/chart returns the latest version transparently.
- A new GET /dental/visits/{id}/chart/history endpoint (or query param) surfaces the version history.
- Tests cover: write version on complete, read latest, read history.
```

---

**Prompt 3 — Implement time-lapse playback (G3)**

```
Context: I've pasted the carousel concept doc above. The design doc (2026-05-07) describes a Play button that steps the carousel through visit cards and lets the SVG tooth chart "animate" between states — 300ms CSS fill transitions, persistent SVG (no remount). See §2–§3 for the current Swiper setup and §10/G3 for status.

Task: Design and implement the time-lapse feature. Requirements:
- Play/pause button above or below the carousel.
- On Play: automatically advance the active slide at a configurable cadence (default: 1.5s/card, adjustable).
- Tooth color transitions should use CSS (fill transition 300ms ease) — the SVG must NOT unmount between slides (it already doesn't unmount because Swiper keeps all slides in DOM; confirm this holds).
- On reaching the last slide, stop (no loop).
- Keyboard: Space bar to play/pause; Escape to stop and return to most-recent.
- Accessibility: announce current slide date to screen reader on advance.

Constraints: Vertical TDD. No new dependencies — use Swiper's existing programmatic API (swiper.slideNext()). Respect prefers-reduced-motion (skip animation, still advance slides).

What good looks like:
- useTimelapse hook with { play, pause, stop, isPlaying, speed } interface.
- Playwright E2E: play → verify slides advance → pause → verify stopped → resume → verify continues.
- No regression on manual swipe behavior.
```

---

**Prompt 4 — Audit carry-over correctness**

```
Context: I've pasted the carousel concept doc above. The carry-over endpoint (POST /dental/visits/{visitId}/carry-over) copies diagnosed/planned non-dismissed treatments from prior visits. In §9 I noted it hard-codes a 5-visit lookback. See services/api-ts/src/handlers/dental-visit/carryOverTreatments.ts for the implementation.

Task:
1. Read carryOverTreatments.ts and find where the 5-visit limit is set.
2. Assess: is 5 the right limit? What happens to a patient with 6+ prior visits who had work diagnosed in visit 1 that's still unaddressed? Does it silently drop?
3. Write a test that proves the edge case (diagnosis in visit 6+ is/isn't carried over).
4. If the behavior is a bug: propose a fix. If intentional: document the business rule explicitly in code (comment + optional config constant).

Constraints: Vertical TDD. Do not change the carry-over endpoint signature. If the limit becomes configurable, it should be a named constant, not a magic number.

What good looks like:
- The 5-visit limit is a named constant with a business rule comment.
- A test explicitly covers the "diagnosis older than 5 visits" case and asserts expected behavior.
- If behavior changes: migration not required (no schema change needed).
```

---

**Prompt 5 — Performance budget for the carousel (G6, G7)**

```
Context: I've pasted the carousel concept doc above. There are two N+1 problems: (1) getToothHistory fires two awaits per visit in a serial for-loop (§8/G6); (2) each VisitChartCard fires its own GET /dental/visits/{id}/chart on mount (§3/G7).

Task: Propose and implement solutions for both:

For G6 (backend): Replace the serial loop in getToothHistory.ts with a batch query. Drizzle can JOIN dental_chart + dental_treatment in a single query. Write the batch version and compare query count.

For G7 (frontend + backend): Design a batch chart endpoint — e.g. POST /dental/visits/charts/batch with body { visitIds: string[] } → { [visitId]: ToothData[] }. Then update TimelineCarousel to: (a) batch-fetch all visible visit charts in one request on mount, (b) prime the TanStack Query cache with individual visit keys so each VisitChartCard's useQuery hits the cache immediately.

Constraints: Vertical TDD. The individual GET /dental/visits/{id}/chart endpoint must continue to work (don't remove it). The batch endpoint is additive. VisitChartCard's useQuery call site is NOT changed — only the cache priming changes in TimelineCarousel.

What good looks like:
- getToothHistory: query count drops from 2×N to 1 (one JOIN).
- Carousel: on mount with 10 visits, network tab shows 1 batch request, not 10 individual ones.
- Benchmark (bun test --bench or similar): p95 getToothHistory < 50ms for 30-visit patient.
- No regression in existing tests.
```

---

## §12. How to Regenerate This Doc

This doc was generated from a combination of three **design/spec artifacts** and six **source code files**. Re-read these when the carousel changes significantly:

**Design artifacts:**
- Design doc: `~/.gstack/projects/dentalemon/eladventures-fix/boilerplate-bugs-reviewed-design-20260507-171836.md`
- PRD §3–§4: `docs/prd/v3-dentalemon.md`
- Wireframe XML: `docs/development/wireframes/dental-workspace.xml`

**Source code embedded in §2–§8:**
- `apps/dentalemon/src/features/workspace/components/timeline-carousel.tsx`
- `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-save-tooth-flow.ts`
- `services/api-ts/src/handlers/dental-visit/repos/dental-chart.schema.ts`
- `services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts`
- `services/api-ts/src/handlers/dental-visit/getToothHistory.ts`

If a code block in §2–§8 no longer matches the current file, the block is stale. Trust the source file; update this doc to match.
