# Implementation Plans

Two `improve` runs are recorded here.

- **Run 1** — 2026-06-17, commit `6bcb3af6`. Plans **001–004** (all DONE/RESOLVED).
- **Run 2** — 2026-06-18, commit `c3d93891`. Plans **005–010** (this batch).

Each executor: read the plan fully before starting, honor its STOP conditions,
run the drift check first, and update your row when done.

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
| 008 | Surface calibration-save failures in imaging workspace (toast) | P3 | S | LOW | no | TODO |
| 009 | Make carry-over treatment writes atomic via `withTenantTx` | P2 | M | MED | **yes** | TODO |
| 010 | acceptTreatmentPlan — validate consent form before snapshotting | P2 | S | LOW | **yes** | TODO |

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
