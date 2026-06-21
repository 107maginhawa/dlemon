# 013 — Coverage-complete, RED-first, ratcheted test state

**North star:** *A user must never hit a missing or broken workflow in the platform.*
Bring dentalemon to a coverage-COMPLETE, RED-first, ratcheted state where every
user-reachable workflow, business rule, and inter-module flow is proven — frontend
AND backend — by a test that fails if the behavior breaks, and where gaps can only
shrink.

## Decisions (confirmed 2026-06-21)

1. **Existing code:** gaps get true RED→GREEN; already-covered behavior gets
   *sampled* non-vacuity checks (stash-revert / targeted mutation), not a full
   per-test re-proof. You can't un-build working features.
2. **This initiative's first output:** an authoritative coverage **ledger** + a
   prioritized **gap backlog** + CI **ratchets** — then burn the backlog down
   incrementally. Not "2,000 tests in one shot."
3. **Coverage bar:** **per-type layer policy** — a user-reachable workflow must
   have an E2E/journey proof; money/clinical/inter-module get the full stack
   (BE unit + contract + FE unit + E2E + non-vacuity); CRUD writes get BE+FE unit;
   reads get BE unit. Non-vacuity required where blast radius is real.
4. **Surface source:** reconcile the formal catalogs (WF-*, BR-*, §12 inter-module)
   with use cases reverse-engineered from routes / UI / handlers into ONE ledger.

## Discovered surface (2026-06-21)

- **Backend handler modules (26):** audit, billing, booking, comms, dental-audit,
  dental-billing, dental-clinical, dental-erasure, dental-imaging, dental-legalhold,
  dental-org, dental-patient, dental-perio, dental-pmd, dental-portal,
  dental-scheduling, dental-visit, email, emr, notifs, patient, person, provider,
  retention, reviews, storage.
- **FE feature areas (17):** billing, booking, case-presentation, dashboard,
  imaging, notifications, onboarding, org, patients, person, pmd, portal, reports,
  scheduling, settings, staff, workspace.
- **Route groups:** `_dashboard`, `_workspace`, `_portal`, `auth`, plus standalone
  (book.$branchId, dental-onboarding, imaging-*, onboarding, verify-email).

## Reuse, don't reinvent

- `docs/product/WORKFLOW_MAP.md` (WF-* + §12 inter-module composition)
- `docs/standards/business-rules.md` + `br-registry.json` (BR-*)
- `docs/testing/coverage/workflow-test-map.json` + `workflow.allowlist.json`
- `scripts/coverage/workflow-matrix.ts` (map validator + gap ratchet),
  `endpoint-matrix.ts`
- `apps/dentalemon/scripts/run-journey-harness.ts` (CORE_DOCTOR_WFS gate,
  KNOWN_CORE_GAPS, EXPECTED roster) + the Anti-Cheating journey contract
- `docs/development/VERTICAL_TDD.md` (10-step RED-first protocol)
- skills: `/br-extract`, `/audit-compliance`, `/oli-check`, `/module-review`,
  `/oli-codebase-map`

## What "RED-first" means here (codebase already built)

- **Gaps** (missing behavior, or behavior with no/weak test): write the failing
  test FIRST, prove it RED (run it / revert-the-impl), then implement or fix to
  GREEN. One atomic commit each.
- **Existing covered behavior:** do NOT rewrite. Prove a sampled subset is
  non-vacuous via stash-revert / mutation. Systematic vacuity-hunting is a later
  pass, not now.

## Phases (use the Workflow tool for fan-out; /using-superpowers throughout)

**Phase 0 — Authoritative surface ledger** (parallel readers per FE feature + BE
module + a catalog-reconciler). Output `docs/testing/coverage/coverage-ledger.json`
keyed by user-reachable workflow, each entry:
`{ id, title, type (workflow|business-rule|use-case|inter-module), modules[],
userEntryPoint {route, control}, endpoints[], relatedWF[], relatedBR[],
requiredLayers[], notes }`. Plus `COVERAGE_LEDGER_NOTES.md` (surface size +
what the catalogs were missing). **STOP-AND-REPORT.**

**Phase 1 — Coverage + vacuity matrix** (pipeline per ledger item). Resolve tests
across layers (BE unit / contract / FE unit / E2E) via workflow-test-map,
endpoint-matrix, grep, journey harness. Grade MISSING / SHALLOW / COVERED. Sample
non-vacuity probes weighted by blast radius. Emit gap report + a backlog
prioritized money → clinical/safety → auth → core journeys → rest.
**STOP-AND-REPORT.**

