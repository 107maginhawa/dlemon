# Requirements: Dentalemon v1.2 Wire & Ship

**Defined:** 2026-05-06
**Core Value:** A practitioner can open any patient folder, view their dental chart, plan treatments, and record visits — all from a single cohesive workspace.

## v1.2 Requirements

Requirements for Wire & Ship milestone. Each maps to roadmap phases.

### Workspace Action Bar

- [ ] **WBAR-01**: Workspace footer shows action bar with icon triggers between treatment summary and payment button
- [ ] **WBAR-02**: User can open RxSheet overlay from action bar (with prescriberMemberId plumbed)
- [ ] **WBAR-03**: User can open ConsentSheet overlay from action bar
- [ ] **WBAR-04**: User can open LabOrdersSheet overlay from action bar
- [ ] **WBAR-05**: User can open PMDViewer overlay from action bar (wrapped in Shadcn Sheet)
- [ ] **WBAR-06**: User can access PMDImport from Notes tab or within PMDViewer

### Treatment Plan

- [ ] **TXPL-01**: Treatment Plan tab shows live data from getTreatmentPlan API (replaces "Coming in PR2")
- [ ] **TXPL-02**: Treatments are grouped by urgency/phase
- [ ] **TXPL-03**: User can view treatment plan summary with total cost

### Patient Profile

- [ ] **PROF-01**: User can view patient demographics and contact info
- [ ] **PROF-02**: User can view patient visit history
- [ ] **PROF-03**: User can view patient balance/statement
- [ ] **PROF-04**: Patient profile accessible from patient list or workspace

### Attachments

- [ ] **ATCH-01**: User can upload clinical files (X-rays, photos) to a visit
- [ ] **ATCH-02**: User can view attachment gallery for a visit
- [ ] **ATCH-03**: User can delete attachments

### Payment

- [ ] **PAY-01**: User can record a payment from workspace context
- [ ] **PAY-02**: Payment modal captures method, amount, and reference
- [ ] **PAY-03**: Payment updates invoice status

### Reports

- [ ] **RPT-01**: User can click a revenue report row to see invoice detail
- [ ] **RPT-02**: Report drilldown shows line items and payment history

## v1.3 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Periodontal Charting

- **PERIO-01**: User can record periodontal pocket depths per tooth
- **PERIO-02**: User can view periodontal chart with color-coded severity
- **PERIO-03**: User can track periodontal progression over visits

### Tech Debt

- **DEBT-01**: Refactor orphaned components from raw fetch() to TanStack Query hooks
- **DEBT-02**: Responsive/polish pass on all screens

## Out of Scope

| Feature | Reason |
|---------|--------|
| Periodontal charting | No backend schema/repo/handler, no wireframe — full vertical feature for v1.3 |
| iPad-native features | Apple Pencil, gestures, Split View — requires v2.0 platform work |
| P2P sync / offline-first | Cadence integration — requires v2.1 infrastructure |
| TDD retrofit | Backend already tested (254 repo + 297 handler tests). Assembly milestone. |
| Responsive/polish pass | Ship functional first, polish in v1.3 |
| Claims EDI / insurance billing | Separate product concern, not practice management MVP |
| PACS integration | Medical imaging infrastructure, out of scope for web MVP |
| AI-assisted imaging | v2+ differentiator, not table stakes |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WBAR-01 | — | Pending |
| WBAR-02 | — | Pending |
| WBAR-03 | — | Pending |
| WBAR-04 | — | Pending |
| WBAR-05 | — | Pending |
| WBAR-06 | — | Pending |
| TXPL-01 | — | Pending |
| TXPL-02 | — | Pending |
| TXPL-03 | — | Pending |
| PROF-01 | — | Pending |
| PROF-02 | — | Pending |
| PROF-03 | — | Pending |
| PROF-04 | — | Pending |
| ATCH-01 | — | Pending |
| ATCH-02 | — | Pending |
| ATCH-03 | — | Pending |
| PAY-01 | — | Pending |
| PAY-02 | — | Pending |
| PAY-03 | — | Pending |
| RPT-01 | — | Pending |
| RPT-02 | — | Pending |

**Coverage:**
- v1.2 requirements: 21 total
- Mapped to phases: 0
- Unmapped: 21 (pending roadmap creation)

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 after initial definition*
