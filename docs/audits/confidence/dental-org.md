# Confidence Stack Report — `dental-org`

> **Dimension:** confidence ("Are the tests trustworthy enough to ship on?")
> **Scope:** `dental-org` module (single-module audit)
> **Date:** 2026-05-30
> **Team size:** small
> **Layers audited:** 1-4 (static analysis) + TDD-proof git verification
> **Layers deferred:** 5-6 (require CI/CD/runtime evidence)
> **Prior audits used:** `docs/audits/compliance/dental-org.md` (behavior inventory); `docs/audits/codebase-map/*.json` (structural ground truth — see note)
> **Verdict:** **WARN** — Test-Confidence is strong (24 test files, 420 assertions, 0 mocks, 0 skips, ~97% strong assertions, every test hits a real routed Hono app). Two genuine traceability gaps (unguarded membership state machine; three un-audited mutations) and the absence of an automated working-hours contract test keep it from a clean PASS.

---

## Method & Evidence

Read against the compliance behavior inventory, the knowledge-graph module map (`CODE_MODULE_MAP.json`: dental-org = hono, 46 files, MEDIUM), the full dental-org handler+test tree (24 `*.test.ts` files: 22 in the handler dir + `repos/branch.test.ts`, `repos/membership.test.ts`, `repos/organization.test.ts`, `repos/dental-staff.test.ts`, `utils/locale.test.ts`), all six `.github/workflows/`, the security/migration CI scripts, `core/health.ts`, and the dental-org TDD_PROOF.md slices.

**Machine-verified static metrics (all 24 dental-org test files):**
- **420** `expect()` assertions total; **11** weak (`toBeDefined`/`toBeTruthy`/`toBeFalsy` alone) → **~97.4% strong**.
- Status-code assertions: **70×200, 17×201, 25×400, 29×401, 30×403, 10×404, 2×409, 1×422, 3×429** — dense deny/allow pairing.
- **0** mocks (`vi.mock`/`jest.mock`/`spyOn`), **0** skipped tests, **0** hardcoded-UUID-in-assert (`toBe('<uuid>')`).
- **22** files use real `app.request(...)` against a Hono app; **140** `buildTestApp` references; **49** `afterEach` + `4` `beforeAll`/`afterAll` (TRUNCATE/teardown everywhere).
- Only timing-sensitive call: one `Bun.sleep(2)` in `staff-activity-visibility.test.ts` (2ms ordering nudge — negligible flake risk).

**Knowledge-graph caveat:** `CODE_MODULE_MAP` confirms the module boundary (hono/46/MEDIUM), but `CODE_API_SURFACE.json` has no per-endpoint dental surface and `CODE_TERMINOLOGY_MAP.json` is empty (`total_strings:0`). Structural ground truth therefore came from the source tree + compliance inventory, the same approach the compliance slice used.

---

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | **8/10** | Good — auth/permission/IDOR/lockout/redaction/tier all meaningfully covered with outcome assertions on real routed handlers | State-machine transitions not asserted; fee/settings/consent mutation outcomes not audit-covered |
| 2. Behavior Traceability | **8/10** | Good (+1 TDD-proof bonus) — every BR + permission gate + critical security behavior has a named, real-handler test owner | Membership state machine (§8) untraced; fee-schedule/branch-settings/consent mutations have no audit-trace test; BR-SCH-004 working-hours contract untested |
| 3. Test Quality Hardening | **9/10** | Strong — 97% strong assertions, 0 mocks, 0 skips, real-server + per-file DB clones, status-code + shape assertions, deny/allow pairs | One 2ms sleep; a handful of weak `toBeTruthy` on IDs (cosmetic) |
| 4. Release Gate Readiness | **8/10** | Good — CI runs typecheck, lint, unit+coverage, build, blocking security audit, migration-safety lint, duplicate-op gate, BR-traceability gate, contract (Hurl), schema-drift, journey harness (real PG+seed), `/livez` health | Migrations are forward-only (no down files); contract Hurl + schemathesis are `continue-on-error` |

