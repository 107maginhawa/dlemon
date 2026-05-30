<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-30 — Phase 0 baseline for the OLI runtime-coverage initiative -->

# Baseline Leak Report — why 3 real bugs escape OLI

Dogfood target: `apps/dentalemon/src`. Maps regenerated to **v4** (engine, 194 files, 151 components, 20 routes) after adding the frontend to `.oli/config.json`. This documents, with evidence from the regenerated maps, exactly where each bug slips through every OLI dimension. It is the acceptance reference for Phases 1–3.

## The three bugs

| # | Bug | Location |
|---|-----|----------|
| 1 | Sidebar nav doesn't work | `apps/dentalemon/src/components/app-sidebar.tsx` (`<Link to={item.url}>` from `navGroups` prop) |
| 2 | Recalls tab errors / false-empty | `features/workspace/components/recalls-sheet.tsx` + `hooks/use-recalls.ts:47-48` |
| 3 | Plans tab errors / false-empty | `features/workspace/components/treatment-plans-sheet.tsx` + `hooks/use-treatment-plans.ts:55` |

Bugs 2 & 3 root cause: the hooks call **raw `fetch` with no `credentials:'include'`** (bypassing `@monobase/sdk-ts` `client.ts:75` which sets it). The route is auth-gated (`services/api-ts/src/app.ts:269`) → **401** → hook throws → React Query sets `isError` → the sheet keys only off `isLoading`, never `isError` → user sees a **false "No recalls yet."** empty state. Deterministic; reproduces on an empty patient.

## Evidence from the regenerated v4 maps

| Signal | Observed value | Implication |
|--------|----------------|-------------|
| `RecallsSheet.api_calls` / `TreatmentPlansSheet.api_calls` | `[]` | fetch lives in the hook, one indirection away |
| Components with **any** `api_calls` | **0 of 151** | the behavior/dataflow pass resolves **zero** API calls for this app (SDK calls need `sdk_operation_sources`; raw-fetch-in-hook is never traced) |
| `RecallsSheet.loading_state_hygiene` | `{has_skeleton:false, violation:false}` | detector matches `<Skeleton>`-named JSX tags; the indicator is `<p>Loading recalls…</p>` (text) → missed |
| `loading_state_hygiene` violations flagged | 2 (`CephMeasurementsPanel`, `FindingsSidebar`) — **not** recalls/plans | the actual bug is invisible to static hygiene |
| `AppSidebar.events_out` | `[]` (props: `navGroups`,`headerTitle`,`headerSubtitle`) | nav links are data-driven from a prop → not in the static map |

## Where each dimension misses (the leak trace)

**Bug 1 — sidebar:**
- `--journeys` (static): `AppSidebar.events_out: []`; link targets come from `navGroups` data, not statically resolvable → no element→action finding.
- `--enforcement`/engine: structural only; a `<Link>` to a stale/dead route is not a static violation.
- boot-smoke: loads the page; never clicks a nav item → PASS.
- **Catch requires:** runtime enumeration of rendered anchors on each page + assert destination is a known route and click lands. (Phase 1 nav-link rule — **runtime-DOM-driven**, since targets aren't in `CODE_*`.)

**Bugs 2 & 3 — recalls/plans:**
- engine `loading_state_hygiene`: `violation:false` (text-loading missed) → no signal. (Phase 2 broadens this.)
- `api_calls` everywhere `[]` → the cross-layer "declared api_calls fire" walker has nothing to assert; `--journeys` can't flag a dead call it can't see.
- sheet has no `isError` branch → on 401 the UI shows false-empty, **no console error, no pageerror, no infinite spinner** → boot-smoke PASS, (a)/(b)/(c) all silent.
- **Catch requires:** runtime click of the tab (testid `recalls-tab-btn`/`treatment-plans-tab-btn`) opening the data-surface, with a **4xx-inclusive** network assertion observing the live `GET …/recalls` → 401. (Phase 1 assertion (d), with the runner owning its own `page.on('response')` — the existing `fixtures.ts` listener only catches ≥500.)

## Engine gaps surfaced (feed Phase 2 / follow-ups)

1. **`loading_state_hygiene` is tag-name-only** — misses text-based loading indicators (`<p>Loading…</p>`). → Phase 2 broadens to JSX text + "loading branch + data-hook, no error branch."
2. **`api_calls` not resolved through hooks for raw fetch** — 0/151 here. The fetch in `useRecalls` is invisible. → engine dataflow gap; runtime loop compensates by observing the network.
3. **Single "first-wins" `module_roots`** (`core/modules.ts`) — a mixed monorepo (backend + frontend) cannot be mapped in one run; files outside the single module parent are skipped (`react.ts:196 if(!moduleSlug) continue`). This run maps the frontend only. → multi-root monorepo support is a cover-all follow-up.

## Status
All 3 bugs confirmed escaping. v4 frontend maps populated and committed under `docs/audits/codebase-map/`. Proceed to Phase 1 (runtime execution loop).
