# Confidence Dimension — dental-audit

> **Dimension:** confidence · **Scope:** dental-audit · **Date:** 2026-05-30 · **Team size:** small
> **Layers audited:** 1–4 (static) · Layers 5–6 deferred (runtime)
> **Behavior inventory source:** `docs/audits/compliance/dental-audit.md` (compliance slice) + module test files
> **Graph ground truth:** `docs/audits/codebase-map/` (dental-audit = 4 source files, generic framework, LOW map-confidence)
> **Verdict:** WARN (no P0; 1 P1, 3 P2, 1 P3)

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 7/10 | Good — all active-path ACs/BRs meaningfully covered with real assertions | Consumer write path uncovered; count + pagination determinism uncovered |
| 2. Behavior Traceability | 7/10 | Good — every active AC/BR has a named test owner | Latent consumer path (V-AUD-101/102) + pagination (V-AUD-103) untraced |
| 3. Test Quality Hardening | 8/10 | Good→Strong — specific status/error-code + PHI-leak negative assertions | A few `toBeDefined()` existence checks; handler suite uses inline app, not real wiring |
| 4. Release Gate Readiness | 6/10 | Partial — full CI (typecheck/lint/test) but build step is a stub; no VERSION file | Build step is `echo`; no security-scan step; migrations auto-run with no dry-run |

**Overall Test-Confidence (min L1–L3):** 7/10 — headline test-quality signal
**Release-Readiness (L4):** 6/10 — separate release-infra gauge
**Ship-Readiness (min L1–L4):** 6/10 — conservative combined gate
**Average Score:** 7.0/10

## Module under test

`dental-audit` is an append-only audit trail: one privileged read endpoint
(`GET /dental/audit-events`), append-only 405 guards on DELETE/PUT/PATCH, the
`AuditLogRepository` (insert + list against `dental_audit_log`), and a
registered-but-unfed pg-boss consumer (`consumers/domain-events.consumer.ts`).
The active write path is the shared `core/audit-logger.ts#logAuditEvent`
(out-of-module; covered by `audit.test.ts` V-AUD-NEW-A). No state machine, no
hash chain (MODULE_SPEC §8 = "None — append-only").

### Files read (exhaustive, hand-written only)
- `handlers/dental-audit/getAuditEvents.ts`
- `handlers/dental-audit/repos/audit-log.repo.ts`, `repos/audit-log.schema.ts`
- `handlers/dental-audit/consumers/domain-events.consumer.ts`
- `handlers/dental-audit/audit.test.ts` (294 ln), `getAuditEvents.test.ts` (217 ln), `audit-append-only.test.ts` (63 ln)
- `db/dental-audit.test.ts`, `db/dental-audit-wiring.test.ts` (cross-module, legacy `dental_audit` table)
- `app.ts:197-208` (route registration), `.github/workflows/{quality,contract,openapi-drift,postgres-services,release}.yml`

## Layer 1 — Coverage Integrity (7/10)

| Rule Class | Items | Meaningfully covered | Uncovered | Weight |
|---|---|---|---|---|
| Auth/permissions | 3 (401 unauth, 403 non-owner, branch-access deny) | 401 ✓, 403 ✓; branch-access allow ✓ (DTO test seeds membership). Branch-access **deny** path not directly asserted | partial | 35% |
| Business rules | 5 (PHI strip, append-only, required fields, date-range, branch-required) | All ✓ (V-AUD-NEW-A PHI strip nested+array; AUD-BR-004; INVALID_DATE_RANGE; EM-AUD-002 400) | — | 30% |
| State transitions | 0 (none — append-only) | n/a — weight redistributed | — | 20%→0 |
| API routes | 4 verbs (GET, + DELETE/PUT/PATCH 405) | 405 trio ✓ via REAL app; GET ✓ via inline app only | GET route registration unverified end-to-end | 15% |

State-transition weight (20%) redistributed across auth/BR/API. Strongest area:
business rules (PHI sanitization is tested at top-level, nested-object, and
array depth with positive + negative + value-absence assertions). Weakest:
the consumer insert path and the repo `total`/pagination internals are executed
by no test.

## Layer 2 — Behavior Traceability (7/10)

| Behavior (from compliance slice) | Test Owner | Assertion |
|---|---|---|
| AC-AUD-002 append-only → 405 IMMUTABLE | `audit-append-only.test.ts` (real app) | STRONG (status + code) |
| AC-AUD-003 viewer branch-scoped + branchId required | `getAuditEvents.test.ts` EM-AUD-002 | STRONG (400 VALIDATION_ERROR) |
| AC-AUD-004 no PHI / snapshots omitted from DTO | `getAuditEvents.test.ts` V-AUD-003 + `audit.test.ts` V-AUD-NEW-A | STRONG (negative leak assertions) |
| AUD-BR-004 required fields | `audit.test.ts` | STRONG |
| Self-audit ACCESSED on view (WF-028) | `getAuditEvents.test.ts` V-AUD-NEW-B | STRONG (action/eventType/metadata) |
| eventType filter | `getAuditEvents.test.ts` V-AUD-004 | STRONG (meta.total) |
| Date-range validation | `getAuditEvents.test.ts` V-AUD-002 | STRONG (422 + 400) |
| **Consumer insert (V-AUD-101)** | **NONE** | untraced (latent) |
| **Consumer silent-drop (V-AUD-102)** | **NONE** | untraced (latent) |
| **Pagination determinism (V-AUD-103)** | **NONE** | untraced |