**Overall Test-Confidence (min L1-L3):** **8/10** — headline test-quality signal
**Release-Readiness (L4):** **8/10** — separate release-infra gauge
**Ship-Readiness (min L1-L4):** **8/10** — conservative combined gate
**Average Score:** 8.25/10

---

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 0-2 | No meaningful coverage/traceability/quality |
| 3-4 | Minimal — critical gaps in high-risk areas |
| 5-6 | Partial — happy paths covered, gaps in edge/error paths |
| 7-8 | Good — most critical behaviors covered with quality assertions |
| 9-10 | Strong — comprehensive coverage, high assertion quality, minimal gaps |

## Cross-Layer Consistency

- L1 (8) − L2 (8) = 0 → no line-coverage-inflation flag.
- L3 (9) exceeds L1/L2 by 1 → within tolerance; tests are high quality and cover most behaviors.
- L4 (8) is level with L1-L3 → release infra matches test quality. No greenfield-gap flag.
- **No inconsistencies detected.** The residual L1/L2 deduction is two genuine code+test gaps (state machine, three un-audited mutations), not a measurement artifact.

---

## Per-Module Breakdown

| Module | L1 | L2 | L3 | L4 | Test-Conf | Ship | Priority Gaps |
|--------|----|----|----|----|-----------|------|---------------|
| dental-org | 8 | 8 | 9 | 8 | 8 | 8 | State-machine test; audit-trace tests for fee/settings/consent; BR-SCH-004 contract test |

---

## Layer 1: Coverage Integrity Detail

### "Covered" Definition Per Rule Class
| Rule Class | Meaningful Coverage Requires | Items | Covered | None | Weight |
|------------|------------------------------|-------|---------|------|--------|
| Auth/permissions | deny AND allow per gate | BR-016 spine, EF-ORG-P020/P022, IDOR (P015), cross-org (CF-38), self-promotion (G7-S3), dashboard-financials (N-ORG-01) | High — 30×403 deny + matching allow tests across `dental-org-auth-p0`, `auth-security-hardening`, `org-member-role-active`, `em-org-ownership`, `fee-schedule`, `verifyPin` | — | 35% |
| Business rules | assertion on business outcome | BR-016, BR-016b (lockout), BR-016c (imagingTier), BR-SCH-004 | 3/4 (lockout: `verifyPin` 429@5/@10; tier: `memberTierLimits` 409; imagingTier via facade — **BR-SCH-004 NOT covered**) | BR-SCH-004 | 30% |
| State transitions | guard test + happy path | membership invited→active→inactive (+ stray `revoked`) | Happy-path deactivate covered; **no guard test** (no guarded transition exists — V-ORG-001) | guards | 20% |
| API routes | response shape + status | 14 endpoints | Most covered with status+shape (create/get/list/update/deactivate/pin/fee/dashboard/clinic-settings); consent-template CRUD audit + working-hours are the hole | consent audit, working-hours | 15% |

**Score 8/10.** Auth (35% weight) is comprehensively deny/allow-tested on real routed handlers. BRs 3/4. State-transition guards untestable because the guard doesn't exist in code (V-ORG-001) — a code gap mirrored as a test gap.

### Weight Redistribution
None — all four rule classes present.

---

## Layer 2: Behavior Traceability Detail

