# Journey Coverage Backlog — Dentalemon (workspace doctor journey + cross-module gaps)

Derived from the 2026-06-20 live traceability audit. **Driver file for execution.** Work items
top-to-bottom by priority. Mirrors the `PRODUCT_PASS_BACKLOG.md` working style.

## Why this exists (read first)

The journey harness ran live (`bun scripts/run-journey-harness.ts`, 22/22) — but the green
**overstates** reality. Only **18 of ~129 workflows have live UI+persistence proof**; the rest
ride on backend tests or `.spec.ts` files that **don't run in the harness**. The clinical
*authoring* core a dentist touches every visit — **charting a tooth (WF-009)** and **writing a
SOAP note (WF-011)** — has **no live test that the React save path actually persists.** That is
exactly the "New Visit isn't saving" surface.

**Truth-first rule (non-negotiable):** every item below is proven by a journey that **drives the
real UI and confirms the durable result via an INDEPENDENT read** (`apiReader` / reload), never
DOM-presence or a 2xx. If a new journey goes RED, that means the flow is genuinely broken —
**root-cause and fix the app, do NOT weaken the assertion to make it green.** A passing test that
asserts nothing is the bug we are removing. Split "proven-working" vs "proven-broken" in any tally.

**Evidence base:** `docs/audits/DOCTOR_JOURNEY_TRACEABILITY_2026-06-20.md` (deep) and
`docs/audits/ALL_MODULE_TRACEABILITY_2026-06-20.md` (all 11 modules, 129 rows).

## Status legend: ⬜ pending · 🔨 in-progress · ✅ done · ⏸ blocked (needs decision)

| # | Item | WFs | Priority | Status |
|---|------|-----|----------|--------|
| JC-1 | Continuous doctor-visit journey (chart-save + SOAP-save through real UI) | WF-074 / 009 / 011 | **P0** | ✅ done (J23) |
| JC-2 | Patient login proof — magic-link + passkey | WF-003 / 002 | **P0** | ✅ done (J24 + contract) |
| JC-3 | Promote journeys to a required CI gate + honest tally | — | **P1** | ✅ done (gate+tally; ⚠ human: branch-protection) |
| JC-4 | Money/destructive UI live journeys (payment, void, refund, erasure) | WF-014 / 041 / BIL-REFUND / 088 | **P1** | ✅ done (J25–J28) |
| JC-5 | Concurrent same-visit invoice race (adversarial) | WFG-004 | **P1** | ✅ done (real race fixed) |
| JC-6 | De-aspirationalize "covered" journeys (perio reading, amendment, consent gate, calendar render) | WF-P02 / 038 / 018·BR-014 / 024 | **P1** | ⬜ pending |
| JC-7 | Real-binary storage round-trip (attachments / imaging via MinIO) | WF-039 / 098 / 099 | **P1** | ⬜ pending |
| JC-8 | workflow-test-map.json honesty fixes | — | **P1** | ⬜ pending |
| JC-9 | Product decisions: notifications, recall emails, EMR-import, bulk slots (NOT regressions) | WF-080·082·083·084·085 / 104 / 100 / 061 | P2 | ⏸ decision |

---

## JC-1 — Continuous doctor-visit journey · P0  (the keystone — do this first)

- **Problem:** No single journey walks a doctor through a whole visit. Coverage is stitched from
  fragments (J21 start, J01 chart, J04 performed/invoice, J22 complete) and the two clinical
  authoring acts are unproven: **WF-009 chart entry** — J01 asserts only that chart *controls
  render*, never saves/reads back; **WF-011 SOAP notes** — UNMAPPED, no journey types a fresh note
  in the UI and reads it back (J22 *seeds* notes via API; J10 only covers the addendum on a
  pre-seeded note). WF-074 (the chain) is asserted by assumption.
- **Fix:** add `apps/dentalemon/tests/e2e/journeys/23-dentist-visit-day-in-the-life.journey.spec.ts`
  (register fresh patient → New Visit → **chart a tooth condition via the UI** → **type a SOAP
  note via `soap-notes-sheet` and Save** → mark a treatment performed → Complete visit → invoice),
  with a **persistence assert at every step via `apiReader`** (independent GET), not DOM presence.
  - WF-009 read-back: independent GET `/dental/patients/:id/treatments` (or the `dental_finding`
    row) asserting the **specific** entry created this run persisted.
  - WF-011 read-back: independent GET `/dental/visits/:visitId/notes` asserting the **typed
    content** persisted (not a seeded note).
  - Register it in the harness roster (`run-journey-harness.ts` EXPECTED list) so it runs live.
