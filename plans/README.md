# Implementation Plans

Three `improve` runs are recorded here.

- **Run 1** — 2026-06-17, commit `6bcb3af6`. Plans **001–004** (all DONE/RESOLVED).
- **Run 2** — 2026-06-18, commit `c3d93891`. Plans **005–010** (all DONE).
- **Run 3** — 2026-06-18, commit `9524a2d3`. Plan **011** (this batch).

Each executor: read the plan fully before starting, honor its STOP conditions,
run the drift check first, and update your row when done.

---

## Run 3 — 2026-06-18 (commit `9524a2d3`)

A re-audit after Run 2, explicitly excluding everything already tracked/rejected
in Runs 1–2 and `docs/KNOWN_LIMITATIONS.md`. It was a deliberately **thin** run —
no P0/P1; the prior runs cleared the high-leverage backlog and most of what
remains is multi-tenant-cloud-scale concern (deferred for the local-first,
1–3-dentist-clinic v1). Only the two cheap, real frontend error-handling bugs
(same class as plan 008) were worth planning now.

### Run 3 status

| Plan | Title | Priority | Effort | Risk | Review-gated | Status |
|------|-------|----------|--------|------|--------------|--------|
| 011 | Surface 2 silent FE failures (image-compare blob-load + follow-up-note save) | P3 | S | LOW | no | DONE (advisor/011) — Bug1: `.catch`→both urls null routes openDB rejection to OfflinePlaceholder (`.then` byte-unchanged); Bug2: `addNote(text,{onSuccess})` clears textarea only on 2xx + inline "Could not save note" on error. RED→GREEN both; +2 tests (reject-open fake IDB / POST 500). tsc 0, lint 0err |

### Run 3 — findings considered and NOT planned (so nobody re-audits them)

Vetted against live code at `9524a2d3`:

