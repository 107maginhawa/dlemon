# Traceability Report — run-6-strict-2026-05-29

**Run ID:** run-6-strict-2026-05-29  
**Date:** 2026-05-29  
**Baseline:** run-5 (12 orphan BRs, 3 orphan ops, 33 unspecced impls)

---

## Summary

| Metric | Count | vs run-5 |
|---|---|---|
| **P0 findings** | 0 | — |
| **P1 findings** | 11 | +8 new |
| **P2 findings** | 12 | +3 new |
| **P3 findings** | 0 | — |
| **Orphan BRs** | 6 | was 12* |
| **Orphan ops** | 4 | was 3 |
| **Unspecced impls** | 33 | same |
| **Dead specs** | 6 | new category |
| **New findings** | 11 | — |

*run-5 counted 12 using a broader definition (included WFG gaps); run-6 counts only BRs with no MODULE_SPEC coverage.

---

## Algorithm 5a — Orphan PRD BRs

BRs defined in WORKFLOW_MAP not referenced in any MODULE_SPEC, **or** explicitly flagged ORPHAN.

| ID | BR | Sev | Status | Description |
|---|---|---|---|---|
| TR-001 | BR-005 | P1 | KNOWN | Auto-discard empty visit — no enforcing code (ADR-010 deferred) |
| TR-002 | BR-013 | P1 | KNOWN | `markUncollectible` — implementation gap, no handler file exists |
| TR-003 | BR-019 | P1 | KNOWN | Supervisor amendment approval — not implemented |
| TR-004 | BR-020 | P1 | KNOWN | Patient merge — not implemented, cross-module cascade undocumented |
| TR-005 | BR-030 | P2 | NEW | Annotation SM end-rule (BR-023–BR-030 range) — imaging spec refs BR-023 only; BR-030 uncovered |
| TR-006 | BR-047 | P2 | NEW | Ceph analysis end-rule (BR-036–BR-047 range) — imaging spec refs BR-036 only; BR-047 uncovered |

**Notes:**
- BR-030 is the tail of the annotation state machine range. Imaging MODULE_SPEC cites `BR-023` and `BR-036` but not the full ranges.
- BR-047 is the tail of the cephalometric analysis rule range. Same gap.
- 22 remaining BRs (BR-001 to BR-023 excl. orphans, BR-036) are all referenced in at least one MODULE_SPEC.

---

## Algorithm 5b — Orphan WF Operations

WF operations defined in WORKFLOW_MAP with no handler implementation or where spec is misrouted.

| ID | WF | Sev | Status | Description |
|---|---|---|---|---|
| TR-007 | WF-047 | P1 | KNOWN | Auto-discard visit (BR-005) — deferred ADR-010; no pg-boss job or handler enforces this |
| TR-008 | WF-057 | P1 | KNOWN | Patient merge (BR-020) — not implemented in `dental-patient` handlers |
| TR-009 | WF-061 | P2 | KNOWN | Bulk slot generation (G-001) — pg-boss job not implemented |
| TR-010 | WF-042 | P2 | NEW | Perio charting — `dental-perio` MODULE_SPEC §4 lists WF-038 (clinical amendment) instead of WF-042; spec routing error |

**Notes:**
- WF-001/002/003 (auth) handled by Better-Auth — not orphans.
- WF-030/031 (ceph): handlers exist (`CephMgmt_*`, `batchUpsertCephLandmarks`, etc.) — NOT orphans.
- WF-042: `dental-perio` has 5 handler files (`createPerioChart`, `completePerioChart`, `upsertToothReading`, `getPerioChart`, `getVisitPerioChart`) but MODULE_SPEC §4 only references WF-038 (wrong entry, copied from dental-clinical).

---

## Algorithm 5c — Unspecced Implementations

Handler files in dental modules with no corresponding MODULE_SPEC reference.

| ID | Sev | Status | Description |
|---|---|---|---|
| TR-011 | P2 | KNOWN | 32 shim-prefix handler files (`CephMgmt_*` ×8, `ImagingMgmt_*` ×10, `ImagingFindingsMgmt_*` ×3, `PatientImageMgmt_*` ×1, `DentalBranchManagement_*` ×3, `DentalMembershipManagement_*` ×5, `DentalOrganizationManagement_*` ×3) — F7 structural remediation artefacts; all routed in `routes.ts` but not named in any MODULE_SPEC |
| TR-012 | P2 | KNOWN | ~170 additional dental handler files not explicitly named in MODULE_SPEC — specs document behavior via WF-NNN workflows, not handler filenames; gap is spec coverage style, not missing behavior |

**Count methodology:** MODULE_SPECs cover behavior via WF references. Only 11 of 216 dental handler filenames appear by name in specs. The 33 unspecced count from run-5 refers to the shim-handler set (32) plus 1 routing divergence.

---

## Algorithm 5d — Global Chain Breaks (PRD FR → spec AC → test → pass)

