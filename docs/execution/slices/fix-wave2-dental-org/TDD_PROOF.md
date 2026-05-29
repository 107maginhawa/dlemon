# TDD_PROOF — Wave 2 dental-org P1 Structural Fixes

<!-- Wave: Wave 2 | Module: dental-org | Date: 2026-05-29 -->

## EF-ORG-006: verifyPin tests — canonical handler imports

### RED → GREEN

These tests were already passing against the legacy alias files. The RED→GREEN
cycle here is about test correctness, not behavioral change:

**RED (before):** Tests imported from `verifyPin.ts` (alias), which could
silently diverge from the production code path. Any audit call added to
`DentalMembershipManagement_verifyPin.ts` but not to `verifyPin.ts` would be
invisible to the test.

**GREEN (after):** Tests import from `DentalMembershipManagement_verifyPin.ts`
— the exact file the registry registers in the real server.

### Test Results

```
bun test src/handlers/dental-org/verifyPin.test.ts
DATABASE_URL=postgres://postgres:password@localhost:5432/monobase_test

 12 pass
  0 fail
 25 expect() calls
Ran 12 tests across 1 file. [1362.00ms]
```

### Coverage after fix

| File | % Funcs | % Lines |
|------|---------|---------|
| `DentalMembershipManagement_verifyPin.ts` | 100.00 | 91.38 |
| `DentalMembershipManagement_setPin.ts` | 100.00 | 95.00 |

(Previously these files had 0% coverage from `verifyPin.test.ts` — coverage
was on the legacy aliases only.)

### Tests covered

| Test | Handler | Assertion |
|------|---------|-----------|
| returns 401 when unauthenticated | verifyPin | `status === 401` |
| returns 404 when member not found | verifyPin | `status === 404` |
| returns 200 with success=false when no PIN set | verifyPin | `body.success === false` |
| returns 200 with success=true when correct PIN | verifyPin | `body.success === true`, `failedAttempts === 0` |
| returns 200 with success=false + incremented failedAttempts on wrong PIN | verifyPin | `body.success === false`, `failedAttempts === 1` |
| returns 429 when member is locked out (5 attempts) | verifyPin | `status === 429`, `body.lockedUntil` not null |
| FR9.3: returns 429 with 5-min lockout after 10 attempts | verifyPin | `status === 429`, lockout > 4 min in future |
| resets failed attempts on successful PIN verification | verifyPin | `body.success === true`, `failedAttempts === 0` |
| returns 401 when unauthenticated (setPin) | setPin | `status === 401` |
| returns 404 when member not found (setPin) | setPin | `status === 404` |
| sets PIN and returns updated membership | setPin | `status === 200`, `body.pinHash === undefined` |
| allows PIN verification after setPin | setPin + verifyPin | `status === 200`, `body.success === true` |

---

## EF-ORG-007: org membership guard — DentalOrganizationManagement_get

### Guard verification

The guard was pre-existing. Verification test results:

```
bun test src/handlers/dental-org/dental-org-auth-p0.test.ts
DATABASE_URL=postgres://postgres:password@localhost:5432/monobase_test

 19 pass
  0 fail
 21 expect() calls
```

EM-ORG-006 describe block passes:

| Test | Expected | Actual |
|------|----------|--------|
| non-member reads foreign org → 403 | 403 | 403 PASS |
| org owner reads own org → 200 | 200 | 200 PASS |
| org member reads own org → 200 | 200 | 200 PASS |
| unauthenticated read org → 401 | 401 | 401 PASS |

---

## EF-ORG-009: legacy duplicate deletion

### Safety verification

```bash
# Zero remaining imports of deleted files:
grep -rn "from.*dental-org/verifyPin\|from.*dental-org/setPin" \
  services/api-ts/src --include="*.ts"
# (no output)
```

### Full suite after deletion

```
bun test src/handlers/dental-org/
DATABASE_URL=postgres://postgres:password@localhost:5432/monobase_test

 211 pass
   0 fail
 402 expect() calls
Ran 211 tests across 22 files. [6.96s]
```

---

## Summary

| Finding | Status | Tests passing |
|---------|--------|--------------|
| EF-ORG-006 | FIXED | 12/12 |
| EF-ORG-007 | CONFIRMED RESOLVED | 4/4 (EM-ORG-006 block) |
| EF-ORG-008 | BLOCKED (F2 sprint) | n/a |
| EF-ORG-009 | FIXED | 211/211 (suite) |

**Commit:** `f81f9c0c` — `fix(dental-org): EF-ORG-006 + EF-ORG-009 — canonical handler imports + remove legacy duplicates`