**Phase 2 — Per-type layer policy + ratchets.** Define the required-layer matrix by
item type. Extend existing gates: every authoritative item must be in the ledger;
gaps live only in `workflow.allowlist.json` and it can only shrink; journey CORE
gate + workflow-matrix ratchet block new gaps; new work forced RED-first per
VERTICAL_TDD. (Branch-protection ENFORCEMENT is gated on a GitHub plan/visibility
decision — wire the checks regardless.)

**Phase 3 — Burn down the backlog, RED-first, vertical slices.** Per gap
(highest blast radius first): failing test → prove RED → GREEN → drop its
allowlist entry → one atomic commit. Fan out across independent gaps; adversarially
verify each (does it truly fail when broken?). Re-run gates per batch.

## Per-item gate

new/changed test proven RED → GREEN → siblings no-regress (run in isolation /
fresh DB clone via `services/api-ts/scripts/test-with-db.ts`) → `bun run typecheck`
→ api-ts lint 0 errors → dentalemon lint ≤200 + font ratchet + fsm-tokens →
journey harness green where touched. Commits end with:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Execution log

- 2026-06-21: plan saved; Phase 0 kicked off (workflow `w68fxp4f8`, run `wf_8b778241-a8e`).
- 2026-06-21: **Phase 0 COMPLETE.** `coverage-ledger.json` = **915 items** (workflow 269,
  use-case 169, business-rule 450, inter-module 27; 778 user-reachable; 60 module tags).
  Reconcile agent skipped the notes file → `COVERAGE_LEDGER_NOTES.md` computed
  deterministically (`/tmp/gen-ledger-notes2.ts`). Completeness findings: only **4** catalog
  WF-* have no ledger ref (WF-054 invoice-overdue job, WF-080 appt-notification, WF-094
  carry-over [covered-but-untagged], WF-P05 print-perio [deferred]) — WF catalog is
  essentially fully represented. **143 uncataloged user-reachable workflows** (no WORKFLOW_MAP
  WF tag) = the real north-star surface (billing, patients, dental/branches, comms, providers,
  email, imaging panels). 31 BR-* unreferenced (noisy: relatedBR only 39% populated).
  **REAL DEFECT found: `workflow-matrix.ts` parses only 85 of 104 WF ids — it drops every
  `[INFERRED]`-annotated id cell → ~16 workflows invisible to the E2E ratchet. Phase 2 fix.**
- 2026-06-21: **Phase 1 COMPLETE.** Built `scripts/coverage/ledger-coverage.ts` (deterministic
  per-item layer grader: joins endpoint/workflow/fe-route matrices + be-unit signal
  [operationId-grep ∪ recorder sink] + static e2e spec-index; per-type required-layer policy;
  user-reachability filter via hasFEConsumer). Fixed 5 measurement bugs that each would have
  produced a false backlog (stale endpoint-matrix integ=0 → recorder run; `:param`/`{param}`
  join 41%→95%; 135 base-`billing` orphans no user reaches → partitioned out; direct-handler
  tests invisible to matrix → opId-grep; `unproven` overstated when layers UNKNOWN). Raw matrix:
  915 → COVERED 201, PARTIAL 522, GAP 192. After reachability filter: 57 user-reachable gaps.
  **LLM verify (wf_27c33227-093, 41 agents): 17 real, 4 false-dropped, 1 vacuity found; 19/20
  high-risk COVERED tests non-vacuous.** → `coverage-backlog.json` = **18 confirmed gaps**
  (3 unproven, 10 e2e-gap, 4 be-unit-gap, 1 vacuity) + 36 contract-only deferred (mostly
  deliberate "integration-tested instead"). Biggest cluster: **patient portal has ~no e2e (7
  gaps)**. Artifacts: ledger-coverage.{ts,json}, LEDGER_COVERAGE.md, coverage-backlog.{json,md}.
  ⚠ PRE-EXISTING (not mine): 3 workflow-matrix.test.ts fail (dangling spec + allowlist drift
  from recent journey commits) — Phase 2 freshness fix.
