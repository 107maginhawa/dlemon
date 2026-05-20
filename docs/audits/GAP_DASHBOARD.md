# Dentalemon — Coverage Gap Dashboard

**Generated:** 2026-05-12  
**Branch:** `feat/v1.4-clinical-imaging`  
**Source:** `docs/audits/TRACEABILITY_MATRIX.md` (hand-maintained) + `bun run audit:trace`

---

## Table 1: Module Health Scorecard

> Risk legend: 🟢 Low (≥70% E2E) · 🟡 Medium (20–70% E2E or 1+ untested BR) · 🔴 High (0 E2E or P0 BR untested)

| Module | BRs | BR Coverage | Routes | E2E% | Contract% | Risk |
|--------|-----|-------------|--------|------|-----------|------|
| dental-visit | 5 | 3/5 (BR-001⚠️ BR-002⚠️ BR-003⚠️ BR-004✅ BR-005🚫) | 33 | 24% | 100% | 🟡 |
| dental-billing | 5 | 5/5 (BR-009✅ BR-010✅ BR-011✅ BR-012✅ BR-013🚫) | 14 | 14% | 100% | 🟡 |
| dental-imaging | 13 | 4/13 (BR-026✅ BR-027✅ BR-033✅ BR-034✅; 7⚠️ 1❌) | 8 | 38% | 100% | 🔴 |
| dental-clinical | 2 | 1/2 (BR-014✅ BR-019⚠️) | 10 | 0% | 100% | 🔴 |
| dental-scheduling | 0 | — | 6 | 17% | 100% | 🟡 |
| dental-patient | 2 | 1/2 (BR-015✅ BR-016✅) | 16 | 6% | 100% | 🟡 |
| dental-org | 1 | 1/1 (BR-016✅) | 6 | 83% | 100% | 🟢 |
| dental-pmd | 2 | 2/2 (BR-021✅ BR-022✅) | 3 | 33% | 100% | 🟡 |

**Highest-risk modules**: `dental-clinical` (0% E2E, BR-019 now unit-covered but no E2E) and `dental-imaging` (BR-023–BR-029 now tagged, BR-030/BR-031/BR-035 still fully untested).

---

## Table 2: Journey Coverage

> Steps covered = at least one E2E test exercises that step.

| Persona | Role | Journeys | Steps | Covered | Coverage% | Worst Gap |
|---------|------|----------|-------|---------|-----------|-----------|
| Alex | Dentist Owner | 3 | 13 | 7 | 54% | Prescription submit (J1.6), Collections view (J3.3) |
| Jordan | Associate Dentist | 3 | 8 | 3 | 38% | Rx form fill+submit (J2.2–2.3) |
| Sam | Front Desk | 2 | 7 | 3 | 43% | Consent signing (J1.4) |
| Riley | Scheduler | 3 | 6 | 0 | 0% | Everything — no E2E for edit/cancel appointment |
| Morgan | Billing Manager | 3 | 7 | 0 | 0% | Billing review queue, void, uncollectible |
| Taylor | Patient | 3 | 5 | 1 | 20% | Pay online, view invoice |
| Pat | Specialist | 2 | 4 | 0 | 0% | Referral send (API only, no frontend E2E) |

**Zero-coverage personas**: Riley (scheduling), Morgan (billing management), Pat (referrals).

---

## Table 3: Top 15 Tests to Write — Sprint Planner

> Effort: S = <1h · M = 1–3h · L = 3–8h

| # | Priority | Test File | Type | Effort | BRs/ACs Closed | Notes |
|---|----------|-----------|------|--------|----------------|-------|
| 1 | P0 | `e2e/consent-signing.spec.ts` *(new)* | E2E | M | AC-MED-03, BR-014 | Sign → verify immutable re-open. Flake: sheet animation — use `waitForSelector` |
| 2 | P0 | `e2e/prescribe-medication.spec.ts` *(extend)* | E2E | M | AC-RX-01, BR-017 | Fill drug/dosage/frequency → submit → verify list. Already has workspace-loads test |
| 3 | P0 | `e2e/safety-floor.spec.ts` *(new)* | E2E | M | AC-MED-02 | Allergy → workspace → red badge in top bar. Flake: force-refresh if workspace caches |
| 4 | P1 | `e2e/workspace-readonly.spec.ts` *(new)* | E2E | S | AC-VISIT-02, BR-003 | Complete visit → re-navigate → no edit buttons, footer "View Invoice" |
| 5 | P1 | `e2e/action-contracts.spec.ts` *(extend)* | E2E | S | AC-CHART (core) | Slideout → condition → save → treatment row appears in table |
| 6 | P1 | `e2e/payment-plan.spec.ts` *(extend)* | E2E | M | AC-PAY-03, BR-011 | Invoice → partial → attempt void → verify error |
| 7 | P1 | `business-rules.test.ts` *(fill skip)* | Backend | S | BR-019 | Unskip treatment amendment test; assert append-only behaviour |
| 8 | P2 | `imaging.test.ts` *(add BR tags)* | Backend | S | BR-023 to BR-029 | Add `// @BR-NNN` to 8 existing describe blocks — zero new logic, full traceability |
| 9 | P2 | `e2e/calendar.spec.ts` *(extend)* | E2E | S | AC-SCHED-04 | Cancel appointment → status=cancelled, slot freed |
| 10 | P2 | `e2e/calendar.spec.ts` *(extend)* | E2E | S | AC-SCHED-02 | Edit appointment → verify calendar updated |
| 11 | P2 | `e2e/pmd-import.spec.ts` *(new)* | E2E | M | AC-PMD-03 | Import external PMD → stored, linked, history |
| 12 | P2 | `e2e/attachments.spec.ts` *(new or extend)* | E2E | M | AC-ATTACH-01, AC-ATTACH-02 | Upload → listed; view filename/type/date |
| 13 | P2 | `treatment-table.test.ts` *(fill skip)* | Frontend | S | BR-008, AC-TXPLAN-02 | Unskip carried-over treatments visual indicator test |
| 14 | P2 | `e2e/billing-queue.spec.ts` *(new)* | E2E | L | Morgan journey (all 3 steps) | Billing review queue, void invoice, mark uncollectible |
| 15 | P2 | `e2e/calendar.spec.ts` *(extend)* | E2E | S | AC-SCHED-01 (full create) | Full create-appointment → verify slot occupied |

