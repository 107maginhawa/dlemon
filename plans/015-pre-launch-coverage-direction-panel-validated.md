# Plan 015 — Pre-launch coverage direction (panel-validated)

**Created:** 2026-06-23 · **Base:** `main` @ `84776267` (after plan 014 + CI-hardening #38/#39)
**Origin:** A 3-expert read-only review panel (compliance / architecture / pragmatist) evaluated the question *"work the pre-existing untested paths, or archive them?"* All three converged. This plan encodes their verdict.

## The verdict (what NOT to do — panel-unanimous)
- **Do NOT chase the coverage matrices to zero.** The ratchet already blocks all NEW debt; the deferred tail is tracked, not silently missing.
- **Do NOT write per-edge illegal-FSM rejection tests** (the ~32 illegal edges / 24 TreatmentPlan edges). They are ALREADY property-tested *and* guarded by table-driven `!allowed.includes()` checks. Literal per-edge assertions = the canonical "coverage up, risk down zero" time-sink. (Confirmed: `dental-visit/visit.fsm.property.test.ts:79`, `treatment-plans/updateTreatmentPlan.ts:54`.)
- **Do NOT archive/delete any base-template module.** The original "delete booking/comms/email/storage/reviews/emr/notifs" idea was wrong: `notifs` (consent-gated dunning + statements) and `storage` (imaging, clinical attachments, **GDPR erasure S3 purge**) are load-bearing; `booking`'s status is disputed; and in a spec-first/polyglot template, deletion forks upstream and cascades through TypeSpec → generated routes/validators/registry → SDK → two FE apps → ~15 contract suites → 3 drift gates. Not worth it.

## Execution standard (MANDATORY — docs/development/VERTICAL_TDD.md)
- RED before GREEN; one slice = one branch + one PR off `main`; non-vacuity proof for every new guard test (mutate guard → test fails → revert).
- Per-slice gate before each PR: `cd services/api-ts && bun test <files>` + `bun run typecheck` + `bun run lint:test-harness`. For coverage-affecting slices also `bun scripts/coverage/run-all.ts --check` (EXIT 0) + commit regenerated `docs/testing/coverage/*` + `gen-gap-roadmap.ts`.
- All 20 required CI checks green before merge. `E2E` is NOT required. Auto-merge disabled → poll `gh pr checks <n>` then `gh pr merge <n> --squash --delete-branch`.
- Work INLINE — no parallel-agent fan-out.

---

## S1 — Enforce the single-clinic invariant as a real gate  [P0 — highest ROI, panel #1]
Today `services/api-ts/scripts/check-single-clinic-invariant.ts` is a script on disk only. Both compliance + pragmatist ranked converting it to an *enforced* gate as the single highest-value action: it's the only automated trip-wire for the biggest residual PHI risk (a 2nd `dental_organization` before RLS activation → un-routed handlers leak cross-tenant PHI).

- [ ] Wire the invariant into the **release/deploy path as a hard gate** (run the script against the target DB; exit 1 blocks the deploy). If no deploy pipeline exists yet, add it to the documented release checklist as a hard gate AND add a **startup advisory** in `services/api-ts` boot that logs CRITICAL when the invariant is violated.
- [ ] **CAVEAT (don't brick dev/test):** dev/test DBs seed many orgs by design (the dev DB has 6). Any *enforcement* must be production/deploy-scoped (e.g. an env flag, or a deploy-only CI job), NEVER an unconditional boot-time hard-fail. Scope the mechanism in the PR.
- [ ] Add a small runnable check for the enforcement glue (the pure predicate is already tested).
- [ ] One PR.

## S2 — Reclassify base-template orphans as `template-base` (honest denominator)  [P2 — cheap, zero-churn]
~70 of the 158 orphans are upstream base-template module ops (booking, comms, email, storage, reviews, emr, notifs, generic providers/patients/persons) the dental product doesn't call. They permanently can't be zeroed, which trains the team to ignore the orphan metric. Fix the *count*, not the code.

- [ ] Add a `template-base` disposition to the endpoint matrix generator (`scripts/coverage/endpoint-matrix.ts`) + a committed list of the base-template operationIds; **exclude that category from the orphan denominator** (report it separately). Mechanism mirrors the existing orphan-disposition machinery.
- [ ] **MUST NOT** reclassify any sensitive-mutating-orphan or any FE-consumed gap — only genuinely-unused base-template surface.
- [ ] Regen matrices + roadmap; `--check` EXIT 0; coverage tests green. The orphan line should read e.g. "~88 product orphans + ~70 template-base".
- [ ] One PR (can fold S3 in).

## S3 — Refresh 2 stale allowlist reasons  [P3 — trivial, fold into S2]
`updateMember` ("SUSPECTED credential-write IDOR") and `createPatient` ("Mutating PII … skeptic-fan-out pin") allowlist reasons are stale — the guards now exist (`updateMember.ts:57-75` owner-gates license/npi/role; claim-line freeze landed in 014 S1). Update the reasons to state the guard exists + that a deny pin is tracked in S4.

- [ ] Edit `docs/testing/coverage/endpoint.allowlist.json` reasons; regen roadmap.

## S4 — Add the FE-reachable deny-path pins  [P1 — the only real test work]
Each is backend-tested but missing an FE-reachable cross-tenant/authz **deny** pin (the class that hid the original `updatePatientContact` IDOR). Compliance's ranked list + pragmatist's money writes. One PR per pin (or batch closely-related ones); discharge the allowlist entry + regen roadmap where it flips to tested.

- [ ] **S4a `updateMember`** (`PATCH /dental/org/members/{memberId}`) — non-owner member edits `licenseNumber`/`npi`/`role` → 403; cross-tenant `memberId` → deny. (Highest value: privilege + provider-of-record integrity.)
- [ ] **S4b `updateInsuranceClaimLine`** (`PATCH .../claims/{claimId}/lines/{lineId}`) — contract/wire pin + `CLAIM_IMMUTABLE` deny on a submitted/paid claim (guard exists from 014 S1; this adds the contract-layer pin).
- [ ] **S4c `refundDentalPayment`** (`POST .../payments/{paymentId}/refund`) — FE-reachable cross-tenant/foreign-payment deny (has concurrency test only).
- [ ] **S4d `markUncollectible`** (`POST .../invoices/{invoiceId}/uncollectible`) — non-owner deny (`markUncollectible.ts:44` owner gate).
- [ ] **S4e `updateTooth`** (`PATCH .../visits/{visitId}/chart/teeth/{toothNumber}`) — locked-visit `VISIT_IMMUTABLE` deny FE-side (`chart/updateTooth.ts:42`).
- [ ] **S4f (optional) `createPatient`** (`POST /dental/patients`) — tenant-scoping contract pin (pragmatist flagged; compliance thinks it's likely fine — opportunistic).

## S5 — Branch-protection "Require review from Code Owners" toggle  [ADMIN — user action, NOT code]
Plan 014 S5 added CODEOWNERS on `*.allowlist.json` + `*rls*` migrations, but enforcement needs the GitHub branch-protection **"Require review from Code Owners"** toggle ON. Until then the allowlist self-edit vector is open and the ratchet is *advisory, not enforced*.

**RESOLVED 2026-06-23 — N/A for a single-maintainer repo (toggle intentionally left OFF).** The repo has one writer (`@107maginhawa`); GitHub never lets a PR author approve their own PR, so a code-owner-review requirement could never be satisfied and would hard-block every PR touching the governance files. The stale `@eladventures` owner (a removed account) was repointed to `@107maginhawa`, so CODEOWNERS now serves as an auto-review-request *visibility* nudge on those PRs. Mechanical enforcement would need a second maintainer or a CI gate (deferred — not built; the existing ratchet already blocks new untested gaps, and the allowlist edit is now at least surfaced on every such PR).

- [x] ~~enable the toggle~~ → not viable solo; CODEOWNERS fixed to a valid owner + documented as visibility-only.

---

## Status
| Slice | Title | Priority | Owner | Status |
|-------|-------|----------|-------|--------|
| S1 | Enforce single-clinic invariant gate | P0 | agent | ✅ DONE (#41 `cc1c908f`) |
| S2 | Reclassify base-template orphans (denominator) | P2 | agent | ✅ DONE (97 product orphans + 61 template-base) |
| S3 | Refresh 2 stale allowlist reasons | P3 | agent | ✅ DONE (folded into S2) |
| S4a | updateMember deny pin | P1 | agent | ✅ DONE (cross-tenant 403, dental-org.hurl) |
| S4b | updateInsuranceClaimLine contract + immutability pin | P1 | agent | ✅ DONE (CLAIM_IMMUTABLE 422 + cross-tenant 404) |
| S4c | refundDentalPayment cross-tenant deny | P1 | agent | ✅ DONE (cross-tenant 403) |
| S4d | markUncollectible non-owner deny | P1 | agent | ✅ DONE (cross-tenant 403) |
| S4e | updateTooth locked-visit deny | P1 | agent | ✅ DONE (VISIT_IMMUTABLE 422) |
| S4f | createPatient tenant-scoping pin | P2 | agent | SKIPPED (optional; compliance: likely fine) |
| S5 | "Require review from Code Owners" toggle | P1 | **user** | ✅ RESOLVED N/A (solo repo — toggle off; CODEOWNERS owner fixed @eladventures→@107maginhawa) |

**S4 note:** all 5 pins batched into one PR (closely-related contract deny pins, as the plan permits) to avoid 5 sequential conflict-prone matrix regens. Each validated against a live stack; all 5 ops flip gap→tested and their allowlist entries are discharged. S4f (createPatient) skipped — optional, and compliance judged it likely fine.

## CI gotchas (carried from plan 014 / #38)
- Coverage Ratchet fails "matrices STALE" → regen `bun scripts/coverage/run-all.ts` + commit `docs/testing/coverage/*`.
- TypeScript zod-flake is FIXED (formResolver wrapper) — should not recur.
- E2E (not required) holds a run in-progress → blocks `gh run rerun --job`; cancel the run or push to re-trigger.
- Backend deny tests: `spyOn(Repo.prototype,'method')` not `mock.module`; raw Hono mounts need a `zValidator` (Migration Safety Lint = lint:test-harness); seed attacker with NO `dental_membership` row to trip DB-backed guards.