- 2026-06-21: **Phase 2 COMPLETE** (branch chore/coverage-completeness-013, commits cd8485e7
  Phase0+1, bb087992 freshness, cd06e570 parser, 76031be8 ledger-ratchet+policy). (1) Fixed
  workflow-matrix [INFERRED] parser blind spot via isIdOnlyCell() — 85→108 WFs visible; 21
  newly-revealed gaps allowlisted (all [INFERRED] op-table reads/CRUD covered at be/contract +
  §8 notif flows); 2 RED→GREEN parser tests. (2) Reconciled freshness: WF-002 covered→deferred
  (contract-only passkey), dropped resolved WF-003/011/032; engine 196/0, freshness gate green.
  (3) NEW report-only ledger ratchet: ledger-coverage.ts grep-only/deterministic + `--check` vs
  ledger.allowlist.json (71 baseline, shrink-only); wired in quality.yml after freshness; npm
  coverage:ledger[:check]. REPORT-ONLY because deterministic detection has FPs (grep blind to
  buildTestApp be-unit; e2e spec-index ~29% FP per LLM verify) — promote to blocking when
  detection hardened + branch protection on. (4) LAYER_POLICY.md = per-type×risk required-layer
  matrix + artifact map + ratchet table.
- 2026-06-21: **Phase 3 burndown STARTED** (incremental per decision 2). Closed RED-first:
  (1) `6ab9f3a9` br-003 — BR-003 blocks prescriptions on a locked/completed visit (clinical
  safety; guard existed, untested; RED proven by disabling the guard). (2) `d2c10222`
  uc-list-consent-refusals — listConsentRefusals is visit-scoped (RED proven by dropping the
  visitId filter → cross-visit leak). Each: RED→GREEN→fresh-DB-clone no-regress→pre-commit gate
  green. **Backlog refinement found during burndown:** op-export-dental-chart's CORE logic IS
  tested (chart/chart-export.test.ts covers buildChartExport); only the handler glue (authz/404/
  assembly) lacks a test → lower priority than the grep flagged. **REMAINING (16, scoped in
  coverage-backlog.json):** 2 be-unit reads (dp-list-due-recalls, dp-list-coverage-authorizations)
  + op-export-dental-chart handler-glue (low) + 13 e2e — the e2e bulk (7 patient-portal, 3 notifs,
  2 billing inter-module, 1 comms-WS) needs the web app (:3003) + Playwright and is the next wave.
  PRE-EXISTING (not mine): business-rules.test.ts BR-001 findInProgressByPatient fails on HEAD
  (dental_branch seeding flake) — flag for a separate fix.
- 2026-06-21: **Phase 3 COMPLETE — 18/18 backlog gaps burned down (truth-first).** 14 closed
  with new RED-proven tests, 4 dispositioned honestly (verified not-closeable-by-e2e, covered
  at the layers that exist). Commits:
  - 3a `2c0d97fd` — ONE patient-portal e2e (portal-patient-self-service.spec.ts) closes ALL 7
    portal gaps (index-redirect/tab-nav/list-appointments/list-invoices/get-balance/sign-out/
    billing-facade). A logged-in patient who owns data exists in no seed → constructed over HTTP
    (fresh owner org → patient self-registers a dental_patient → owner seeds appt+issued invoice;
    Set A, no Mailpit). RED proven by reverting the redirect + the balance render. Also `b9fdc5c7`
    refreshed fsm-matrix line-refs (stale since 6ab9f3a9). allowlist 71→67 (4 nav gaps dropped;
    4 data gaps grep-blind, kept w/ "covered by spec" reason). fe-route-matrix now hits /portal.
  - 3b `19d2d55e` listDueRecalls (window+default-horizon+403+400) · `1fab63e1`
    listCoverageAuthorizations be-unit + contract LOA-list (extends dental-revenue-cycle.hurl) ·
    `0306c439` exportDentalChart handler-glue + cross-visit aggregation. Each RED via mutation;
    each dropped from the ledger (and endpoint) allowlist.
  - 3d `252ae5e8` notifs mark-all-read e2e (extends notification-inbox.spec.ts; RED by disabling
    the click handler).
  - 3e `f38042d7` comms chat-room WS auth boundary — server-level integration test boots the real
    app, proves unauth/invalid-token upgrade → 401 (config-shape test was blind to it). No comms
    UI → no Playwright possible; ledger e2e flag stays, reason updated.
  - **4 dispositioned `31f758bc` (verified, not faked):** be-dental-billing-loa-authorization-
    dependency (LOA hooks ORPHANED, no UI — contract+be-unit cover the lifecycle; ⚠ MISSING UI is
    a product gap) · person-billing-party-lookup-inter-module (base /billing/invoices has ZERO
    dentalemon consumers — backend-only) · notif-push-opt-in-enable + notif-push-click-deep-link
    (e2e blocked: OneSignal SDK rejects the placeholder VITE_ONESIGNAL_APP_ID in the test env so
    the prompt/listener never mount — empirically verified; logic is fe-unit tested).
  Post: `72f83589` fixed the PRE-EXISTING BR-001 flake (root cause: polluted monobase_test template
  + target-less onConflictDoNothing skipping the org insert on the partial active-per-owner index
  → branch FK fails; fix = beforeAll reset). Per-commit gate green throughout (typecheck 0, lint
  0-err, font 346, fsm-tokens, freshness byte-stable). ⚠ OPEN for human: (1) the LOA "Add
  authorization" UI is missing (orphaned hooks); (2) branch-protection enforcement still blocked
  on a GitHub plan — ratchets wired but advisory; (3) promote the ledger ratchet to blocking once
  detection hardens.