No invented IDs — all test IDs map to the compliance slice / spec. No
TDD_PROOF.md references dental-audit (proof verification skipped, no adjustment).

## Layer 3 — Test Quality Hardening (8/10)

- **Assertion strength:** mostly STRONG — `toBe(405)`, `toBe('AUDIT_EVENT_IMMUTABLE')`,
  `toBe('INVALID_DATE_RANGE')`, `.not.toHaveProperty('beforeSnapshot')`,
  `JSON.stringify(body).not.toContain('SHOULD NOT LEAK')`. A handful of weak
  `toBeDefined()` existence checks (`audit.test.ts:53,59,151,154`).
- **Mocks:** APPROPRIATE — no DB mocking; tests use a real test DB
  (`openTestTx` rolled-back transactions in `audit.test.ts`; TRUNCATE teardown
  in `getAuditEvents.test.ts`). Logger is stubbed (deterministic, fine).
- **Flake:** STABLE — no `.skip`/`.todo`, no sleeps, no retry/timeout overrides.
- **Data:** SEEDED — `makeEntry()` factory, `seedOwnerBranch()`, per-test unique
  tenant namespaces, transaction rollback isolation. BRITTLE note: hardcoded
  UUID literals throughout (acceptable — namespaced `da01…`/`da09…` to avoid
  seed collisions; documented intent).
- **Wiring caveat (project memory `feedback_test_verification`):**
  `getAuditEvents.test.ts` exercises the handler through an inline `buildTestApp()`
  Hono instance, NOT `createApp()`. The GET route IS registered (`app.ts:206-208`)
  but no test proves the real app routes GET to this handler — only the 405 guards
  are real-app verified. This is the same class of gap the append-only suite was
  deliberately rewritten to close (`audit-append-only.test.ts:5-10`).

## Layer 4 — Release Gate Readiness (6/10)

| Sub-check | Status |
|---|---|
| CI config | YES (`.github/workflows/`) |
| Test step | PRESENT (`quality.yml`: `bun test`) |
| Lint step | PRESENT (`bun run lint`) |
| Type check step | PRESENT (`bun run typecheck`) |
| Build step | STUB (`run: echo "build"` — not a real build) |
| Security scan | ABSENT |
| Contract / drift CI | PRESENT (`contract.yml`, `openapi-drift.yml`, `postgres-services.yml`) |
| Migrations | auto-run on start; no down/dry-run gate |
| Version mgmt | CHANGELOG.md present; no VERSION file; `release.yml` present |
| Health endpoint | out of module scope |

## Cross-Layer Consistency

No inconsistency: L1≈L2 (7≈7, within tolerance); L3 (8) does not exceed L1/L2 by
>4; L4 (6) within band. Test quality slightly leads coverage — expected when a
few behaviors (consumer, pagination) lack any owner.

## Findings (prioritized)

### CONF-AUD-001 (P1) — pg-boss consumer write path has NO test and bypasses PHI sanitization (latent)
`consumers/domain-events.consumer.ts:36-46` inserts caller-supplied
`beforeSnapshot`/`afterSnapshot` verbatim via `repo.insert`; PHI sanitization
lives only in `logAuditEvent`, not in `AuditLogRepository.insert`. Zero tests
cover this consumer (grep for queue/consumer symbols in `*.test.ts` = none).
Latent today (queue has no producers), but the append-only/never-deleted store
makes any future leak unremediable. **Fix:** move the recursive PHI sanitizer
into `AuditLogRepository.insert` (single choke point) and add a consumer test
mirroring V-AUD-NEW-A. Not autofixable.

### CONF-AUD-002 (P2) — Consumer silent-drop of malformed events is untested
`consumers/domain-events.consumer.ts:34` returns early on any missing required
field with no log/metric/DLQ — and no test asserts observability. **Fix:** add a
test asserting a malformed event produces a warn log + failure metric; then
implement. Not autofixable.

### CONF-AUD-003 (P2) — Pagination determinism untested (`desc(timestamp)` no tie-break)
`repos/audit-log.repo.ts:54`. Same-tick rows can be skipped/duplicated across
pages; no test exercises this. **Fix:** test inserting same-`timestamp` rows
across a page boundary, then `orderBy(desc(timestamp), desc(id))`. Autofixable.

### CONF-AUD-004 (P2) — In-memory count path untested and unbenchmarked vs <2s NFR
`repos/audit-log.repo.ts:57-63` selects all matching ids and counts in JS. No
test asserts `total` correctness independent of page size at scale. **Fix:**
SQL `count(*)`; add a test asserting `total` > page size. Autofixable.

### CONF-AUD-005 (P3) — GET route registration not verified end-to-end
`app.ts:206-208` registers GET → `getAuditEvents`, but handler tests use an
inline `buildTestApp()`, so real-app GET routing is unproven (the 405 guards
ARE real-app tested). **Fix:** add one real-app (`createApp(parseConfig())`)
GET test, mirroring `audit-append-only.test.ts`. Not autofixable.

## What's next
- Close CONF-AUD-001 before any module wires `publishAuditEvent`.
- Add the 3 missing test owners (consumer, pagination, count) → re-run `--confidence --layer 2`.
- Replace the CI build stub with a real `bun run build` and add a dependency-audit step to lift L4.
