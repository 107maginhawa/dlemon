# Plan: Raise Test Confidence 8 → 9/10

**Branch:** feat/v1.4-clinical-imaging  
**Date:** 2026-05-19  
**Baseline:** Overall 8/10 (L1=8 L2=8 L3=8 L4=8)  
**Target:** Overall 9/10 (min of all layers ≥ 9)

---

## Why Each Layer Must Hit 9

Overall = min(L1, L2, L3, L4). Every layer must reach 9 independently.

| Layer | Current | Formula Score | Gap | Blocker |
|-------|---------|---------------|-----|---------|
| L1 Coverage Integrity | 8 | 8.40 | +0.60 | API error paths, auth gate E2E |
| L2 Behavior Traceability | 8 | 84/100 = 84% | +7 behaviors | CIMG tags, untested ACs |
| L3 Test Quality | 8 | 8.70 | +0.30 | 455 weak assertions |
| L4 Release Gate | 8 | 8.46 | +0.74 | No release workflow, security advisory |

---

## Task Breakdown

### Task 1 — L4: Release workflow + security gate (8.46 → 9.4)

**Effort:** ~2h  
**Impact:** +0.93 to L4 formula — alone pushes L4 to 9.

- Add `.github/workflows/release.yml`: on push of `v*` tag → `bun run build` + create GitHub Release
- Removes the "no release workflow" gap (version-mgmt subscore 6.67 → 10, saves +0.67)
- Triage `bun audit` output → document accepted advisories in `docs/audits/SECURITY_ADVISORIES.md`
- Remove `continue-on-error: true` from `quality.yml:security` (CI subscore 9.3 → 10, saves +0.245)

New L4: (10×0.35) + (7.5×0.25) + (10×0.20) + (10×0.20) = 3.50 + 1.875 + 2.00 + 2.00 = **9.375 → 9/10** ✅

### Task 2 — L2a: CIMG tags + AC-PAY-03 (quick wins, +4 behaviors)

**Effort:** ~1h  
**Impact:** 84 → 88 behaviors traced.

- Open `services/api-ts/src/handlers/dental-imaging/ceph.test.ts`
- Identify the 3 test blocks covering CIMG-009, CIMG-010, CIMG-012 (v1.4 extended rules)
- Add `// @CIMG-009`, `// @CIMG-010`, `// @CIMG-012` inline tags (+3 behaviors)
- Add AC-PAY-03 test in `apps/dentalemon/tests/e2e/invoice-detail.spec.ts`:
  create invoice → issue → create payment plan → attempt void → expect 4xx (+1 behavior)

### Task 3 — L2b: Profile + Report E2E tests (+3 behaviors → 91%)

**Effort:** ~3h  
**Impact:** 88 → 91 behaviors, crosses 91% → L2 9/10.

New spec: `apps/dentalemon/tests/e2e/patient-profile.spec.ts`
- AC-PROF-01: navigate to `/patients/:id` → expect profile fields visible
- AC-PROF-02: click "Open workspace" from profile → expect workspace route load

Extend `apps/dentalemon/tests/e2e/reporting.spec.ts` (or create new):
- AC-REPORT-01: navigate to `/reports/daily` → expect report page loads without 500

All three use `setupDentalOrg` + `createDentalPatient` from `fixtures.ts`.

### Task 4 — L1: Auth gate E2E + API error-path coverage (8.40 → 9.2)

**Effort:** ~4h  
**Impact:** auth gate 80%→90% (+0.35), API routes 75%→85% (+0.225), state guard (+0.15)

- **BR-016 E2E**: Create a patient via API as org member, then navigate to workspace WITHOUT setting `currentBranchId` localStorage → expect redirect or 403 response on API calls.
- **BR-026 E2E**: Upload an image as dentist_owner → DELETE works; attempt delete as a non-authorized role → expect 403/422. (API-level test via `page.evaluate(fetch)`)
- **API error paths** (5 endpoints): add 4xx assertions for:
  - `POST /dental/billing/invoices` with missing `visitId` → 4xx
  - `PATCH /dental/visits/:id` with invalid status → 422
  - `POST /dental/appointments` with missing `patientId` → 4xx
  - `GET /dental/patients?branchId=nonexistent` → 404 or empty
  - `POST /dental/visits/:id/prescriptions` with invalid frequency → 4xx
- **Lab guard**: Add test that `PATCH /dental/lab-orders/:id` with `status: 'ordered'` from `in_progress` returns 422.

New L1: auth 90%×0.35 + br 94%×0.30 + state 90%×0.20 + api 85%×0.15
= 3.15 + 2.82 + 1.80 + 1.275 = **9.045 → 9/10** ✅

### Task 5 — L3: Reduce weak assertions (8.70 → 9.2)

**Effort:** ~3h  
**Impact:** 455 weak → ~150 weak; assertion strength 87.6% → 95.9%; L3 formula 8.70 → 9.2.

Strategy: grep for `toBeTruthy()` and `toBeDefined()` in test files, replace with specific value assertions where the tested value is knowable. Skip cases where the assertion is on an opaque generated ID (those are genuinely unknowable and belong as `toBeTruthy()`).

Priority targets (most weak assertions per file):
1. `apps/dentalemon/tests/e2e/` — `expect(result.planId).toBeTruthy()` → `toMatch(/^[0-9a-f-]{36}$/)` or `expect.any(String)` in `toMatchObject`
2. `services/api-ts/src/handlers/business-rules.test.ts` — check for loose truthiness on status fields
3. Frontend unit tests — check for `toBeDefined()` on rendered elements that have known content

**Do NOT change:**
- `expect(visitId).toBeTruthy()` where `visitId` is a server-generated UUID (fine as-is)
- E2E guard checks `if (!result) return` (skip pattern, not assertion)

New L3: (95.9%×0.40) + (8.5×0.20) + (9.5×0.20) + (8.0×0.20)
= 3.84 + 1.70 + 1.90 + 1.60 = **9.04 → 9/10** ✅

---

## Sequencing

```
Task 2 (quick wins, 1h)
  └─ Task 3 (profile+report E2E, 3h)   ← L2 complete at 91%
Task 1 (release workflow, 2h)           ← L4 complete at 9.4
  └─ Task 4 (auth+error-path, 4h)      ← L1 complete at 9.0
Task 5 (weak assertions, 3h)            ← L3 complete at 9.2
```

Tasks 1, 2, 5 can run in parallel. Tasks 3 and 4 can start after 2 and 1 respectively.

**Total estimated effort:** ~13h (~2 dev days)

---

## Verification

After all 5 tasks, run:
```bash
bun test src/                          # 0 fail, line ≥ 80%
bun run audit:trace:ci                 # exits 0
bun run typecheck && bun run lint      # exits 0
/oli-confidence-stack check dentalemon app  # expect ≥ 9/10
```
