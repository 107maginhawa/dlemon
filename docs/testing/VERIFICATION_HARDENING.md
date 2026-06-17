# Verification Hardening — living plan

> **Status:** OPEN · **Owner:** eng · **Created:** 2026-06-17
> **How to run:** execute phase-by-phase (`/goal`, `gsd-execute-phase`, or by hand). Each
> phase has a **Done when** gate — do not advance until it is green. Phases declare their
> **Depends on**. Two kinds of stop are marked: **🚧 FIX-GUARD** (do not fix New Visit yet)
> and **⚠ HUMAN** (a step a code agent cannot self-complete — pause and ask).
> **Companion doc:** the understand-anything / knowledge-graph track lives in
> [`UA_KG_UPGRADE.md`](./UA_KG_UPGRADE.md) (this plan's Phase 7).

---

## Why this exists (root cause)

The dentalemon **"New Visit"** button is broken in the running app while **every audit/CI
gate is green**. The cause is not a missing test — it is that **every map in the system is
structural and anchored on the backend entry point**, so none of them can see the real
user action.

The real user action is a **two-step** client-orchestrated flow
(`apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts`):

1. `POST /dental/visits` → creates a visit in `draft`
2. `PATCH /dental/visits/:id {status:'active'}` → transitions `draft → active`

If **either** step fails the user sees the toast *"Failed to create visit. Please try
again."* The backend supports `draft → active`
(`services/api-ts/src/handlers/dental-visit/dental-visit.treatment-status-transitions.test.ts:350`),
so the break is a **real-stack runtime failure** the test layers structurally cannot see.

Why each layer was blind:

| Layer | What it does | Why it missed New Visit |
|---|---|---|
| `WORKFLOW_MAP.md` | canonical workflow registry | Only maps `WF-007` (appointment check-in → visit). The **workspace "New Visit"** flow is **unmapped**. `WF-VIS-001` (J21's rubric id) isn't defined here — it's the dangling/renamed `WF-045` in `docs/testing/coverage/workflow-test-map.json`. |
| `scripts/verify-app.ts` | one-button verdict | **Skip-tolerant by default**: the only real-stack proofs (`contract-core`, `journey-harness`) **SKIP** (not fail) when api-ts isn't on :7213 — green can rest on **zero** functional execution. `--require-stack`/strict exists but isn't the default. |
| 6 coverage matrices | "is X tested?" | Literal `line.includes(token)` substring scans (`scripts/coverage/lib/scan-tests.ts:221`). They prove an id is **mentioned** in a test file, not **exercised**. |
| understand-anything KG | code/domain graph | **Stale** (Jun 6, commit `1196799b`), monolithic, uncommitted, in no gate, structural-only. It modeled "Create Visit" as the **backend handler** — same blind spot. |
| **J21** journey | the test written *specifically* to catch this incident | Asserts only the **POST** (step 1); counts `draft` as "open" (`21-new-visit-create.journey.spec.ts:48-61`); never asserts the **PATCH** (step 2). A stranded `draft` passes every check. The oracle encodes the implementer's incomplete model. |

**Unifying thesis:** the system overwhelmingly verifies **proxies authored alongside the
code** (mentions, hand-written mocks, single-step happy paths, structural wiring). The few
layers with an independent real-world oracle are **skipped by default** or **scoped by the
same person with the blind spot**. No layer both (a) derives "correct" from a source
independent of the implementer **and** (b) observes the **complete** user-visible outcome.

**The family is already documented and unenforced:** `WFG-002` (check-in → visit draft
fails → orphan appointment; **HIGH — data inconsistency**, `WORKFLOW_MAP.md:614`) and
`WFG-004` (concurrent create → two invoices). Same `create → then activate/confirm`
two-step shape as New Visit.

**Tooling note (graphify):** [graphify](https://github.com/safishamsi/graphify) was
assessed against UA — same category (tree-sitter + LLM **structural** code graph, no
runtime/test awareness, no business-flow layer). It does **not** address the
runtime-verification gap, so it is **not adopted**. Parked as a possible *future
replacement* for UA (better freshness/change-impact/polyglot), never an add-on. See
[`UA_KG_UPGRADE.md`](./UA_KG_UPGRADE.md).

---

## Definition of Done for a user journey (the standard we are building toward)

Every critical user journey must assert all four:

1. **No silent error surface** — no unexpected error toast, `console.error`, `pageerror`,
   or unhandled 4xx/5xx during a success-path flow.
2. **Goal state, not existence** — assert the clinically meaningful end state (e.g. visit
   is `active`/chartable), never "a row exists".
3. **Every step succeeded** — in a multi-step flow, assert *each* network call in the flow
   window returned success, not just the first.
4. **Independent read confirms the goal** — the post-UI read checks the goal predicate via
   an independent reader, not the UI it just drove.

Phase 8 writes this into the contributing standards.

---

## Phases

### P0 — Confirm ground truth 🚧 FIX-GUARD
- **Goal:** Prove the actual New Visit failure mode against the running stack so every
  downstream phase has a real canary.
- **Depends on:** none.
- **Steps:**
  1. Boot the stack (`bun run infra:up`; `cd services/api-ts && bun dev`; `cd apps/dentalemon && bun dev`) and seed (`bun run db:reseed`).
  2. Reproduce New Visit in the UI (or drive the two calls directly): capture which call
     fails — `POST /dental/visits` or the `PATCH …{status:'active'}` — and the status/body.
  3. Record the confirmed failure mode in the **Findings** section below (call, status,
     payload, root cause hypothesis). **Do not fix anything.**
- **Done when:** the Findings section names the failing call + status, and a one-line
  hypothesis. No code changed.

### P1 — Fix the map 🚧 FIX-GUARD
- **Goal:** Make the canonical workflow map describe the *real* user action before any test
  enforces it.
- **Depends on:** P0.
- **Steps:**
  1. Add the workspace **"New Visit"** flow to `docs/product/WORKFLOW_MAP.md` as its own
     entry: the two-step `POST (draft) → PATCH (active)` orchestration, the
     `timeline-carousel` affordance, and a **partial-failure row** (the sibling of
     `WFG-002`: "step-2 activate fails → stranded draft + user error").
  2. Reconcile the id mismatch: pick one canonical id for this flow and make
     `WORKFLOW_MAP.md`, `21-new-visit-create.journey.spec.ts` (rubric), and
     `docs/testing/coverage/workflow-test-map.json` agree (`WF-VIS-001` vs `WF-045`).
- **Done when:** the workspace New Visit flow is in `WORKFLOW_MAP.md` with a partial-failure
  row; one id is used consistently across map, journey rubric, and test-map. No code changed.

### P2 — Independent, non-skippable firewall  ←  *this is what catches New Visit*
- **Goal:** Add an author-blind, outcome-based oracle and make it impossible to skip to green.
- **Depends on:** none (can start alongside P1).
- **Steps:**
  1. **(A) No-silent-error-surface fixture** — in
     `apps/dentalemon/tests/e2e/journeys/_journey-helpers.ts`, extend the Playwright
     fixture (`test = base.extend`) with an auto-fixture that, per test, collects
     `console` errors, `pageerror`, any `/dental/*` & `/auth/*` response with `status>=400`,
     and any visible error toast (`[data-sonner-toast][data-type="error"]`), then asserts
     all buckets empty in teardown. Provide an escape hatch (e.g.
     `errorSurface.allow(/Active visit already exists/)` / `.allowStatus(409)`) so the
     legitimately-negative journeys (J08, B01) declare their specific expected error.
     Default = zero tolerance.
  2. **(D) Non-skippable real-stack gate** — make CI strict: when `--ci` is set, a
     stack-needing step that can't run is a **FAIL**, not a SKIP (flip the default in
     `scripts/verify-app.ts` `resolveStackGate`/`computeOverall`; keep skip-tolerance only
     for the local no-flag report run). Add a per-PR CI job that always boots the stack
     (promote the proven postgres-service + boot recipe in
     `.github/workflows/journey-stability.yml` into a `pull_request` job that runs the Set-A
     journeys once).
  3. **⚠ HUMAN:** add that journey job to the **required** branch-protection checks
     (GitHub settings — a code agent cannot do this; pause and request it).
- **Done when:** (A) every journey fails on an unexpected error surface (prove with a
  deliberately-injected toast that the fixture goes red, then revert the injection);
  (D) `bun run verify:app:ci` FAILs (not skips) with the stack down; the per-PR journey job
  exists; the branch-protection request is logged for the human.

### P3 — Goal-state journeys (rubric + harden J21)
- **Goal:** Make journeys assert the goal, not a proxy.
- **Depends on:** P1 (correct map/ids), P2-A (error-surface fixture exists).
- **Steps:**
  1. Harden `apps/dentalemon/tests/e2e/journeys/21-new-visit-create.journey.spec.ts`:
     capture **both** `POST /dental/visits` (==201) **and** the `PATCH /dental/visits/:id`
     (2xx); split "open" (gating) from **"active/chartable"** (goal); require the independent
     read to find **exactly one `active`** visit (a stranded `draft` must now FAIL); add a
     direct goal read asserting `status === 'active'`.
  2. Apply the 4-clause **Definition of Done** to the other Set-A core journeys (at least:
     revenue chain J04, perio J03, scheduling J17, consent/case-presentation J19).
  3. Update `docs/audits/JOURNEY_HARNESS_CONTRACT.md` to make the 4 clauses the contract.
- **Done when:** J21 asserts both calls + `active` goal state and goes **red** against the
  current (still-broken) app; the rubric is in the contract doc.

### P4 — Fix the canary, prove red → green
- **Goal:** Fix the real New Visit bug and demonstrate the firewall works.
- **Depends on:** P2, P3. (This is where the FIX-GUARD lifts.)
- **Steps:**
  1. Fix the root cause found in P0.
  2. Show the P2 error-surface gate and the P3-hardened J21 were **red before** and are
     **green after**.
- **Done when:** New Visit works in the running app; J21 + the error-surface gate are green;
  `bun run verify:app:strict` passes with the stack up.

### P5 — Enforce the documented backlog
- **Goal:** Convert known-but-unenforced workflow gaps into tests (the "find other gaps" payoff).
- **Depends on:** P2, P3.
- **Steps:** for each row in the **WFG gap register** below, add an enforcing test (journey
  or contract) **or** record an explicit accepted-risk note with rationale. Start with
  `WFG-002` and `WFG-004`; sweep the other `create → activate/confirm` siblings (treatment-plan
  accept, invoice-from-visit, appointment book→confirm).
- **Done when:** every register row is `enforced` or `accepted-risk (reason)`; none left `open`.

### P6 — Cheap unit-layer prevention (FE↔BE request-shape conformance)
- **Goal:** Catch the adjacent drift family (renamed/missing/typo'd request fields, wrong
  enum) at the cheap unit layer, graded by the spec instead of the test author.
- **Depends on:** none (independent; schedule after P4).
- **Steps:** add a test/CI-only request interceptor (the SDK supports
  `interceptors.request.fns`, `packages/sdk-ts/src/generated/client/client.gen.ts`) that
  validates outgoing request bodies against `specs/api/dist/openapi/openapi.json` (ajv) and
  fails on mismatch; wire it into the FE unit tests so the request half is graded by the
  spec, not by hand-authored mocks.
- **Done when:** a deliberately-malformed FE request body fails a unit test via the spec
  validator; existing FE tests still pass.
- **Note:** this would NOT have caught New Visit by itself (both calls' *shapes* are valid);
  it prevents the very common adjacent family. Do not over-credit it.

### P7 — Keep the map honest over time → see [`UA_KG_UPGRADE.md`](./UA_KG_UPGRADE.md)
- Refresh the KG + fix staleness/worktree-rot, wire `understand-diff` into review as an
  **advisory radar**, and de-credit substring "coverage" as behavioral proof. Tracked and
  executed in the companion doc.

### P8 — Institutionalize
- **Goal:** Make the discipline the default for new features.
- **Depends on:** P3 (rubric proven).
- **Steps:** write the **Definition of Done for a user journey** (4 clauses) into
  `CONTRIBUTING.md` / `docs/development/CONTRIBUTING_FRONTEND.md` and reference it from the
  journey-harness contract.
- **Done when:** the 4-clause standard is in the contributing docs.

---

## WFG gap register

| ID | Gap | Severity | Source | Status (P5) |
|----|-----|----------|--------|--------|
| WFG-NEW-VISIT (= WFG-015) | Workspace New Visit step-2 (`draft→active`) fails → stranded draft + user error | HIGH | this incident | **enforced** (J21: both steps + `active` goal + independent read; P2-A firewall catches the toast). Stranded-draft *recovery* = accepted-risk (auto-discard deferred → WFG-001). |
| WFG-002 | Check-in → visit draft fails → orphan appointment, no recovery path | HIGH | `WORKFLOW_MAP.md` §7 WF-007 | **enforced-by-design**: `checkInAppointment.ts` runs check-in + createVisit + linkVisit in one `withTenantTx` (atomic; no orphan on failure). Regression test: `dental-scheduling.test.ts` "appointment stays in scheduled status when check-in fails" (tagged WFG-002). |
| WFG-004 | Concurrent create → two invoices possible | (review) | `WORKFLOW_MAP.md` §7 WF-013 | **accepted-risk**: accidental offline-retry duplicates ARE guarded (idempotency by `localId` + unique index on `(branchId, localId)`; test `createDentalInvoice.idempotency.test.ts`). A concurrent double-invoice for the same visit *without* a `localId` remains possible — but one-invoice-per-visit is a **product decision** (staged / partial / insurance-split billing may legitimately need multiple invoices per visit), not a clear bug. Revisit before multi-tenant cloud launch. |

**Sibling sweep (`create → activate/confirm`):** the adjacent two-step flows are now each
covered by a goal-state journey, so none is left `open`:
- **treatment-plan accept** → J19 (asserts the accept POST 2xx, `decision='accepted'`,
  `plan='approved'`, independent read). enforced.
- **invoice-from-visit** → J04 (asserts the invoice POST ok + independent read it persists).
  The double-invoice edge is WFG-004 above. enforced (creation) + accepted-risk (dup).
- **appointment book→confirm** → J17 (asserts modal-close + independent read,
  `status='scheduled'`, `visitType`). enforced.

> Every register row is now `enforced` / `enforced-by-design` / `accepted-risk (reason)` —
> none left `open` (P5 Done-when met).

---

## Findings (filled by P0)

**P0 result (2026-06-17): the New Visit failure is NOT reproducible — the flow works
end-to-end against the current running stack.** No failing call to record.

Reproduced two ways against the live stack (api :7213, web :3003, demo seed):

1. **Through the rendered UI** (real PIN auth as `dentist_owner` → real workspace for a
   freshly-registered zero-visit patient → real `new-visit-btn` click). Captured network:
   - `POST /dental/visits` → **201** (creates `draft`)
   - `PATCH /dental/visits/:id {status:'active'}` → **200** (transitions `draft → active`)
   - No error toast (`[data-sonner-toast][data-type="error"]` absent); no `pageerror`;
     no unexpected 4xx/5xx. (The only 4xx is `GET …/chart → 404`, the expected
     "no chart yet" state for a brand-new visit.)
   - New Visit button flips **disabled**; independent read returns **exactly one `active`**
     visit. All four Definition-of-Done clauses hold.
2. **Raw API** (cookie-jar curl, same two calls): `201` then `200`, body shows
   `status:"active"`, `activatedAt` set.

**Why the premise no longer holds:** the two-step `POST(draft) → PATCH(active)`
orchestration in `use-create-visit.ts` was added by `8f36791f` ("start visits active, not
draft", **2026-06-06**) and the FE error-envelope parse bug (the original
*"Failed to create visit. Please try again."* toast) was fixed earlier
(`project_error_envelope_blindspot`, 2026-06-09). Both predate the plan (`ccb9f072`,
2026-06-17). The running code already contains both fixes.

**Implication for the FIX-GUARD / P4:** there was no live bug to keep broken or to fix, so
the canary was re-introduced deliberately at P4 (transiently, never committed) to prove the
firewall + hardened J21 go red → green. **DONE — see P4 result below.**

### P4 result (2026-06-17) — canary RED → GREEN proven
The FIX-GUARD lifted at P4. With no live bug, the canary was the real incident class:
transiently set step 2 to an invalid status (`PATCH /dental/visits/:id {status:'broken-canary'}`)
in `use-create-visit.ts` (uncommitted). Both new layers caught it:
- **Hardened J21 (P3)** failed at `step 2: activate PATCH must be 2xx` (the PATCH returned
  `400`) and at the `active` goal read (the visit was stranded at `draft`).
- **P2-A error-surface firewall** caught the error toast (`Validation failed: status…`) and
  the `PATCH 400` failed response.
Restoring `status:'active'` (the "fix") → J21 green again. Then **`bun run verify:app:strict`
passed with the stack up** (10/10 steps: typecheck, lint, coverage-engine, coverage-matrices,
module-boundaries, secret-logging, br-traceability, fe-unit-coherence, contract-core,
journey-harness 21/21 — 0 failed, 0 skipped). New Visit works in the running app; nothing
broken was committed.

### P2 — outstanding ⚠ HUMAN item (branch protection)
The per-PR real-stack gate `.github/workflows/journey-verification.yml` was added and the
strict `verify:app:ci` is in place. **A human must add the `journey-verification` check to
the required branch-protection set** (GitHub → Settings → Branches → required status
checks). This is deferred-by-nature: the check can only be marked required after the branch
is pushed and the workflow has run on GitHub at least once. The former J10 blocker is
RESOLVED (see below) — the harness is now **21/21 green** with the firewall active, so the
gate is ready to be made required once it has run on GitHub.

### Findings discovered by the P2 firewall (the payoff)
The zero-tolerance error-surface fixture, run across all 21 journeys, surfaced two
pre-existing issues unrelated to New Visit (currently allow-listed in their journeys so the
suite stays green, with the allow flagged for removal once fixed):
- **J07 — React duplicate-key error** ("Encountered two children with the same key") for
  primary teeth `D7310`/`D4211` in the mixed-dentition odontogram. A real (latent) FE bug.
- **J10 — pre-existing failure, now FIXED (test-only):** the settings → "Audit Log" step
  timed out because the `ux-ui-polish` batch moved the settings panels behind a `role="tab"`
  tablist, but J10 still looked for `getByRole('button',{name:'Audit Log'})`. Diagnosed
  against the live app (the Audit Log tab opens `audit-log-panel` correctly — the app works),
  so the fix is test-only: `button` → `tab`. Unrelated to New Visit. Harness back to 21/21.

---

## Changelog
- 2026-06-17 — doc created (plan authored; no phases executed yet).
- 2026-06-17 — P0 executed: New Visit reproduced as WORKING end-to-end (no live bug);
  Findings recorded. Commit `1a9e9081`.
- 2026-06-17 — P1 executed: workspace New Visit flow mapped in WORKFLOW_MAP.md (§3/§7/§14
  WFG-015), id reconciled to `WF-045` across map/spec/test-map/journey/harness; now a
  covered coverage-matrix row. Commit `6f3f9489`.
- 2026-06-17 — P2 executed: P2-A error-surface firewall (auto-fixture, proven RED→GREEN
  via injected toast) + P2-D strict `verify:app:ci` (proven exit 1 stack-down) and per-PR
  `journey-verification.yml`. Commit `7de36ca2`. ⚠ HUMAN branch-protection step logged
  above (deferred until push + J10 green). J10 stale-locator fixed (`7eb204dd` precursor).
- 2026-06-17 — P3 executed: J21 hardened to the 4-clause DoD (both calls + `active` goal +
  independent goal read), J19 clause-3 hardened, J04/J03/J17 verified compliant, contract
  doc created (`docs/audits/JOURNEY_HARNESS_CONTRACT.md`). Commit `7eb204dd`. Harness 21/21.
- 2026-06-17 — P4 executed: FIX-GUARD lifted; canary RED→GREEN proven (transient
  `broken-canary` step-2 → J21 + firewall red → restore → green); `verify:app:strict` 10/10
  green with the stack up. No app code committed (the flow already worked). See P4 result above.
- 2026-06-17 — P6 executed: spec-driven FE↔BE request-shape conformance —
  `apps/dentalemon/src/test-utils/spec-request-validator.ts` validates request bodies
  against `@monobase/api-spec/openapi.json` (ajv); pure `validateRequestBody` core +
  an opt-in SDK request interceptor. Proving test: missing-required / wrong-enum /
  wrong-type rejected, valid passes (5/5). Full FE suite 2489 pass / 0 fail (no corpus
  impact — opt-in, not global, after a singleton-leak detour). Added `ajv` devDep.
- 2026-06-17 — P5 executed: WFG register dispositioned — WFG-NEW-VISIT enforced (J21),
  WFG-002 enforced-by-design (atomic `withTenantTx` check-in + tagged regression test),
  WFG-004 accepted-risk (offline-retry guarded by `localId`; one-invoice-per-visit is a
  product decision). Sibling sweep: treatment-plan-accept/invoice-from-visit/book→confirm
  covered by J19/J04/J17. None left `open`.