## CONTINUE PROMPT (paste into a fresh session to resume)

```
Resume the coverage-completeness / RED-first initiative on the dentalemon repo.
North star: a user must NEVER hit a missing or broken workflow. Use the Workflow
tool for fan-out phases and /using-superpowers (test-driven-development,
systematic-debugging, verification-before-completion). Truth-first: never weaken an
assertion; a workflow the UI can't complete is a RED finding to FIX, not soften.

READ FIRST: plans/013-coverage-completeness-redfirst.md (full plan + the 4 locked
decisions + discovered surface). Also recall memory project_money_race_hardening_*
and project_journey_coverage_backlog_* for repo gotchas.

CURRENT STATE: Phase 0 (authoritative surface ledger) was launched as a workflow.
  - Check for its outputs: docs/testing/coverage/coverage-ledger.json and
    docs/testing/coverage/COVERAGE_LEDGER_NOTES.md, plus fragments in
    docs/testing/coverage/.ledger-parts/.
  - If they exist and look complete: stamp generatedAt, then REPORT the surface
    size + completeness findings (WF-*/BR-* with no code match = candidate MISSING
    workflows; code with no catalog = uncataloged), and proceed to Phase 1.
  - If incomplete / the run died: resume it with
    Workflow({scriptPath:
    ".../workflows/scripts/coverage-ledger-phase0-wf_8b778241-a8e.js",
    resumeFromRunId: "wf_8b778241-a8e"}) (cached agents return instantly), or
    re-run Phase 0 fresh (FE feature + BE module lists are in plans/013).

THEN run, in order, checkpointing (report) at each boundary:
  Phase 1 — coverage + vacuity matrix (pipeline per ledger item): resolve tests
    per layer (BE unit / contract Hurl / FE unit / E2E journey) via
    workflow-test-map.json + scripts/coverage/endpoint-matrix.ts + grep + the
    journey harness; grade MISSING / SHALLOW / COVERED; sample non-vacuity probes
    (stash-revert / mutation) weighted by blast radius; emit a gap report + a
    backlog prioritized money -> clinical/safety -> auth -> core journeys -> rest.
    STOP-AND-REPORT.
  Phase 2 — per-type layer policy + ratchets: define required-layer matrix by item
    type; extend the existing gates (workflow-matrix ratchet, journey CORE gate,
    workflow.allowlist.json shrink-only, VERTICAL_TDD RED-first) so new gaps fail
    CI. Wire checks even though branch-protection ENFORCEMENT is blocked on a
    GitHub plan/visibility decision (private+free repo -> 403).
  Phase 3 — burn down the backlog RED-first in vertical slices (highest blast
    radius first): failing test -> prove RED (run / revert-impl) -> GREEN -> drop
    its allowlist entry -> one atomic commit. Fan out across independent gaps with
    a Workflow; adversarially verify each (does it truly fail when broken?).

PER-ITEM GATE: new/changed test proven RED -> GREEN -> siblings no-regress (run in
isolation / fresh DB clone: services/api-ts/scripts/test-with-db.ts) ->
bun run typecheck -> api-ts lint 0 errors -> dentalemon lint <=200 + check:font-size
(baseline 346) + check:fsm-tokens (both from REPO ROOT) -> journey harness green
where touched. Commit footer:
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

GOTCHAS (verified): BE tests => DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/monobase_test
and run via scripts/test-with-db.ts (per-file clones avoid session pollution);
raw bun test needs a leading ./ ; concurrency test apps MUST mount
zValidator('param'). Six BE files fail PRE-EXISTING (imaging/ceph +
dental-billing.{cross-tenant,rls-activation}-reports + dental-org dashboard-summary-extended)
— not regressions. Journey harness: cd apps/dentalemon && bun
scripts/run-journey-harness.ts (reseeds + runs); stack must be up (api :7213,
web :3003, MinIO, Mailpit); owner PIN 123456; dentalemon unit tests = bunx bun
test ./path ; journeys = bunx playwright test ... --project=journeys. Workflow
agents CAN Write files; workflow SCRIPTS cannot touch FS/Date/Math.random.
```
