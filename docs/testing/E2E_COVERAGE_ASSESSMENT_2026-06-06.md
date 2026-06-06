# E2E Test Coverage Assessment — 2026-06-06 (snapshot)

**TL;DR**: the test-audit backlog's deferred items ("strengthen ~22 chrome-only
specs", "de-mock imaging", "write a coverage matrix", "full gate + ship" —
Phases 2–4 of `i-dont-think-oli-deep-hamming.md`) are **substantially obsolete**.
Cumulative strengthening (esp. the cold-start golden-path spec) plus pre-existing
real backend coverage already delivered what they described. No blocking gap, no
bug to fix.

> This is a **dated point-in-time snapshot**, not a source of truth. For *live*
> coverage, regenerate `.understand-anything/contract-spine.json`
> (`bun scripts/build-contract-spine.ts`) and run
> `apps/dentalemon/tests/e2e/cold-start-full-loop.spec.ts`. Companion:
> [BACKEND_COVERAGE_TOPOLOGY.md](./BACKEND_COVERAGE_TOPOLOGY.md).

Assessed at `main` HEAD `de1d7f8e`. Method: direct inspection of every
non-journey E2E spec + the contract-spine operation→handler→SDK→FE map (not OLI
artifacts).

## Verdict on the deferred backlog

| Deferred item | Verdict | Why |
|---|---|---|
| Strengthen "~22" chrome-only specs | **Re-scope → near-zero** | The "22" is stale: now ~13 chrome-only of 52 non-journey specs, and ~all are legitimately chrome-scoped (iPad responsive-**layout** tests, imaging tool-state UI, PIN keypad mechanics, `workspace-empty-states` by design) or have their content path covered end-to-end by `cold-start-full-loop`. |
| De-mock imaging E2E | **Remove (not a gap)** | The drift risk is already caught at lower layers (below). The 5 mocked component specs are correctly UI-scoped; de-mocking would add MinIO/ML flakiness for ~zero new risk coverage. |
| Coverage matrix doc | **Satisfied by this snapshot + contract-spine.json** | Governance documentation, not a quality gap. A hand-maintained *living* matrix would rot on every spec change; the generated contract-spine + this dated snapshot are the low-rot form. |
| Full gate + ship | **Done** | backend 3380/0, FE 1952/0, typecheck 0×2, lint 0, cold-start E2E pass, journeys 10P/0B/0E/4-skip; merged to `main`. |

## E2E suite strength (52 non-journey specs)

- **39 content-asserting** — seed/create real records and assert rendered data
  (invoice numbers, CDT codes, amounts, statuses, patient names). A broken query
  fails these.
- **~13 chrome-only**, each legitimate or covered elsewhere:
  - Responsive **layout** tests (assert no horizontal overflow at iPad viewports):
    `ipad-calendar`, `ipad-imaging`, `ipad-perio-charting`, `ipad-workspace`.
  - **Tool-state** UI (toolbar/active-tool/SVG overlay, not data):
    `imaging-annotation`, `imaging-measurement`, `imaging-comparison`.
  - **Flow/mechanics**: `auth-pin` (keypad), `onboarding` / `dental-onboarding`,
    `add-staff`, `patient-registration` — content path asserted by
    `cold-start-full-loop` (signup→onboarding→staff→patient→billing→reports).
  - **By design**: `workspace-empty-states` asserts empty-state copy.
- **5 mocked** (all imaging component specs — see below): `imaging-cbct`,
  `imaging-ceph`, `imaging-ceph-auto-landmark`, `imaging-ceph-export`,
  `imaging-findings`.

## Imaging is not under-covered (the de-mock concern, resolved)

Mapping evidence (`contract-spine.json`): **29 imaging/ceph operations, 29/29
handler-bound, 29/29 SDK-wired** — no orphans, no contract drift (of 352 ops total).

Real backend coverage (`services/api-ts/src/handlers/dental-imaging/`, ~330KB of
tests, not mocked at the contract layer):
- `imaging-integration.test.ts` (~48KB, real-DB, exercises 13 handlers)
- `imaging.test.ts` (~73KB), `imaging-coverage.test.ts` (~59KB, error-contract)
- `ceph.test.ts` (~60KB), `ceph-business-rules.test.ts` (~35KB, BR-036..047, 12/12)
- `ceph-auto-landmark.test.ts`, `cephSuperimposition.test.ts`, `dicom-parse.test.ts`,
  FSM property tests, `dental-imaging-events.test.ts`
- Plus Hurl contract tests and **4 real-API ceph journeys** (`11-ceph-tier-gate` …
  `14-ceph-report-snapshot`) that drive the real backend and **skip honestly** when
  MinIO/storage is absent (no seeded ceph image) rather than faking a pass.

The 5 mocked E2E component specs validate *UI wiring* against deterministic
fixtures (no storage/ML needed) on top of this already-real-tested contract. That
layering is appropriate, not a gap.

## Residual (optional, low value — intentionally not done)

- Seeding data into the `ipad-*` layout specs would conflate single-purpose layout
  tests with content tests; the content path is already covered by
  `cold-start-full-loop`. Left as-is on purpose.