- **Payment-plan / insurance-claim FSM check-then-act race** (`dental-billing/repos/dental-payment-plan.repo.ts:198` setStatus reads→checks→updates with no row lock). REAL race class, but the auditor's premise ("a `version` field exists but is unused") is **false** — there is no version column. For a local-first single-clinic product, concurrent transitions on the same plan are near-impossible. Deferred to multi-tenant-cloud prep (fix then = compare-and-swap `WHERE status = ?` or `SELECT … FOR UPDATE`, no new column needed).
- **New N+1 instances**: `dental-perio/listPerioChartsForPatient.ts:58` (1 query/chart, ≤12), `dental-imaging/getImagingStudy.ts` + `listPatientImages.ts` (per-image teeth + per-image presigned S3 URL). Bounded per request; same family as the documented `listDentalInvoices` N+1. Cloud-scale; not now.
- **`booking/updateScheduleException.ts:36` mass-assignment** (`updateOneById(id, body)`, no zod). Auditor claimed cross-user IDOR — **false**: the handler enforces `exception.owner !== personId → 403`. Also the route is **not in the OpenAPI registry** (`booking` = generic template module, unmounted in dentalemon) → not a live surface. Residual = low-severity self-record mass-assignment on near-dead code. Not worth it.
- **`dental-clinical/consent/listConsentRefusals.ts` no pagination**: already known — this is the exact handler plan 006 deliberately left as-is (returns all in one page).
- **`dental-org/branchSettings.ts` `.passthrough()` schema**: settings are stored as opaque JSON; low-signal hygiene, not a live bug.
- **Direction (options, not problems)**: SDK has only 2 hand-written flows (`packages/sdk-ts/src/flows/`) — a clinical/imaging multi-step flow would help *external* SDK consumers (only worth it if that's a goal); the E2E job is non-blocking (`quality.yml:325`, `continue-on-error: true`, "drop once green") — splitting into a blocking no-infra tier + optional infra tier would let real regressions gate CI.

### Run 3 — Rust hardening (separate concern, not planned here)

`services/cadence` + `services/api-ts-embedded` were never audited before. A light
read found panic-on-untrusted-input sites: JWKS parse `.unwrap()`
(`cadence/src/auth.rs:435,569`), stream `pop_front().unwrap()`
(`cadence/src/stream.rs:146,233`), embedded `serde_json::to_string().unwrap()` ×6
(`api-ts-embedded/src/engine.rs`), and `lock().unwrap()` mutex-poison patterns.
Real defensive-hardening items, but cadence sync is "not yet fully exercised"
(per CLAUDE.md) and the product is local-first — worth a dedicated Rust-hardening
plan **if/when** live P2P sync gets exercised, not now.

---

## Run 2 — sequence & how to execute (2026-06-18)

Plans are independent (no inter-plan dependencies). **Execute 005 → 010 in
order**: it goes safe/mechanical first, then the two clinical write-path changes
(009, 010) last. The ordering is by ascending risk, not dependency — so an
executor builds confidence on no-risk diffs before the reviewed ones, and the
risky pair gets the freshest attention. Any plan can also be done standalone.

Every plan's "Suggested executor toolkit" wires in the **superpowers** skills:
`test-driven-development` (RED→GREEN) for all code changes,
`verification-before-completion` before any "done" claim, and — for the two
clinical write paths (009, 010) — `requesting-code-review` is **mandatory after
GREEN, before merge** (these touch patient clinical data).

### Run 2 status

| Plan | Title | Priority | Effort | Risk | Review-gated | Status |
|------|-------|----------|--------|------|--------------|--------|
| 005 | Extract `parseUserRoles` helper (dedupe 16 inline role splits) | P2 | S | LOW | no | DONE (advisor/005) — 15 sites (plan miscounted its own 15-file list as 16); helper at handlers/shared, 4 tests pass, tsc 0, lint 346w |
| 006 | Push dental-clinical list pagination into the DB (7 repos + handlers) | P2 | M | MED | no | DONE (advisor/006) — 7 overrides deleted, 6 handlers→count+findMany(pagination); consent-refusal handler left as-is (no slice, just override dropped); 185 affected tests pass, tsc 0, lint 346w |
| 007 | Native git pre-commit hook (typecheck + lint, no new dep) | P3 | S | LOW | no | DONE (advisor/007) — .githooks/pre-commit + prepare→core.hooksPath, no dep; bad-path (TS2322) blocks commit, good-path allows; hook ran live on its own commit |
| 008 | Surface calibration-save failures in imaging workspace (toast) | P3 | S | LOW | no | DONE (advisor/008) — try/catch→toastError + early-return (dialog stays open). Full render impractical (canvas + 4 data hooks), so used the plan-sanctioned extract: tiny confirmCalibrationSave orchestrator in handlers.ts (+2 unit tests). tsc 0, lint 0err |
| 009 | Make carry-over treatment writes atomic via `withTenantTx` | P2 | M | MED | **yes** | DONE (advisor/009, commit 3730affd) — both write loops in one withTenantTx({branchIds:[currentVisit.branchId]}); dismissed read lifted to db; field mapping byte-identical. RED→GREEN (spyOn tx + persistence). Code review PASSED (impl correct; caught a stash-induced commit-split — amended). 41 tests pass, tsc 0, lint 0err |
| 010 | acceptTreatmentPlan — validate consent form before snapshotting | P2 | S | LOW | **yes** | DONE (advisor/010, commit aff29686) — consent-form check hoisted above createSnapshotVersion (retry loop left un-wrapped); edited handler is the live route (dental-patient file is a codegen re-export shim). RED→GREEN (404+no-orphan) + added valid-link happy-path test. Code review PASSED (Yes, no Critical/Important). 10+21 tests pass, tsc 0, lint 0err |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

### Run 2 dependency notes

- None. All six are independent. The 005→010 order is risk-ascending, not a
  dependency chain — parallelize if you want, but get review on 009/010.
- 009 and 010 both live under `handlers/dental-visit/treatments/` but touch
  **different files** (`carryOverTreatments.ts` vs `acceptTreatmentPlan.ts`) — no
  conflict.

### Run 2 shared verification commands

- Backend typecheck: `cd services/api-ts && bun run typecheck`
- Backend lint: `cd services/api-ts && bun run lint`
- Backend tests (DB-backed): `cd services/api-ts && bun run scripts/test-with-db.ts <file> [<file>...]`
  — pass explicit **FILE** paths, never a directory (the wrapper provisions the
  `monobase_test` DB; a directory arg yields phantom failures).
- Frontend (plan 008): `bun run --filter dentalemon typecheck` /
  `bun run --filter dentalemon lint` / `cd apps/dentalemon && bun run test <file>`.

### Run 2 — findings considered and rejected (so nobody re-audits them)

Verified against live code at `c3d93891`:

- **availability.service.ts non-null assertions** (`:105-106`): FALSE — guarded
  by `if (candidates.length === 0) continue;` at `:102`.
- **addInsuranceClaimLine returns 404 on authz failure**: BY DESIGN — IDOR
  non-disclosure (don't reveal a claim exists in another branch). Consistent with
  the prior security pass.
- **listDentalInvoices N+1**, **expand.ts batch endpoint**, **audit-purge
  `markForPurging` no-op**, **WebRTC session-token reuse**, **coverage-threshold
  mismatch**, **lint `--max-warnings` ratchet**, **RLS deferral**, **form-library
  RHF/TanStack split**, **`baseUrl` TS7.0 deprecation**: all documented in
  `docs/KNOWN_LIMITATIONS.md` / ADR-009 / ADR-010 = tracked decisions, not fresh
  findings. (Audit purge is a real future compliance item but is a *decision +
  spike*, not a bug — surfaced to the maintainer separately, not planned here.)
- **Ceph landmark `void commitLandmark.mutateAsync()` "unhandled rejection"**:
  NOT a bug — `useCephLandmarks` rolls back optimistically on error and exposes
  `mutationError` for the UI. Only the *calibration* path lacked handling → that
  became plan 008.
- **"77 skipped E2E specs"** (subagent claim): actual count is ~20, mostly
  infra-gated; not worth a plan.
- **acceptTreatmentPlan full two-write transaction**: REJECTED as unsafe —
  `createSnapshotVersion` uses a unique-violation retry loop that breaks inside a
  transaction (Postgres aborts the tx on first collision). Plan 010 does the safe
  reorder instead and documents why.
- Fire-and-forget notification `.catch(()=>{})`, billing metadata `as` casts,
  Stripe-webhook file size, facade-count "duplication", `drizzle`/`aws-sdk`
  "verify version" items: low-signal / by-design / speculative — not planned.

### Run 2 — not audited

`services/cadence` + `services/api-ts-embedded` (Rust), `apps/account` (frozen
template), `apps/website` (untracked marketing site), `apps/sample-workspace`
(sandbox), deep contract/spec internals. Security breadth leaned on the prior
(vetted) passes rather than a from-scratch re-sweep — the prior run already
confirmed the 2026-06-16 security audit was ~90% remediated.

---

## Run 1 — 2026-06-17 (commit `6bcb3af6`)

A thorough security/quality/coverage audit was written 2026-06-16
(`docs/audits/SECURITY_QUALITY_COVERAGE_AUDIT_2026-06-16.md`). When that plan set
was produced, the audit was **~90% already remediated** — all security P0s/P1s
(cross-tenant IDORs, logged Stripe key, missing authz), the Stripe-webhook
200-on-failure bug, and the payments/erasure/legal-hold test gaps were verified
fixed in source. The four plans below were the findings that remained live.

### Run 1 status

| Plan | Title | Priority | Effort | Risk | Status |
|------|-------|----------|--------|------|--------|
| 001 | pg-boss production-safe retention/expiry outside tests | P1 | S | LOW | DONE (59ebad00) |
| 002 | createInvoice tax | P2 | S | LOW | RESOLVED — descoped for v1, ADR-011 (aafe999f). API has no tax input; tax=0 is contract-consistent. |
| 003 | markInvoiceUncollectible performs cleanup (cancel intent, audit, notify) | P2 | M | MED | DONE (d788f6a1) |
| 004 | Assert rejection of the 23 uncovered illegal FSM transitions | P2 | M | LOW | DONE (6cb00d21) |

### Run 1 — findings considered and rejected

- **All 2026-06-16 audit security P0/P1s** (P0-1/2, P1-1..7): verified FIXED in
  current source, each with a comment citing the audit's own numbering.
- **P1-8 PII in interpolated logs**: FIXED — `core/auth.ts` logs email as a
  redacted object field. **P1-9 RLS activation on ~60 unarmed tables**: by-design
  deferral (`ADR-010-tenant-isolation-rls-pre-ga.md`). **H-2 Stripe webhook
  200-on-failure / idempotency**: FIXED (retryable 5xx + idempotency ledger +
  replay test). **Payments/erasure/legal-hold orphan endpoints**: NOW COVERED by
  8 dedicated test files. **P1-7 storage stored-XSS download vector**: CLOSED
  (forced `Content-Disposition: attachment` + `application/octet-stream`);
  residual upload-side mimeType allowlist is defense-in-depth only.
- **`expand.ts` N+1**: acknowledged design tradeoff. **alert() in
  personal-info-form, joinVideoCall USE_SESSION_TOKEN sentinel, FE
  invoice-invalidation branchId, treatment-table price-unit sourcing**: low-impact
  known minor debt.