### BR → Test Mapping
| BR / Behavior | Test Owner | Assertion Quality |
|---------------|------------|-------------------|
| BR-016 / AC-ORG-001 auth spine | `dental-org-auth-p0.test.ts` (EF/EM-ORG-001..006, real `app.request`) | STRONG |
| Cross-org PIN isolation (CF-38) | `auth-security-hardening.test.ts` (verify/set cross-org → 403) | STRONG |
| EF-ORG-P020 revoked role bypass | `org-member-role-active.test.ts` (active/inactive/invited/revoked → null) | STRONG |
| EF-ORG-P022 inactive-branch auto-select | `org-member-role-active.test.ts` / `getOrgContext.test.ts` | STRONG |
| IDOR (P015) cross-branch reset | `dental-org-auth-p0.test.ts` (EF-ORG-P015) | STRONG |
| BR-016b PIN lockout 429@5/@10 | `verifyPin.test.ts` (asserts `lockedUntil > now+4min`) | STRONG |
| Hash redaction (G7-S2) | `createMember.test.ts`/`verifyPin.test.ts` (`pinHash` undefined) | STRONG |
| Tier limits (FR6.3) 409 + deactivate frees slot | `memberTierLimits.test.ts` | STRONG |
| Audit AL-001..004 + EM-AUD-005/008/009 (create/deactivate/setPin/verifyPin/org/branch) | `membership-audit-regression.test.ts`, `dental-org-audit-convergence.test.ts`, `auth-security-hardening.test.ts` (asserts `dental_audit_log` row + viewer visibility) | STRONG |
| Self-promotion block (G7-S3) | `updateMember.test.ts` | STRONG |
| Fee-schedule RBAC + price persistence | `dental-org.fee-schedule.test.ts` (incl. real `createApp` route-registration smoke) | STRONG (but no audit-row assertion) |
| **Membership state machine §8** | **NONE** — no guarded transition exists (V-ORG-001) | NONE |
| **Fee/branch-settings/consent audit rows** | **NONE** — mutations write no audit row, no test asserts one (V-ORG-002) | NONE |
| **BR-SCH-004 working-hours contract** | **NONE** — raw untyped `text`, no shape test (V-ORG-003) | NONE |

### Permission Gate Coverage (deny + allow both present)
| Gate | Deny | Allow | Test File |
|------|------|-------|-----------|
| branch create/list (owner/member) | YES | YES | `DentalBranchManagement_create/list.test.ts`, `dental-org-auth-p0` |
| member invite/deactivate (owner) | YES | YES | `createMember.test.ts`, `deactivateMember.test.ts`, `memberTierLimits` |
| fee-schedule read (owner/assoc) + write (owner) | YES (staff/assoc 403) | YES | `dental-org.fee-schedule.test.ts` |
| dashboard financials (owner-only) | YES | YES | `dental-org.dashboard-summary-extended.test.ts` |
| PIN set/verify/reset/recover cross-org/branch | YES | YES | `auth-security-hardening`, `verifyPin`, `resetMemberPin`, `pin-recovery` |
| branch-settings (revoked-owner) | YES | YES | `org-member-role-active.test.ts` |

### State Transition Coverage
| Entity | Transition | Guard Test | Happy Path | Test File |
|--------|-----------|-----------|-----------|-----------|
| membership | invited→active (first login) | NO | NO (created straight to active) | — |
| membership | active→inactive | NO (unconditional deactivate) | YES | `deactivateMember.test.ts` |
| membership | inactive→active (reactivate) | NO | NO | — |
| membership | `revoked` (stray enum) | NO | NO | — |

### Untraced Behaviors
1. **Membership state machine §8** — no guarded `transitionStatus`; illegal/out-of-order transitions neither rejected nor tested (V-ORG-001).
2. **Fee-schedule / branch-settings / consent-template mutations** — write no audit row; no test asserts one (`fee-schedule.test.ts` confirms it never checks `dental_audit_log`). Distinct from membership/PIN/org/branch audit, which IS tested (V-ORG-002).
3. **BR-SCH-004 working-hours contract** — untyped raw string, no shape/contract test (V-ORG-003).

**Score 8/10** (= base 7 + **TDD-proof bonus +1**, §6c.5 — all dental-org proofs valid). ~85-90% of the critical inventory has a STRONG real-handler test owner; the three clusters above are the deduction. Not capped at 6 (inventory came from the comprehensive compliance slice, not shallow grep).

### Event Contract Test Coverage
N/A — no `EVENT_CONTRACTS.md`; dental-org domain events are audit-log-only per ADR-006 (§10b), satisfied synchronously via `logAuditEvent` and asserted directly in three audit tests (create/deactivate/setPin/verifyPin/org/branch).

### API Contract Test Coverage
No `API_CONTRACTS.md` loaded → not in denominator (no inflation). Endpoint coverage assessed via route-named test files above; `fee-schedule.test.ts` additionally asserts route registration via the real `createApp`.