Sampled 10 FRs. Full chain traced: `FR → WF → MODULE_SPEC §11 AC → test file`.

| FR | WF | Module | Chain | Note |
|---|---|---|---|---|
| FR0.1–FR0.8 | — | — | **BROKEN** | Dashboard module: 8 FRs, no WF mapped, no MODULE_SPEC, no tests |
| FR1.4 | WF-009 | dental-visit | OK | Dental chart → AC-VIS-002/003 → tests exist |
| FR1.12 | WF-016 | dental-clinical | OK | Prescriptions → AC-CLI-001 → tests exist |
| FR1.19 | WF-030 | dental-imaging | OK | Ceph analysis → AC-IMG-001/003 → tests exist |
| FR2.1 | WF-005 | dental-patient | OK | Patient registration → AC-PAT-001 → tests exist |
| FR3.1 | WF-006 | dental-scheduling | OK | Appointment booking → AC-SCH-001 → tests exist |
| FR4.1 | WF-013 | dental-billing | OK | Create invoice → AC-BIL-001 → tests exist |
| FR6.1 | WF-004 | dental-org | OK | Staff invitation → spec WF-004 → tests exist |
| FR8.1 | WF-021 | dental-pmd | OK | Generate PMD → AC-PMD-001 → tests exist |
| FR9.1 | WF-042 | dental-perio | **BROKEN** | Perio charting → WF-042 not in dental-perio spec (only WF-038 listed) |

**Chain break findings:**

| ID | FR | Sev | Status | Description |
|---|---|---|---|---|
| TR-013 | FR0.1–FR0.8 | P1 | KNOWN | Dashboard (8 FRs, §6.0) — no WF assignment, no MODULE_SPEC section, no test coverage. Full chain broken. |
| TR-014 | FR9.1 | P2 | NEW | Perio FR → WF-042 → dental-perio MODULE_SPEC does not list WF-042 in §4. Spec routing error breaks trace. |

---

## Algorithm 5e — Dead Spec (AC exists, no test)

MODULE_SPEC §11 ACs with no behavioral test coverage found in handler test suite.

| ID | AC | Sev | Status | Description |
|---|---|---|---|---|
| TR-015 | AC-CLI-006 | P1 | NEW | Write to completed visit → 422 (BR-003): dental-clinical tests have no 422 or "completed" assertion |
| TR-016 | AC-IMG-002 | P1 | NEW | Annotation reversal confirmed→draft → 422 (SM-01): no test covers this transition reversal |
| TR-017 | AC-BIL-005 | P1 | KNOWN | `markUncollectible` → 501: no handler file, no test |
| TR-018 | AC-PMD-002 | P2 | NEW | PATCH imported PMD → 405 (BR-022): dental-pmd tests do not assert 405 on PATCH |
| TR-019 | AC-EMR-001 | P2 | NEW | PATCH/DELETE imported EMR → 405: no EMR test asserts 405 (note: EMR is FUTURE PHASE) |
| TR-020 | AC-AUD-002 | P2 | NEW | Audit immutable (PATCH/PUT/DELETE → 405): dental-audit tests have zero 405 assertions |

**Covered ACs (behavioral evidence found in tests):**

- AC-CLI-001 ✓ (prescriberMemberId check), AC-CLI-003 ✓ (consent immutable), AC-CLI-005 ✓ (append-only)
- AC-CLI-002 ✓ (assertBranchRole/403 present), AC-CLI-004 ✓ (lab order transitions present)
- AC-VIS-001 ✓, AC-VIS-002 ✓, AC-VIS-004 ✓, AC-VIS-005 ✓
- AC-IMG-001 ✓, AC-IMG-003 ✓, AC-IMG-004 ✓, AC-IMG-005 ✓
- AC-SCH-001 ✓ through AC-SCH-005 ✓ (all 5 covered)
- AC-BIL-001 ✓, AC-BIL-002 ✓, AC-BIL-003 ✓, AC-BIL-004 ✓
- AC-PMD-001 ✓, AC-PMD-003 ✓
- AC-PAT-001 ✓ through AC-PAT-004 ✓ (all 4 covered)
- AC-AUD-001 ✓, AC-AUD-003 ✓
- AC-EMR-002 ✓, AC-EMR-003 ✓

---

## Algorithm 5f — Forward Chain Violations

Handler code implementing behavior NOT documented in any MODULE_SPEC.

| ID | Sev | Status | Description |
|---|---|---|---|
| TR-021 | P1 | NEW | 6 handler files in `/handlers/emr/` (`createConsultation`, `finalizeConsultation`, `getConsultation`, `listConsultations`, `listEMRPatients`, `updateConsultation`) — `dental-emr-integration` MODULE_SPEC §20 explicitly states "FUTURE PHASE — do not implement handler files until explicitly scheduled." Premature implementation. |
| TR-022 | P2 | KNOWN | 32 shim handlers (`CephMgmt_*`, `DentalBranchManagement_*`, `ImagingMgmt_*`, etc.) — routed in `routes.ts`, not named in any MODULE_SPEC. Structural duplicate pattern from F7 remediation. |
| TR-023 | P2 | NEW | `dental-perio` handlers implement WF-042 (periodontal charting) but MODULE_SPEC §4 only lists WF-038 (clinical amendment) — wrong WF in spec. Code correct; spec needs fix. |