- **Then:** retire/upgrade the shallow `J01` chart assertion and re-validate the inverted `J02`
  note proof (it claimed the note "cannot survive" — confirm against the live notes endpoint).
- **Acceptance:** the new journey runs in the harness and asserts durable persistence of a
  UI-authored chart entry AND a UI-authored SOAP note. **If it goes RED, root-cause the save path
  and fix the app** (this is the item that finally answers "is it broken or just untested").
- **✅ Result (J23, harness 23/23):** chart-save (WF-009) and SOAP-save (WF-011) were **NOT broken — only untested**; the React save paths persist correctly under an independent read-back. The one real bug the journey surfaced was **duplicate CDT codes** (`D4211`, `D7310`) in `cdt-codes.json` → a React duplicate-key warning + a silently-omitted catalog code; fixed at root cause (recoded the 1–3-teeth alveoloplasty to its correct `D7311`, removed the duplicate cosmetic `D4211`). Added `data-testid="condition-<state>"` to the tooth-overview condition buttons (consistency with surface/entry-classification testids). Trackers updated: WF-009 re-pointed J01→J23 (J01 = covered-shallow), WF-011 + WF-074 added to `workflow-test-map.json`.
- **Verify on pickup:** SOAP endpoint = `GET/POST /dental/visits/:visitId/notes`;
  sheet = `soap-notes-sheet.tsx` (textareas aria-label `soap-subjective/objective/assessment/plan/
  notes`, footer `Save` / `Sign & Lock`). Chart = `dental-chart.tsx` `onSelectTooth` →
  treatment/condition slideout; tooth imgs are labelled by number. Reuse J21/J22 as the rigor
  template; obey `_journey-helpers` anti-cheating (DOM-only drive + independent post-UI read).

## JC-2 — Patient login proof (magic-link + passkey) · P0

- **Problem:** `WF-003 magic-link` (the **sole patient login path**) and `WF-002 passkey` have
  **zero tests of any kind and no coverage-map entries.** A broken patient login would lock every
  patient out with no failing test.
- **Fix:** add a contract hurl for magic-link request→token-consume and passkey register→verify;
  add a live journey for the patient magic-link sign-in (request link → consume token → lands
  authenticated → independent `/me/*` read). Add `WF-002`/`WF-003` entries to the coverage map.
- **Acceptance:** magic-link sign-in proven end-to-end by a live journey + contract; passkey at
  least contract-proven. **If RED, fix the auth path.**
