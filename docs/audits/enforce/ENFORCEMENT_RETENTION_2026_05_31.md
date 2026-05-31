<!-- oli-version: 1.1 -->
<!-- based-on: docs/audits/enforce/.baseline.json (enforcement-2026-05-31 @ 2900d281) -->
<!-- generated: 2026-05-31 -->

# Enforcement Report — Incremental (retention module add)

**Generated:** 2026-05-31
**HEAD:** f1b38d864f5dffdd22260b035e816f261383886f
**Baseline compared:** enforcement-2026-05-31 @ git 2900d281
**Scope:** Targeted re-check triggered by new backend module `services/api-ts/src/handlers/retention`
**Authoritative gate:** `services/api-ts` → `bun run check:boundaries`

---

## Verdict: WARN (regression in authoritative gate)

The new `retention` module introduces **3 NEW alias cross-module repo reach-ins**, which the
authoritative `check:boundaries` gate flags. The baseline recorded `boundary_alias_violations: 0`
("Alias check:boundaries = 0 violations"). The gate is **no longer green** — this is a P1 regression
in the project's own boundary contract.

No P0s. No banned forbidden-tech imports. No new circular deps / type cycles introduced by the module.

---

## Authoritative gate result

```
$ bun run check:boundaries
⚠️ Cross-module repo boundary violations (3 total)
  [retention] — 3 violation(s):
    src/handlers/retention/retention-targets.ts:18  →  imports from dental-clinical/repos/
    src/handlers/retention/retention-targets.ts:19  →  imports from dental-visit/repos/
    src/handlers/retention/retention-targets.ts:20  →  imports from dental-org/repos/
```

Rule: `handlers/{A}/` must not import from `handlers/{B}/repos/` unless B=`shared`.
The checker matches `@/handlers/{B}/repos/` **alias** imports (the strict form), excludes `.facade.ts`
and `.test.ts`. These three are direct schema-table imports, not facade calls — true violations.

---

## Findings

### P1 (REGRESSION)

**EB-RETENTION-aliasreachins01** — retention — 3 alias cross-module repo reach-ins fail `check:boundaries`
- Files:
  - `services/api-ts/src/handlers/retention/retention-targets.ts:18` → `@/handlers/dental-clinical/repos/attachment.schema` (`dentalAttachments`)
  - `services/api-ts/src/handlers/retention/retention-targets.ts:19` → `@/handlers/dental-visit/repos/visit.schema` (`dentalVisits`)
  - `services/api-ts/src/handlers/retention/retention-targets.ts:20` → `@/handlers/dental-org/repos/branch.schema` (`dentalBranches`)
- Why it matters: the baseline's headline guarantee was `boundary_alias_violations: 0`. These are the
  strict alias form the gate is designed to catch — unlike the 54 known-deferred ESLint *relative*
  reach-ins (EB-BOUNDARY-reachins01), which the gate does NOT count. So this is a regression of the
  green gate, not an addition to the known-deferred warning bucket.
- Confidence: HIGH (authoritative project gate output).
- Action: expose a facade in each owning module returning only what the retention target needs — e.g.
  `dental-clinical/repos/attachment-retention.facade.ts` exporting `findArchivableAttachmentIds(db, scope)`
  and an `archiveAttachments(db, ids)` writer, then have `retention-targets.ts` import the facade. The
  checker already exempts `*.facade.ts`. This keeps the soft-archive logic in retention while removing
  the direct schema coupling. (Migration pattern: docs/development/ MODULE_BOUNDARIES.)

### Acceptable cross-module deps (verified, NO finding)

- `@/core/database`, `@/core/database.schema`, `@/core/database.repo`, `@/core/audit-logger`,
  `@/core/jobs` — all resolve to real `core/` cross-cutting infrastructure. The boundary rule governs
  only `handlers/{A}` → `handlers/{B}/repos`; `core/*` is not a handler module and is the legitimate
  shared-infra layer. Imports follow existing handler patterns (`logAuditEvent`, `DatabaseRepository`,
  `baseEntityFields`, `JobScheduler`/`JobContext`). PASS.
- `app.ts` wiring (`import { registerRetentionJobs } from '@/handlers/retention/jobs'`) — module-level
  public entry, not a repo reach-in. PASS.
- `scripts/seed-retention-policies.ts` — standalone script, outside `handlers/`, not boundary-governed.
- No forbidden-tech imports (express/prisma/axios/etc.). Drizzle + Hono + Zod stack only. PASS.

---

## Delta vs baseline (enforcement-2026-05-31)

| Metric | Baseline | This run | Δ |
|--------|----------|----------|---|
| boundary_alias_violations (check:boundaries) | 0 | 3 | +3 (REGRESSION) |
| P0 | 0 | 0 | 0 |
| P1 (code-level boundary) | 0 | 1 | +1 (EB-RETENTION-aliasreachins01) |
| Forbidden-tech imports | 0 | 0 | 0 |
| Circular deps / type cycles | 0 / 0 | 0 / 0 | 0 (module add introduced none) |

Dependency-CVE P1s (ED-GLOBAL-*), the 54 relative reach-ins (EB-BOUNDARY-reachins01), EMR facade
lint-drift (P3), and UI-spec (P3) are unchanged and carried forward from baseline — out of scope for
this incremental run and untouched by the retention add.

---

## Recommendation

Convert the 3 schema imports in `retention-targets.ts` to facade functions exposed by
dental-clinical / dental-visit / dental-org, then re-run `bun run check:boundaries` to restore the
0-violation green gate before merge. READ-ONLY run — no fix applied.