---

## Gap Summary (from WORKFLOW_MAP §14)

14 gap workflows (WFG-001 to WFG-014) were pre-identified in WORKFLOW_MAP. Status:

| WFG | Description | TR link |
|---|---|---|
| WFG-001 | BR-005 auto-discard (no enforcing workflow) | TR-001, TR-007 |
| WFG-002 | Orphan appointment when visit draft fails | untracked |
| WFG-003 | Concurrent visit conflict — client recovery undocumented | untracked |
| WFG-004 | Duplicate invoice race condition | untracked |
| WFG-005 | PMD generation async SLA unclear | untracked |
| WFG-006 | GDPR PHI purge not implemented | untracked |
| WFG-007 | Patient merge (BR-020) undocumented | TR-004, TR-008 |
| WFG-008–013 | Notification workflows (appointment, invoice, PMD, lab order) | P3 |
| WFG-014 | Lab order and consent form search/filter missing | P3 |

---

## Findings Index

| ID | Algorithm | Sev | Status | One-liner |
|---|---|---|---|---|
| TR-001 | 5a | P1 | KNOWN | BR-005 no enforcing code |
| TR-002 | 5a | P1 | KNOWN | BR-013 no handler |
| TR-003 | 5a | P1 | KNOWN | BR-019 not implemented |
| TR-004 | 5a | P1 | KNOWN | BR-020 not implemented |
| TR-005 | 5a | P2 | NEW | BR-030 uncovered range tail |
| TR-006 | 5a | P2 | NEW | BR-047 uncovered range tail |
| TR-007 | 5b | P1 | KNOWN | WF-047 orphan op |
| TR-008 | 5b | P1 | KNOWN | WF-057 orphan op |
| TR-009 | 5b | P2 | KNOWN | WF-061 orphan op |
| TR-010 | 5b | P2 | NEW | WF-042 spec routing error in dental-perio |
| TR-011 | 5c | P2 | KNOWN | 32 shim handlers unspecced |
| TR-012 | 5c | P2 | KNOWN | ~170 dental handlers have no filename in spec |
| TR-013 | 5d | P1 | KNOWN | FR0.1–FR0.8 dashboard chain broken |
| TR-014 | 5d | P2 | NEW | FR9.1 perio chain broken |
| TR-015 | 5e | P1 | NEW | AC-CLI-006 dead spec |
| TR-016 | 5e | P1 | NEW | AC-IMG-002 dead spec |
| TR-017 | 5e | P1 | KNOWN | AC-BIL-005 dead spec |
| TR-018 | 5e | P2 | NEW | AC-PMD-002 dead spec |
| TR-019 | 5e | P2 | NEW | AC-EMR-001 dead spec |
| TR-020 | 5e | P2 | NEW | AC-AUD-002 dead spec |
| TR-021 | 5f | P1 | NEW | EMR forward violation (FUTURE PHASE breached) |
| TR-022 | 5f | P2 | KNOWN | 32 shim handlers forward violation |
| TR-023 | 5f | P2 | NEW | dental-perio WF mismatch in spec |

**Totals: P0=0, P1=11, P2=12, P3=0. New findings: 11.**

---

## Recommended Actions by Priority

### P1 — Fix before next release
1. **TR-021** — Remove or spec `/handlers/emr/` files. Either delete 6 files or add MODULE_SPEC coverage with explicit phase gate.
2. **TR-015** — Add test: `completed visit write → 422` in `dental-clinical` acceptance tests.
3. **TR-016** — Add test: annotation `confirmed→draft` reversal → 422 in `dental-imaging` tests.
4. **TR-017** — Implement `markUncollectible` handler (501 stub acceptable) and add test asserting 501.
5. **TR-013** — Dashboard FR0.1–FR0.8: add `dental-dashboard` MODULE_SPEC or map FRs to existing org/scheduling specs with WF assignments.

### P2 — Fix within current milestone
6. **TR-010/TR-023/TR-014** — Fix `dental-perio` MODULE_SPEC §4: replace WF-038 with WF-042.
7. **TR-005/TR-006** — Extend imaging MODULE_SPEC §5 to cover full BR-023–BR-030 and BR-036–BR-047 ranges.
8. **TR-018** — Add 405 test for AC-PMD-002 in `dental-pmd` tests.
9. **TR-020** — Add 405 assertion for AC-AUD-002 in `dental-audit` tests.
10. **TR-011/TR-022** — Document or consolidate 32 shim handlers: either alias in MODULE_SPEC or dedup routes.

---

*Generated by oli-trace --strict run-6-strict-2026-05-29*
