# Plan 014 — Claim-line immutability bug + targeted coverage/governance hardening

**Created:** 2026-06-22 · **Base:** `main` @ `c79235d3` (after Category-1 IDOR closure #29/#31/#32)
**Origin:** Strategic review of COVERAGE_GAP_ROADMAP Categories 2–7. Decision = **ship + ratchet** for the bulk (validated by two independent expert audits — pragmatist + healthcare-compliance). This plan is the **only must-do slice**: the one real bug the review surfaced plus four cheap, high-leverage items. Everything else in Cat 2–7 stays deferred to the CI ratchet (see DEFER list).

## Execution standard (MANDATORY — docs/development/VERTICAL_TDD.md)
- **RED before GREEN, always.** Write the failing test first; prove it fails for the right reason.
- **One slice = one branch + one PR**, off `main`. Do not batch slices.
- **Non-vacuity proof** for every new guard test: mutate the guard → test fails → revert.
- **Per-slice gate (all green before PR):** `cd services/api-ts && bun test <files>` + `bun run typecheck` + `bun run lint:test-harness` (raw Hono mounts need a `zValidator` or `buildTestApp` — this bit us in #31). For coverage-affecting slices also `bun run coverage:all:ci` (EXIT 0) and regen `bun scripts/coverage/gen-gap-roadmap.ts`.
- **CI:** all 20 required contexts green before merge. `E2E` is NOT required. `TypeScript` gate flakes on a pre-existing zod v3/v4 TS2769 in `apps/dentalemon` (NOT your change) → `gh run cancel <id>` + `gh run rerun --failed <id>`. Auto-merge is disabled; poll + `gh pr merge --squash --delete-branch`.
- Work **inline** — no parallel-agent fan-out (machine overload).

---

## S1 — FIX G1: `updateInsuranceClaimLine` immutability + audit  [P1 — must-fix, real bug]

**Verified defect (file:line):**
- `services/api-ts/src/handlers/dental-billing/updateInsuranceClaimLine.ts:21-27` accepts `billedAmountCents` + `description` (clinic-controlled billed fields), not just payer-decision fields.
- It does branch authz + `lockClaim` but has **no `claim.status` check** (`:54-61`), so a line on a `submitted`/`paid`/`written_off` claim can have its **billed amount silently rewritten**, and `recalculateBilled` (`:62`) propagates it to the claim total.
- **No `logAuditEvent`** → untraceable. Sibling `addInsuranceClaimLine.ts:41,57` correctly rejects non-`draft`/`ready` claims with `CLAIM_IMMUTABLE` (pre-tx + re-checked under lock).
- Claim FSM terminal states `paid`/`written_off`: `repos/dental-insurance-claim.schema.ts:39-50`. Route wired `generated/openapi/routes.ts:471`, FE-consumed.

**Policy to implement (confirm against the schema first):**
- `draft`/`ready` claim → all line fields mutable (current behaviour).
- Non-`draft`/`ready` (submitted/adjudicated/paid/written_off) → **only payer-decision fields** (`approvedAmountCents`, `paidAmountCents`, `status`) mutable; reject any `billedAmountCents`/`description` change with `BusinessLogicError(...,'CLAIM_IMMUTABLE')`. (This preserves the legit post-payer-decision workflow the docstring describes while closing the integrity hole.)
- Mirror `addInsuranceClaimLine`'s pattern: check pre-tx **and** re-check under `lockClaim` (status can flip mid-flight).
- Add `logAuditEvent` for the line mutation (action e.g. `insurance_claim_line.update`, resourceType `dental_insurance_claim_line`).

- [x] **RED**: test in `dental-billing/updateInsuranceClaimLine.immutability.test.ts` — PATCH `billedAmountCents` on a `paid` claim's line → expect rejection (`CLAIM_IMMUTABLE`); and a legit `approvedAmountCents` update on a submitted claim still succeeds + writes an audit row. (Confirmed RED: billed/description edits passed through 200, no audit row.)
- [x] **GREEN**: status-gated field policy (`isClaimEditable` → only payer-decision fields mutable post-submission), mirrored pre-tx + under-lock, `logAuditEvent('insurance_claim_line.update')`.
- [x] Non-vacuity (flip guard → 2 immutability tests RED) + revert; sibling concurrency + rls-activation suites + typecheck + lint:test-harness green.
- [x] One PR. This is a *code* fix, not test debt.

---

## S2 — TreatmentPlan derivation money-math test + FSM-bypass sweep  [P2]

**Context:** `treatment-plan.repo.ts:83-95` `recomputeStatus()` writes status via `deriveTreatmentPlanStatus()` (`repos/treatment-plan.schema.ts:56-77`) using the raw `update()` — **bypassing** the `TREATMENT_PLAN_FSM` guard in `updateTreatmentPlan.ts:54-61`. Expert-2 proved the derivation only emits *legal* states (so no illegal-transition bug), but it is bespoke money/clinical arithmetic (completion %, all-declined denominator, scheduled-vs-approved baseline) with **zero unit test**.

- [x] **Sweep done**: QueueItem (`updateQueueItemStatus` → `QUEUE_ITEM_FSM.includes`), LabOrder (`repo.updateStatus` → `LAB_ORDER_TRANSITIONS.includes`), Treatment (`updateDentalTreatment` → `TREATMENT_TRANSITIONS.includes` + sync monotonic merge), WaitlistEntry (`promote` = sole status write, active→scheduled, gated by handler pre-check + `WHERE status='active'`). **No domain can emit an illegal state → no escalation.** The only deliberate FSM bypass is `recomputeStatus`, and the invariant test proves it only emits valid lifecycle states.
- [x] **GREEN** (characterization pin): augmented the EXISTING `treatment-plan-derivation.test.ts` (it already covered all-declined/partial/full/empty) with the gaps S2 named — `scheduled` baseline preserved/advances, partially_completed/completed→approved fallback, `rejected` untouched, and the only-valid-lifecycle-state safety invariant. 11/11 pass. Non-vacuity: mutating the scheduled-baseline branch → RED; reverted.
- [x] One PR.

---

## S3 — Contract/wire tests: consent + medical-history writes  [P2 — compliance]

`updatePatientCommunicationConsent` (consent-bearing) and `recordMedicalHistoryReview` are FE-consumed and unit-tested but have **no contract test pinning the wire shape** the FE depends on. A silent wire regression on consent is a compliance event, not a UX bug.

- [x] Added Hurl contract tests: `dental-patient.hurl` (communication-consent PATCH partial-merge + GET read-back) and `dental-clinical.hurl` (medical-history-review POST + GET). All pass against the live API (non-vacuity proven: flipping a consent assert → fail; reverted).
- [x] Discharged **3** `endpoint.allowlist.json` entries now `tested`: `updatePatientCommunicationConsent`, `recordMedicalHistoryReview`, `getMedicalHistoryReview` (the GET rode along for free). `getPatientCommunicationConsent` = orphan (not a gap). Regenerated endpoint-matrix + COVERAGE_GAP_ROADMAP; `coverage:all:ci` exit 0; 196 coverage tests pass.
- [x] One PR.

---

## S4 — Frozen FSM-table snapshot test  [P3 — cheap drift guard]

Converts Cat-4's 48-edge debt into ONE guard: import each domain's transition table (`*_FSM` / `*TRANSITIONS` in the schema/repo files) and assert it matches a committed snapshot. Fails CI if anyone edits a transition table without review.

- [x] `scripts/coverage/fsm-snapshot.test.ts` freezes **all 17** discovered transition tables (not just the 9 enumerated): reuses `discoverFsms()` so the snapshot covers table names AND each from→to[] map in ONE literal — catches a new/removed/renamed table and any edge add/remove/reorder. No 17-way import, no workspace-boundary crossing. Tables: Appointment, CephLandmark, ClaimDraft, CoverageAuth, Finding, InsuranceClaim, LabOrder, PaymentPlan, Prescription, QueueItem, Recall, Sync, Task, Treatment, TreatmentPlan, Visit, WaitlistEntry.
- [x] Runs in the Coverage Ratchet CI job (`bun test ./scripts/coverage/`); 198/198 coverage tests pass. Non-vacuity: adding an illegal `waiting→completed` edge to QUEUE_ITEM_FSM → RED; reverted.
- [x] One PR.

---

## S5 — Governance: allowlist CODEOWNERS + RLS second-tenant trip-wire  [P2 — closes the compounding vector]

The ratchet blocks *new* gaps, but `docs/testing/coverage/*.allowlist.json` is self-editable — a dev can neutralize a new gap by appending a `reason`. And RLS is posture-only: the moment a 2nd `dental_organization` exists before full RLS activation, un-routed handlers leak cross-tenant PHI.

- [x] `.github/CODEOWNERS`: added a "self-editable quality gates" section requiring code-owner review on `docs/testing/coverage/*.allowlist.json` (the gap-neutralization vector) + `*rls*` migrations. (Enforcement also needs the branch-protection "Require review from Code Owners" toggle — an admin setting, noted in-file.)
- [x] RLS trip-wire: `services/api-ts/scripts/check-single-clinic-invariant.ts` — fails (exit 1) if `count(dental_organization) > 1` while `RLS_FULLY_ACTIVATED` is false. A pre-launch/release gate (NOT a suite test — per-file test DBs seed many orgs by design); pure predicate `violatesSingleClinicInvariant` unit-tested in `src/core/single-clinic-invariant.test.ts` (4/4). Documented as a hard release gate in ADR-010 + KNOWN_LIMITATIONS.md. Smoke-verified: flagged the 6-org dev DB, exit 1.
- [x] One PR.

---

## DEFER (validated by both expert audits — do NOT build now; ratchet holds the line)
- Cat 2: the other ~42 FE-consumed-untested ops (UI-witnessed; happy path implicitly covered).
- Cat 3: all 44 secondary-workflow E2E journeys (9 required core journeys already green).
- Cat 4: the 24 illegal TreatmentPlan edges + remaining per-edge tests (table-enforced; S4 snapshot covers drift).
- Cat 5: V-XRI-003 (FHIR import — not built; YAGNI). BR-P03 perio negative path = opportunistic.
- Cat 6: 2 patient-portal read routes.
- Cat 7: G3/G4 cross-module RLS-isolation E2E — gated on RLS activation (the S5 trip-wire is the guard until then).

## Status
| Slice | Title | Priority | Status |
|-------|-------|----------|--------|
| S1 | updateInsuranceClaimLine immutability + audit | P1 | DONE |
| S2 | deriveTreatmentPlanStatus test + FSM-bypass sweep | P2 | DONE |
| S3 | consent + med-history contract tests | P2 | DONE |
| S4 | frozen FSM-table snapshot | P3 | DONE |
| S5 | allowlist CODEOWNERS + RLS trip-wire | P2 | DONE |