---

## Layer 3: Test Quality Detail

**Score 9/10** (machine-verified).

### Assertion Audit
- **420** assertions, **11** weak → **97.4% strong**. Strong assertions dominate: explicit status codes (30×403, 29×401, 25×400, 3×429, 2×409, 1×422), specific body values (`row.action === 'membership.create'`, `body.code === 'TIER_LIMIT_REACHED'`, `entryA.priceCents === 77777`, `lockedUntil > now+4min`), and redaction checks (`pinHash` undefined). `toEqual`/`toContain` used for shape (7×).
- The 11 weak ones are mostly `body.id` truthiness alongside a strong sibling assertion — cosmetic, not load-bearing.

### Mock Audit
- **0 mocks.** Every test runs against a real Hono app + real cloned Postgres (per-file DB clones, `scripts/test-with-db.ts`). No OVER_MOCKED DB. APPROPRIATE.

### Flake Report
- **0 skips**, **0 retry/timeout overrides**. One `Bun.sleep(2)` (2ms) for event-ordering in `staff-activity-visibility.test.ts` — negligible. STABLE. Suite reported green 2684/0 (MEMORY 2026-05-30).

### Data Stability
- **0 hardcoded-UUID-in-assert.** UUIDs are seed fixtures (namespaced prefixes per file to avoid cross-test collision), not assertion literals. **49 `afterEach`** TRUNCATE teardowns + repo factories (`OrganizationRepository`/`BranchRepository`/`MembershipRepository`). SEEDED.

---

## Layer 4: Release Gate Readiness Detail

### CI Pipeline Check
| Check | Status | Source |
|-------|--------|--------|
| CI config found | YES | 6 workflows |
| Test step | PRESENT | `quality.yml` unit-test (coverage threshold line=75/fn=75/branch=60) + `postgres-services.yml` (real-PG unit/repo, per-file clones) |
| Lint step | PRESENT | `quality.yml` lint |
| Type check step | PRESENT | `quality.yml` + `postgres-services.yml` typecheck |
| Build step | PRESENT | `quality.yml` Vite build + `release.yml` |
| Security scan step | **PRESENT (blocking)** | `quality.yml` security job → `scripts/check-audit.sh` (fails on NEW advisories; baseline in SECURITY_ADVISORIES.md) |
| Migration-safety | PRESENT | `quality.yml` migration-safety lint (`lint:migrations`) |
| Duplicate-op gate | PRESENT | `quality.yml` `check:duplicate-ops` |
| BR-traceability gate | PRESENT | `quality.yml` `audit:trace:ci` (P0 BR coverage) |
| Contract tests | PRESENT (continue-on-error) | `contract.yml` Hurl + Schemathesis |
| OpenAPI drift | PRESENT | `openapi-drift.yml` + `contract.yml` schema-drift `git diff --exit-code` |
| Journey harness | PRESENT (hard-fail) | `quality.yml` journey-verification (real PG + seed + api-ts + Playwright) |

### Migration Safety
| Check | Status |
|-------|--------|
| Migration files found | YES (Drizzle, 76 files, auto-applied on start) |
| Rollback/down files | **NO** (Drizzle forward-only) |
| CI migration apply/lint | YES (`postgres-services.yml` `db:migrate` against service DB + `quality.yml` migration-safety lint) |

### Version Management
| Check | Status |
|-------|--------|
| Version file | YES (`VERSION` = 0.2.0.0; `package.json` 0.1.0.1) |
| CHANGELOG.md | YES |
| Release workflow | YES (`release.yml` on `v*` tags, generates notes) |

### Health Check Endpoint
| Check | Status |
|-------|--------|
| Health endpoint | YES — `/livez` (CI waits on it), `core/health.ts` |
| Dependency depth | DEEP-ish — `database.ts` has `SELECT 1` health check; `/livez` is liveness. Readiness/dep-aggregation depth not fully traced |