- **✅ Result:** magic-link was **genuinely BROKEN** (RED → fixed at root cause). The
  `auth.magic-link` email template was **missing from the initializer**, so the queue processor
  threw `No active template found for tags: auth.magic-link` and the link was **never delivered —
  patients silently locked out** (exactly the audit's prediction). Fix = add the `auth/magic-link`
  template (`.html.hbs` + `.text.hbs` + initializer metadata). Now proven by **`auth-magic-link.hurl`**
  (request → Mailpit → verify → independent `get-session` read) **+ live journey J24** (drives the
  better-auth-ui magic-link UI → consumes the emailed link → independent session read; Set B /
  skipAllowed since it needs Mailpit). Passkey contract-proven by **`auth-passkey.hurl`**
  (registration-options mounted + session-gated + returns a WebAuthn challenge; full ceremony needs
  a real authenticator). CI: `auth-magic-link` added to the core `CONTRACT_SKIP` + the Mailpit
  `CONTRACT_ONLY` lane; `auth-passkey` runs in the Postgres-only core. Coverage map: WF-002 + WF-003
  added (were absent).

## JC-3 — Make journeys a required CI gate + honest tally · P1

- **Problem:** the journey suite is built but **not a required branch-protection check**, and the
  22/22 tally counts designed-broken inverted journeys (J02, J05) as health.
- **Fix:** promote `journey-verification` to a required check; add a harness assertion that FAILS
  the run if any *core* doctor-visit WF (045/007/009/011/012/010/018/013/021) lacks a
  `proven`-grade journey; emit a distinct **proven-working vs proven-broken** split so inverted
  proofs stop reading as feature health. (Human action may be needed for branch protection — flag it.)
- **✅ Result:** `run-journey-harness.ts` now self-enforces a **CORE_DOCTOR_WFS gate** — each core
  WF (045 J21 / 009·011·021 J23 / 010·013 J04 / 012 J22 / 018 J19) must be proven by a journey
  that PASSED this run, else the harness exits 1 (caught the cheap WF-021 gap → added a PMD
  read-back to J23; WF-012 re-pointed J04→J22, the genuine complete-visit proof). Teeth proven
  non-vacuous by `computeCoreCoverageFailures` + 4 unit tests (fails on a core journey going
  BROKEN/NOT-RUN/SKIPPED). Added a **PROVEN-WORKING vs PROVEN-BROKEN** tally to the summary +
  `journey-results.json` (24 / 0 — note: J02/J05 are NOT designed-broken; the inverted-proof
  helper was already retired, so the audit's "inverted proofs inflate the count" premise was
  stale). **WF-007 check-in** is the one explicit, documented `KNOWN_CORE_GAPS` entry (its
  Check-In control is a calendar-card hover action; only `patient-checkin.spec.ts` covers it, not
  in the harness) — printed as a tracked gap, never hidden. **⚠ HUMAN remaining:** promote the
  `journey-verification` job to a required branch-protection check (GitHub settings; also gated on
  GH Actions billing being restored) — the gate is now green + self-enforcing on main.

## JC-4 — Money/destructive UI live journeys · P1

- **Problem:** record-payment (WF-014), void/uncollectible (WF-041), refund (WF-BIL-REFUND), and
  GDPR erasure (WF-088) are **backend-airtight but UI-unverified live** — highest blast radius.
- **Fix:** add live confirm→commit journeys for each (drive the UI button → confirm → independent
  read of the durable status: paid/voided/uncollectible/refunded/anonymized).
- **✅ Result:** four journeys, each driving the REAL UI + independent read — J25 record-payment
  (→ `paid`, balance 0), J26 void + mark-uncollectible (→ `voided` / `uncollectible`), J27 refund
  (→ invoice reopened, balance restored, no longer `paid`), J28 admin erasure approve (→
  `anonymized`). Shared `_billing-helpers.ts` seeds a real issued invoice via the API; reusable
  `spaNavigate` reaches `/billing` and `/settings` preserving the in-memory PIN session; erasure
  promotes the demo owner via `/dev/promote-admin` before the browser signs in. **Real bug found +
  fixed:** the billing list query (`DentalInvoiceRepository.findMany`) had **no `orderBy`** — order
  was non-deterministic, so the newest invoice could fall off page 1 and pagination was unstable
  run-to-run; added `orderBy(desc(createdAt))` (matching the per-patient facade). Coverage map:
  WF-014/041/BIL-REFUND/088 re-pointed from e2e specs → the new journeys.

## JC-5 — Concurrent same-visit invoice race · P1

- **Problem:** WFG-004 — two concurrent `createDentalInvoice` for one visit can race past the
  already-billed guard; only the sequential case is tested. Money-integrity hole.
- **Fix:** adversarial concurrency test (two simultaneous creates → exactly one 201), mirroring the
  online-booking concurrency test already in dental-scheduling.
- **✅ Result:** the race was **REAL** (confirmed RED: two concurrent creates both returned 201 →
  **two invoices for one visit**, double-billing). Root cause: the S1-T7 already-billed guard is a
  check-then-act — both transactions read `billedInvoiceId=null` under READ COMMITTED before either
  commits `markTreatmentsAsBilled`. **Fixed** by reading the visit's treatments with a row-level
  `FOR UPDATE` lock inside the create tx (`getTreatmentsForInvoiceLocked` → `findByVisitForUpdate`)
  so concurrent creates serialize and the loser is rejected (422 `TREATMENT_ALREADY_BILLED`).
  Guarded by `createDentalInvoice.concurrency.test.ts` (8-round adversarial; deterministic GREEN
  with the lock, immediate RED without — proven by temporarily stripping the lock). WFG-004 moved
  from open gap → RESOLVED in `workflow.allowlist.json`.
- **Follow-up (ultracode sweep):** a risk-weighted adversarial sweep of sibling check-then-act /
  concurrency races across the highest-blast-radius handlers (billing payments, visit lifecycle,
  consent, scheduling, erasure, inventory, …) was launched alongside this fix; any confirmed
  REAL_RACE findings are tracked for follow-up commits.

## JC-6 — De-aspirationalize "covered" journeys · P1

- **Problem:** several journeys are credited for actions they never perform: `J03→WF-P02` (never
  PUTs a perio reading), `J10→WF-038` (drives notes/addendum, not the amendment entity),
  `J19→WF-018·BR-014` (case-presentation e-sign, not the in-visit consent gate), `WF-024` calendar
  (listAppointments backend only; no journey asserts appts render on the grid).
- **Fix:** extend each journey to drive + read-back the real action (PUT a perio reading; drive the
  amendment entity; assert the in-visit consent gate blocks WF-010/012 without a signed consent;
  assert a seeded appointment is visible on the rendered calendar grid).

## JC-7 — Real-binary storage round-trip · P1

- **Problem:** attachment (WF-039) and imaging storage (WF-098/099) handoffs are stubbed with
  `filePath` strings; no test does a real MinIO PUT→GET→delete.
- **Fix:** integration test that uploads a real binary to MinIO, GETs it, and asserts delete removes
  the row + object. (MinIO must be up — see `/readyz`.)

## JC-8 — workflow-test-map.json honesty fixes · P1

- **Problem:** the map's "covered" is computed from mappings, not execution — it lies.
- **Fix:** WF-009 → `covered-shallow`; **add** WF-011, WF-032, WF-002, WF-003 (currently absent);
  WF-074 → `uncovered-composite`; add a `gate` field (`journey-harness` vs `e2e-spec`) so "covered
  but didn't run" is visible; add a top-level `provenWorking` vs `provenBroken` split. Update as
  JC-1..JC-7 land so the map stops overstating.

## JC-9 — Product decisions (NOT regressions) · ⏸ decision

Confirmed **not-built** capabilities (real gaps, but product calls — do not auto-build):
- Notification fan-out `WF-080/082/083/084/085` — no producer wiring. Wire producers (enqueue +
  DB-readback test) **or** formally de-scope.
- `WF-104` recall/reminder emails — armed in-app but processor is a mock; register templates + real
  notif→sent-email test, or keep deferred.
- `WF-100` EMR-import — mapped to a **non-existent module** (false coverage). Build or retire from
  the registry.
- `WF-061` bulk slot generation — unimplemented `[INFERRED]`. Build with TDD or retire.

---

## Execution protocol (per item)

1. **Verify on pickup** — confirm the endpoint/SDK/handler + the UI affordance + the `_journey-helpers`
   API before writing the journey. Don't assume.
2. **Vertical TDD via the harness** — write the journey (it should fail honestly if the flow is
   broken) → if RED reveals a real bug, **root-cause and fix the app** → GREEN. Never weaken the
   assertion to pass.
3. **One atomic commit per item.** End every commit message with:
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
4. **Update trackers:** flip Status here + apply the matching `workflow-test-map.json` honesty fix
   (JC-8) so coverage stops lying as you go.
5. **Gate before commit:** relevant journey green in the harness + `bun run typecheck` (both
   workspaces) + dentalemon lint ≤200 warnings + font ratchet (346) + no FE/BE regressions.

## Gotchas / how to run

- **Run the harness:** `cd apps/dentalemon && bun scripts/run-journey-harness.ts` (reseeds the demo
  DB then runs ONLY `tests/e2e/journeys/`; writes `journey-results.json`). Needs api-ts on **:7213**
  and web on **:3003** up (config reuses existing servers). `--no-reseed` skips the reseed.
- **Single spec:** `cd apps/dentalemon && bunx playwright test tests/e2e/journeys/23-*.journey.spec.ts --project=journeys`.
- **Harness helpers** (`tests/e2e/journeys/_journey-helpers.ts`): `pinAuth(page,'dentist')`,
  `openWorkspace(page, patientId)`, `readOrgContext(apiReader)`, **`apiReader`** = an INDEPENDENT
  read client (use it for every persistence assert), `recordJourneyPass/recordJourneyError`,
  `JourneyMeta` (set `rubricIds` to the WF-ID). Rigor template: **J21** and **J22**.
- **Manual /browse verify:** `demo@dentalemon.com` / `DemoClinic1!` → PIN `1 2 3 4 5 6` (owner Dr.
  Maria Reyes). **PIN drops on every FE HMR reload / API --watch restart** → re-auth. In-app
  `__TSR_ROUTER__.navigate({to,params})` preserves PIN; full `goto` drops it. Workspace URL = `/{patientId}`.
  Demo branchId `ab6dbf0a-d368-4ac0-9288-3c072525d3cf`; list endpoints often need `?branchId=`.
- **Stack/DB quirks:** the `monobase_test` template can accumulate orphan `test_*` schemas + leaked
  idle connections → "too many clients already". Fix: terminate idle conns + drop orphan `test_*`
  schemas (there are two postgres on :5432 — host-native 127.0.0.1 is what the runner/dev use).
- **Key surfaces:** SOAP notes `GET/POST /dental/visits/:visitId/notes` (`soap-notes-sheet.tsx`);
  chart `dental-chart.tsx` `onSelectTooth`; visit gate `visit-status.ts` (New Visit disabled when an
  open active/draft visit exists — by design).

---

*Source: `DOCTOR_JOURNEY_TRACEABILITY_2026-06-20.md` + `ALL_MODULE_TRACEABILITY_2026-06-20.md`,
computed from a live harness run (exit 0, 22/22) + an 11-module rigor audit, 2026-06-20.*
