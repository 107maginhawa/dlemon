# Roadmap: Dentalemon

## Milestones

- ✅ **v1.0 Dental Patient Backend** - Phase 01 (shipped 2026-05-06)
- ✅ **v1.1 PR1 Frontend Completion** - Phases 1-5 (shipped 2026-05-06)
- 🚧 **v1.2 Wire & Ship** - Phases 1-5 (in progress)

## Phases

### 🚧 v1.2 Wire & Ship (In Progress)

**Milestone Goal:** Wire existing components, fill wireframe gaps, and deliver a feature-complete web MVP covering all ~60 web-applicable PRD FRs.

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Action Bar + Sheet Wiring** - Build footer action bar, wire 5 orphaned sheet components
- [ ] **Phase 2: Treatment Plan Tab** - Replace placeholder with live treatment plan data
- [ ] **Phase 3: Patient Profile** - Build patient profile screen from wireframe
- [ ] **Phase 4: Attachments + Payment Modal** - Clinical file attachments + quick payment recording
- [ ] **Phase 5: Report Detail + Smoke Test** - Report drilldown + full integration walkthrough

## Phase Details

### Phase 1: Action Bar + Sheet Wiring
**Goal**: Practitioner accesses all clinical sheets (Rx, Consent, Lab Orders, PMD) from a unified workspace action bar
**Depends on**: Nothing (first phase)
**Requirements**: WBAR-01, WBAR-02, WBAR-03, WBAR-04, WBAR-05, WBAR-06
**Success Criteria** (what must be TRUE):
  1. Workspace footer displays action bar with icon triggers for Rx, Consent, Lab Orders, PMD
  2. User can open and close each of the 4 sheet overlays from the action bar
  3. RxSheet receives prescriberMemberId correctly from localStorage
  4. User can access PMDImport from Notes tab or within PMDViewer overlay
**Plans**: TBD

### Phase 2: Treatment Plan Tab
**Goal**: Treatment Plan tab shows live data with urgency grouping and cost summary
**Depends on**: Phase 1
**Requirements**: TXPL-01, TXPL-02, TXPL-03
**Success Criteria** (what must be TRUE):
  1. Treatment Plan tab shows live data from API (no "Coming in PR2" placeholder)
  2. Treatments are grouped by urgency/phase
  3. Treatment plan summary displays total cost
**Plans**: TBD

### Phase 3: Patient Profile
**Goal**: Complete patient information accessible from a dedicated profile screen
**Depends on**: Phase 2
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04
**Success Criteria** (what must be TRUE):
  1. User can view patient demographics and contact info
  2. User can view patient visit history
  3. User can view patient balance/statement
  4. Patient profile accessible from both patient list and workspace
**Plans**: TBD

### Phase 4: Attachments + Payment Modal
**Goal**: Clinical file attachments and payment recording available within workspace context
**Depends on**: Phase 3
**Requirements**: ATCH-01, ATCH-02, ATCH-03, PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. User can upload clinical files (X-rays, photos) to a visit
  2. User can view attachment gallery for a visit
  3. User can delete attachments
  4. User can record a payment with method, amount, and reference from workspace context
  5. Payment updates invoice status after recording
**Plans**: TBD

### Phase 5: Report Detail + Smoke Test
**Goal**: Drilldown from revenue reports to invoice detail + full end-to-end verification
**Depends on**: Phase 4
**Requirements**: RPT-01, RPT-02
**Success Criteria** (what must be TRUE):
  1. User can click a revenue report row to see invoice detail
  2. Report drilldown shows line items and payment history
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Action Bar + Sheet Wiring | 0/TBD | Not started | - |
| 2. Treatment Plan Tab | 0/TBD | Not started | - |
| 3. Patient Profile | 0/TBD | Not started | - |
| 4. Attachments + Payment Modal | 0/TBD | Not started | - |
| 5. Report Detail + Smoke Test | 0/TBD | Not started | - |