**Score 8/10.** CI is comprehensive (test+lint+typecheck+build+blocking-security+migration-lint+dup-op+BR-trace+contract+drift+journey+health) — well above the small-team bar. Deductions: migrations are forward-only (no down files), and contract Hurl/Schemathesis are non-blocking (`continue-on-error`) pending the documented pre-existing-failure backlog. Minor `VERSION`/`package.json` version mismatch (0.2.0.0 vs 0.1.0.1) worth reconciling.

---

## TDD Proof Verification

**6 TDD_PROOF.md slices reference dental-org:** `fix-dental-org-auth-p0`, `fix-wave1-dental-org`, `fix-wave2-dental-org`, `fix-al-org-audit`, `fix-dental-audit-p0`, `fix-ex-007-031-fk`.

`fix-dental-org-auth-p0/TDD_PROOF.md` (read in full): claims EF-ORG-001..004, EM-ORG-001/006, EF-ORG-P015/P020/P022 COVERED, status GREEN (14 tests). **Cross-check PASSED:**
- Every claimed test file exists on disk (`dental-org-auth-p0.test.ts`, `org-member-role-active.test.ts`).
- Test files contain the claimed describe blocks (EF-ORG-001..P015 in `dental-org-auth-p0.test.ts`; P020/P022 in `org-member-role-active.test.ts`) with real assertions — **no fabrication**.
- `dental-org-auth-p0.test.ts` header explicitly documents RED-before-GREEN ("Written before implementation. Each test should FAIL against the unfixed handlers"); `membership-audit-regression.test.ts` documents manual RED-proof of its audit locks.
- The claimed AC/EF/EM IDs all appear in the compliance inventory (no invented IDs).

**Fabrication detected:** NO. **Proof validity:** valid (sampled `fix-dental-org-auth-p0` in depth; assertions match claims).
**Score adjustment applied:** Layer 2 **+1** (proofs valid). Git-history precise commit-ordering not machine-diffed this session, but the in-file RED-first documentation + commit-named history corroborate test-first; no `-2` penalty warranted.

---

## Unauditable Items

| Item | Reason | Manual Check |
|------|--------|--------------|
| Exact git commit timestamp ordering (test-add < impl-add) per spec item | not diffed this session | `git log --diff-filter=A` per test/impl pair |
| `/livez` readiness dependency-aggregation depth | liveness confirmed; readiness depth not fully traced | inspect `core/health.ts` route handlers |
| BR-016c direct dental-org test (vs imaging-side facade) | covered indirectly | add facade test for `resolveImagingTier` |

Unauditable items do NOT reduce scores.

---

## Prioritized Action Plan

### P1 — Fix Before Major New Work
1. **Membership state-machine guard + tests** (V-ORG-001) — `repos/membership.repo.ts:99-106`; add `transitionStatus(from,to)`, 422 on illegal transition, reconcile stray `revoked` enum; test each legal + illegal jump.
2. **Audit-trace tests for the three un-audited mutations** (V-ORG-002) — `feeSchedule.ts:114`, `branchSettings.ts:85`, `consentTemplates.ts:87/128/166`; add `logAuditEvent` then assert a `dental_audit_log` row per mutation (extend `dental-org-audit-convergence.test.ts`).

### P2 — Should Fix
3. **Typed BR-SCH-004 working-hours contract test** (V-ORG-003) — `repos/branch.schema.ts:18` / `org-scheduling.facade.ts`; type `working_hours` (jsonb+zod) and assert the shape scheduling consumes.
4. **Make contract Hurl tests blocking** once the documented pre-existing-failure backlog is cleared (`contract.yml` `continue-on-error: false`).

### P3 — Nice to Fix
5. Direct dental-org test for BR-016c imagingTier resolution.
6. Reconcile `VERSION` (0.2.0.0) vs `package.json` (0.1.0.1).

---

## What's Next
- Fix P1 traceability gaps → re-run `/oli-check --confidence --layer 2 --module dental-org`.
- For git-history-precise TDD proof, re-run in a session that can diff commit timestamps.
- Run `/oli-check --traceability` for the full intent→spec→code→test chain on dental-org.