**Sprint suggestion**: Items 1–6 in one sprint closes all P0 gaps and the top P1 gaps. Estimated total: ~12h.

---

## Table 4: Placeholder Tests Waiting (`test.skip` / `describe.skip`)

> These are captured intents — skeleton exists, needs implementation.

| File | Line | Tag | Description | Status |
|------|------|-----|-------------|--------|
| `services/api-ts/src/handlers/business-rules.test.ts` | 1375 | BR-019 | `[BR-019] treatment amendments require supervisor approval` | **Fill** — unskip + implement |
| `apps/dentalemon/src/features/workspace/components/treatment-table.test.ts` | 177 | BR-008 | `[BR-008] renders carried-over treatments marked as carried_over` | **Fill** — unskip + implement |
| `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.test.ts` | 168 | PAY-01 | `creates invoice when "Create Invoice" clicked` | **Fill** — unskip + implement |
| `apps/dentalemon/tests/e2e/imaging-comparison.spec.ts` | 245 | — | Needs ≥2 images in test harness to verify comparison | **Unblock** — seed 2nd image in fixture |
| `services/api-ts/src/handlers/business-rules.test.ts` | 1524 | BR-005 | `BR-005: auto-discard draft visits` | **Skip** — NOT IMPLEMENTED (deferred v1.3) |
| `services/api-ts/src/handlers/business-rules.test.ts` | 1531 | BR-013 | `BR-013: markInvoiceUncollectible` | **Skip** — NOT IMPLEMENTED (deferred v1.2) |
| `services/api-ts/src/handlers/business-rules.test.ts` | 1538 | BR-020 | `BR-020: patient merge/unmerge` | **Skip** — NOT IMPLEMENTED (deferred v2.0) |

**Actionable now**: BR-019 (item 7 in sprint planner), BR-008 (item 13), PAY-01 (extend payment modal tests).  
**Leave skipped**: BR-005, BR-013, BR-020 — feature not yet implemented.

---

## Phase 4 Results (2026-05-12)

**Script output**: `bun run audit:trace` → 35 BRs, 40 ACs · **6 fully covered · 25 unit-only · 3 untested**

| Item | Status | Detail |
|------|--------|--------|
| Sprint 3 items 7, 8, 13 completed | ✅ | BR-019 backend tests added; imaging BR-023–BR-029 tagged; BR-008 backend tests added |
| BR-008 | ⏸️ → ⚠️ | `dental-treatment.test.ts` now has `describe('BR-008')` |
| BR-019 | ⏸️ → ⚠️ | `clinical-attachment-amendment.test.ts` now has `describe('BR-019')` |
| BR-023/025/028/029 | explicit tags | `imaging.test.ts` @BR-NNN tags added Phase 4 |
| BR-024 | 🚫 → ⚠️ | `imaging.test.ts` @BR-024 tags added (calibration + tier gate tests) |
| Remaining P0 gaps | unchanged | No new E2E; BR-002/BR-016 E2E still missing |

---

## Summary: Path to 70% AC Coverage

Current: 17/40 ACs covered (43%). Target: 28/40 (70%).

| Sprint | Items | ACs Closed | New AC% |
|--------|-------|-----------|---------|
| Sprint 1 (P0+P1) | #1–7 above | +5 ACs | ~55% |
| Sprint 2 (P2 fills) | #8–13 | +5 ACs | ~68% |
| Sprint 3 (Morgan+Riley) | #14–15 | +3 ACs | ~75% |
