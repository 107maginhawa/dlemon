<!--
oli: oli-prd-audit v1.0 | generated: 2026-05-24 | triggered: SLAs present in PRD §8 NFR
-->

# Performance Specification — Dentalemon

**Source**: PRD §8 Non-Functional Requirements

---

## Defined SLAs

| Metric | Target | Measurement Point | Status |
|--------|--------|------------------|--------|
| Workspace load time | < 2 seconds | Patient workspace open (full data) | [UNVERIFIED] |
| Patient search response | < 1 second | Search query to results displayed | [UNVERIFIED] |
| Timeline carousel animation | 60fps minimum | Swipe gesture on carousel | [UNVERIFIED] |
| Per-tooth history load | < 1 second (≤500 visits) | Tooth tap → history panel | [UNVERIFIED] |
| Touch target size | ≥ 44×44px | All interactive elements | [VERIFY in UI] |

---

## Capacity Targets

| Resource | Limit | Notes |
|----------|-------|-------|
| Patients per branch | 10,000 | Drives index requirements |
| Visits per branch | 100,000 | Drives query pagination requirements |
| Concurrent users | [UNSPECIFIED] | Needs definition for load testing |

---

## Performance Risks (from codebase audit)

| Risk | File | Severity |
|------|------|---------|
| N+1 query in acceptTreatmentPlan | `dental-visit/acceptTreatmentPlan.ts:102` | MEDIUM |
| Unbounded list queries | `listDentalVisits`, `listDentalTreatments`, `listDentalInvoices` | MEDIUM |
| No APM/metrics endpoint | — | Cannot verify SLAs without instrumentation |

---

## Missing Performance Definitions

- Concurrent user target for load testing
- Offline sync performance (CRDT merge time)
- Image upload/processing time for imaging module
- PMD generation time for large visit records
- Background job throughput (pg-boss) for notification delivery
