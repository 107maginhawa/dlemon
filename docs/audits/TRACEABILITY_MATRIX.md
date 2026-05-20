# Dentalemon — Requirements Traceability Matrix

**Generated:** 2026-05-12  
**Branch:** `feat/v1.4-clinical-imaging`  
**Source documents:** `BUSINESS_RULES.md`, `ACCEPTANCE_CRITERIA.md`, `docs/context/personas.md`, `docs/modules/dental-imaging/MODULE_SPEC.md`  
**Regeneration:** `bun run audit:trace` (see `scripts/audit-traceability.ts`)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Covered — dedicated test(s) exist |
| ⚠️ | Partial — related tests exist but rule not directly verified |
| ❌ | Untested — no test covers this |
| 🚫 | Not implemented — rule exists but code does not yet enforce it |
| ⏸️ | Placeholder — `test.skip` exists, intent captured but not executed |

---

## 1. Executive Summary

### Coverage Stats

| Layer | Total | ✅ Covered | ⚠️ Partial | ❌ Untested |
|-------|-------|-----------|-----------|------------|
| Business Rules (BR-001–BR-022) | 22 | 17 (77%) | 3 | 2 (9%) |
| Imaging BRs (BR-023–BR-035) | 13 | 4 (31%) | 7 | 1 |
| Acceptance Criteria (AC-*) | 40 | 17 (43%) | 5 | 18 (45%) |
| Persona Journeys (steps) | 21 | 7 (33%) | 5 | 9 (43%) |
| Dental API Routes (E2E layer) | 113 | ~22 (19%) | ~15 | ~76 (67%) |

### Overall Risk Rating: 🟡 MEDIUM

Backend unit + contract tests provide broad coverage of the happy path. The gaps are concentrated in:
1. **Frontend workflow E2E** — most AC criteria have no Playwright test
2. **Imaging BRs** — 7 rules, 0 dedicated tests
3. **Billing edge cases** — void, uncollectible, payment plan block
4. **Read-only enforcement** — AC-VISIT-02, AC-CHART-03 have no E2E

### Top 5 Risks

| Risk | Severity | Missing Test |
|------|----------|-------------|
| BR-002: Visit state reversal has backend unit tests but no E2E | P1 | E2E asserting `draft→active→completed` cannot reverse |
| AC-VISIT-02: Workspace read-only after checkout not E2E verified | P1 | Playwright test: completed visit = no edit buttons |
| BR-019: Clinical append-only has no backend test | P1 | Backend: amendment replaces vs appends |
| AC-MED-03: Consent signing flow not E2E verified | P1 | Playwright: consent sign → read-only re-open |
| BR-024: Panoramic measurement warning not implemented | P2 | Implementation + test deferred to Phase 3a |

---

## 2. Business Rule Coverage Rollup

### Visit Lifecycle (BR-001 to BR-005)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-001 | No two active visits per patient | `createDentalVisit.ts` | ⚠️ implied in `business-rules.test.ts` | ✅ `use-visits.test.ts` [BR-001] | ⚠️ `patient-checkin.spec.ts` | ⚠️ Partial |
| BR-002 | Visit state linear: draft→active→completed→locked | `dental-visit` handlers | ✅ `business-rules.test.ts` (3 tests, lines ~432–502) | ❌ | ❌ | ⚠️ Partial |
| BR-003 | Visit immutable after completed/locked | `_workspace` `isReadOnly` flag | ❌ | ✅ `treatment-table.test.ts` [BR-003] | ❌ | ⚠️ Partial |
| BR-004 | Check-in creates visit; appointment delete ≠ visit delete | `dental-scheduling` + `dental-visit` | ✅ `business-rules.test.ts` describe('BR-004') | ✅ `check-in-flow.test.ts` [BR-004] | ✅ `patient-checkin.spec.ts` | ✅ Covered |
| BR-005 | Auto-discard empty visit on session end | Not implemented | ⏸️ `business-rules.test.ts` describe.skip | ❌ | ❌ | 🚫 Not implemented |

### Treatment (BR-006 to BR-008)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-006 | Treatment state forward-only; dismissed from any non-terminal | `treatment.schema.ts` `TREATMENT_TRANSITIONS` | ❌ | ✅ `use-treatments.test.ts` [BR-006], `use-save-treatment.test.ts` [BR-006] | ❌ | ⚠️ Partial |
| BR-007 | Completed treatment fields immutable | `dental-clinical` handlers | ✅ `business-rules.test.ts` describe('BR-007') | ✅ `treatment-table.test.ts` [BR-007] | ❌ | ✅ Covered |
| BR-008 | Carried-over treatments visual indicator only; not auto-charged | `_workspace` `carriedOverItems` | ⚠️ `dental-treatment.test.ts` [BR-008] | ⏸️ `treatment-table.test.ts` test.skip [BR-008] | ❌ | ⚠️ Partial |

### Billing and Invoicing (BR-009 to BR-013)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-009 | Invoice requires ≥1 line item | `createDentalInvoice.ts` | ✅ `business-rules.test.ts` [BR-009] | ✅ `workspace-payment-modal.test.ts` [BR-009] | ❌ | ✅ Covered |
| BR-010 | Tax always 0 (stub) | `createInvoice.ts` | ✅ `business-rules.test.ts` taxCents===0 | ❌ | ❌ | ✅ Covered |
| BR-011 | Active payment plan blocks invoice void | `dental-billing` handlers | ✅ `business-rules.test.ts` describe('BR-011') | ✅ `workspace-payment-modal.test.ts` [BR-011] | ❌ | ✅ Covered |
| BR-012 | Invoice lifecycle: draft→sent→paid/partial/overdue/void | `dental-billing` handlers | ✅ `business-rules.test.ts` [BR-012] (4 tests) | ✅ `workspace-payment-modal.test.ts` [BR-012] | ⚠️ `clinical-billing-handoff.spec.ts` | ✅ Covered |
| BR-013 | markInvoiceUncollectible incomplete | `markInvoiceUncollectible.ts` | ⏸️ `business-rules.test.ts` describe.skip | ❌ | ❌ | 🚫 Not implemented |

### Consent and Compliance (BR-014 to BR-015)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-014 | Consent immutable once signed | `dental-clinical` handlers + `consent-sheet.tsx` | ✅ `business-rules.test.ts` [BR-014] (line ~1017) | ✅ `consent-sheet.test.ts` [BR-014] | ❌ | ✅ Covered |
| BR-015 | Registration requires consent | `dental-patient` handlers | ✅ `business-rules.test.ts` consent guard | ✅ `patient-registration-modal.test.ts` [BR-015] | ✅ `patient-registration.spec.ts` (FR2.20) | ✅ Covered |

### Authorization (BR-016 to BR-017)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-016 | Branch membership required for all clinical data | `assert-branch-access.ts` | ✅ `business-rules.test.ts` [BR-016] (3 tests) | ❌ | ❌ | ✅ Covered |
| BR-017 | Prescription requires dentist prescriberMemberId | `dental-clinical` handlers + `rx-sheet.tsx` | ✅ `business-rules.test.ts` [BR-017] | ✅ `rx-sheet.test.ts` [BR-017] | ⚠️ `prescribe-medication.spec.ts` | ✅ Covered |

### Prescriptions and Lab Orders (BR-018)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-018 | Lab order lifecycle: ordered→in_progress→completed/cancelled | `dental-clinical` handlers | ✅ `business-rules.test.ts` [BR-018] (7 tests) | ✅ `lab-orders-sheet.test.ts` [BR-018] | ✅ `lab-order-tracking.spec.ts` (3 tests) | ✅ Covered |

### Patient Records (BR-019 to BR-020)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-019 | Clinical records append-only; amendments only | API layer (partial) | ⚠️ `clinical-attachment-amendment.test.ts` [BR-019] | ❌ | ❌ | ⚠️ Partial |
| BR-020 | Patient merge/unmerge not implemented | `mergePatients.ts` (TODO) | ⏸️ `business-rules.test.ts` describe.skip | ❌ | ❌ | 🚫 Not implemented |

### PMD (BR-021 to BR-022)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-021 | PMD is per-visit snapshot verified by checksum | `dental-pmd` handlers | ✅ `business-rules.test.ts` [BR-021] (4 tests) | ❌ | ✅ `pmd-generation.spec.ts` | ✅ Covered |
| BR-022 | Imported PMD stored as-is (read-only) | `dental-pmd` handlers | ✅ `business-rules.test.ts` PATCH/DELETE/PUT→404 | ❌ | ❌ | ✅ Covered |

### Imaging BRs (BR-023 to BR-029)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-023 | Annotations non-destructive; never burned into image | `imaging_annotation` table | ⚠️ `imaging.test.ts` [@BR-023] | ❌ | ⚠️ `imaging-annotation.spec.ts` (tools present) | ⚠️ Partial |
| BR-024 | Panoramic measurement requires accuracy warning | Viewer (`modality==='panoramic'`) | ⚠️ `imaging.test.ts` [@BR-024] | ❌ | ❌ | ⚠️ Partial |
| BR-025 | Image linked to patient; visit + tooth optional | `imaging_study` schema | ⚠️ `imaging.test.ts` [@BR-025] | ❌ | ⚠️ `imaging-comparison.spec.ts` IMG-05 | ⚠️ Partial |
| BR-026 | Image delete role-gated; default-deny | `deleteImage.ts` | ✅ `imaging.test.ts` [BR-026] (lines ~395–420) | ❌ | ❌ | ✅ Covered |
| BR-027 | Associates can only delete own images | `deleteImage.ts` | ✅ `imaging.test.ts` [BR-027] (lines ~421–450) | ❌ | ❌ | ✅ Covered |
| BR-028 | Soft delete only; files retained | `ImagingRepository.archiveImage` | ⚠️ `imaging.test.ts` [@BR-028] | ❌ | ❌ | ⚠️ Partial |
| BR-029 | All imaging endpoints enforce branch isolation | All imaging handlers | ⚠️ `imaging.test.ts` [@BR-029] | ❌ | ❌ | ⚠️ Partial |

### Imaging BRs (BR-030 to BR-035)

| BR | Rule (summary) | Handler | Backend Test | Frontend Test | E2E Test | Status |
|----|---------------|---------|-------------|---------------|----------|--------|
| BR-030 | Union adapter — legacy dental_attachment compatibility | `listPatientImages.ts` | ❌ | ❌ | ❌ | ❌ Untested |
| BR-031 | Offline caching via IndexedDB | `use-offline-cache.ts` | ❌ | ⚠️ hook implemented, no test | ❌ | ⚠️ Partial |
| BR-032 | Modality non-nullable with default 'other' | `updateImageModality.ts` | ⚠️ `imaging.test.ts` (broad, no BR tag) | ❌ | ❌ | ⚠️ Partial |
| BR-033 | Maximum file size 100MB | `createImagingStudy.ts` | ✅ `imaging.test.ts` [BR-033] | ❌ | ❌ | ✅ Covered |
| BR-034 | Allowed image formats: JPEG, PNG, TIFF, BMP | `createImagingStudy.ts` | ✅ `imaging.test.ts` [BR-034] | ❌ | ❌ | ✅ Covered |
| BR-035 | Concurrent annotation edits — last-write-wins | Annotation handlers | ❌ | ❌ | ❌ | ❌ Untested |

> **Note on BR-023 to BR-035**: `imaging.test.ts` has 60 test cases. BR-023, BR-024, BR-025, BR-026, BR-027, BR-028, BR-029, BR-033, BR-034 all have explicit `@BR-NNN` or `describe('BR-NNN')` tags (Phase 4 tagging complete). BR-030, BR-031, BR-035 remain untested. BR-032 has broad coverage (no explicit tag).

---

## 3. Acceptance Criteria Coverage

### Patient Registration (AC-REG)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-REG-01 | Register patient with consent → created, navigated | `patient-registration-modal.test.ts` | ✅ `patient-registration.spec.ts` FR2.3 | ✅ |
| AC-REG-02 | Registration blocked without consent | `patient-registration-modal.test.ts` | ✅ `patient-registration.spec.ts` FR2.20 | ✅ |
| AC-REG-03 | Walk-in from calendar → modal pre-filled | `appointment-modal.test.ts` | ✅ `walk-in.spec.ts`, `calendar.spec.ts` FR3.8 | ✅ |

### Scheduling (AC-SCHED)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-SCHED-01 | Create appointment → appears in time slot | `appointment-modal.test.ts` | ⚠️ `calendar.spec.ts` (button visible, no full create) | ⚠️ |
| AC-SCHED-02 | Edit existing appointment → calendar updated | ❌ | ❌ | ❌ |
| AC-SCHED-03 | Check in → status=checked_in, visit created, navigate to workspace | `check-in-flow.test.ts` | ✅ `patient-checkin.spec.ts` | ✅ |
| AC-SCHED-04 | Cancel appointment → status=cancelled, slot freed | ❌ | ❌ | ❌ |

### Clinical Workspace — Visit (AC-VISIT)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-VISIT-01 | Workspace renders with top bar, carousel, treatment table | `tooth-slideout.test.ts`, workspace hooks | ✅ `returning-patient-visit.spec.ts` | ✅ |
| AC-VISIT-02 | Workspace read-only after checkout; footer shows "View Invoice" | `treatment-table.test.ts` (readOnly) | ❌ No E2E for completed visit state | ❌ |
| AC-VISIT-03 | New visit → in_progress, appears in carousel | `use-create-visit.test.ts` | ✅ `action-contracts.spec.ts`, `returning-patient-visit.spec.ts` | ✅ |
| AC-VISIT-04 | Year filter → carousel shows only that year's visits | `timeline-carousel.test.ts` | ❌ | ⚠️ |

### Dental Charting (AC-CHART)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-CHART-01 | Tap tooth → slideout opens with conditions | `dental-chart.test.ts` | ✅ `returning-patient-visit.spec.ts` (tooth click) | ✅ |
| AC-CHART-02 | Save chart entry → persisted, chart updates, slideout closes | `use-save-chart.test.ts` | ✅ `action-contracts.spec.ts` (200 response) | ✅ |
| AC-CHART-03 | Chart entry blocked for completed visit → read-only slideout | `dental-chart.helpers.test.ts` | ❌ | ❌ |
| AC-CHART-04 | Tooth history shows all past entries newest-first | `use-tooth-history.test.ts` | ❌ | ❌ |
| AC-CHART-05 | Five-surface selector: multi-select, included in save | `five-surface-selector.test.ts` | ✅ `returning-patient-visit.spec.ts` (surface step) | ✅ |

### Treatment Plan (AC-TXPLAN)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-TXPLAN-01 | Treatment plan shows all items with cost and status | `treatment-plan-tab.test.ts` | ❌ | ⚠️ |
| AC-TXPLAN-02 | Carried-over items appear with visual indicator | ⏸️ `treatment-table.test.ts` skip [BR-008] | ❌ | ⏸️ |

### Medical History and Consent (AC-MED)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-MED-01 | Medical history entry saved; appears in safety floor if active | `medical-history-form.test.ts` | ❌ | ⚠️ |
| AC-MED-02 | Safety floor shows color-coded badges (max 6) | `tooth-slideout.test.ts` (safety floor) | ❌ | ⚠️ |
| AC-MED-03 | Consent e-signature → saved as signed, immutable, re-open read-only | `consent-sheet.test.ts` [BR-014] | ❌ **Gap: no E2E for signing flow** | ❌ |

### Prescriptions (AC-RX)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-RX-01 | Write prescription → saved, listed in Rx sheet | `rx-sheet.test.ts` [BR-017] | ⚠️ `prescribe-medication.spec.ts` (workspace loads, not full submit) | ⚠️ |
| AC-RX-02 | Non-dentist → Rx form disabled/hidden | `rx-sheet.test.ts` (role check) | ❌ | ⚠️ |

### Lab Orders (AC-LAB)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-LAB-01 | Create lab order → status=ordered, appears in list | `lab-orders-sheet.test.ts` [BR-018] | ✅ `lab-order-tracking.spec.ts` | ✅ |
| AC-LAB-02 | Lab order lifecycle: ordered→in_progress→completed; no reversal | `lab-orders-sheet.test.ts` [BR-018] | ✅ `lab-order-tracking.spec.ts` (lifecycle + invalid transition) | ✅ |

### Attachments (AC-ATTACH)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-ATTACH-01 | Upload → stored, appears in list, linked to visit | `attachments-sheet.test.ts` | ❌ | ⚠️ |
| AC-ATTACH-02 | View attachments: filename, type, upload date | `attachments-sheet.test.ts` | ❌ | ⚠️ |

### Invoicing (AC-INV)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-INV-01 | "Continue to Payment" → modal opens with treatments as line items | `workspace-payment-modal.test.ts` | ⚠️ `returning-patient-visit.spec.ts` (button present) | ⚠️ |
| AC-INV-02 | Invoice with no treatments blocked | `workspace-payment-modal.test.ts` [BR-009] | ❌ | ⚠️ |
| AC-INV-03 | Confirm → invoice created, visit=completed, workspace read-only | `use-workspace-payment.test.ts` | ✅ `clinical-billing-handoff.spec.ts` | ✅ |
| AC-INV-04 | Completed visit → footer "View Invoice" | `tooth-slideout.test.ts` (read-only mode) | ❌ | ❌ |

### Payment (AC-PAY)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-PAY-01 | Record full payment → status=paid | `workspace-payment-modal.test.ts` [BR-012] | ⚠️ `clinical-billing-handoff.spec.ts` | ⚠️ |
| AC-PAY-02 | Partial payment → status=partial, payment plan created | `workspace-payment-modal.test.ts` [BR-012] | ✅ `payment-plan.spec.ts` | ✅ |
| AC-PAY-03 | Payment plan blocks invoice void | `workspace-payment-modal.test.ts` [BR-011] | ❌ | ❌ |

### PMD (AC-PMD)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-PMD-01 | Generate PMD → checksum created, immutable | `use-pmd.test.ts` | ✅ `pmd-generation.spec.ts` | ✅ |
| AC-PMD-02 | Share PMD → native share sheet, includes all visit data | `use-share-pmd.test.ts` | ✅ `pmd-generation.spec.ts` (share button) | ✅ |
| AC-PMD-03 | Import external PMD → stored, linked, appears in history | `pmd-import.test.ts` | ❌ | ❌ |

### Patient Profile (AC-PROF)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-PROF-01 | Profile shows demographics, visits, billing, medical alerts | `patient-profile-page.test.ts` | ❌ | ⚠️ |
| AC-PROF-02 | Navigate workspace from profile | `patient-profile-page.test.ts` | ❌ | ⚠️ |

### Reporting (AC-REPORT)

| AC | Criteria (summary) | Unit Test | E2E Test | Status |
|----|-------------------|-----------|----------|--------|
| AC-REPORT-01 | Reports page: daily totals, appt count, collections, pending | `use-patient-report.test.ts`, `use-treatment-report.test.ts` | ❌ | ⚠️ |

---

## 4. Journey Gap Analysis

### Alex — Dentist Owner

**Journey 1: Open appointments → check in → record visit → prescribe**

| Step | Route/Action | Unit Test | E2E Test | Gap |
|------|-------------|-----------|----------|-----|
| 1. View today's appointments | `GET /dental/appointments` | `use-appointments.test.ts` | ✅ `calendar.spec.ts` FR3.1 | — |
| 2. Check in patient | `POST /dental/appointments/:id/check-in` | `check-in-flow.test.ts` | ✅ `patient-checkin.spec.ts` | — |
| 3. Navigate to workspace | Route `/_workspace/:patientId` | `_workspace/$patientId.test.ts` | ✅ `returning-patient-visit.spec.ts` | — |
| 4. Tap tooth → record condition | `POST /dental/visits/:id/chart` | `use-save-chart.test.ts` | ✅ `action-contracts.spec.ts` | — |
| 5. Add treatment | `POST /dental/visits/:id/treatments` | `use-save-treatment.test.ts` | ❌ No E2E for add treatment | **GAP** |
| 6. Write prescription | `POST /dental/visits/:id/prescriptions` | `rx-sheet.test.ts` | ❌ No E2E for submit prescription | **GAP** |
| 7. Complete visit + invoice | `PATCH /dental/visits/:id` + `POST /dental/billing/invoices` | `use-workspace-payment.test.ts` | ✅ `clinical-billing-handoff.spec.ts` | — |

**Journey 2: Staff management → add → role → PIN**

| Step | Route/Action | Unit Test | E2E Test | Gap |
|------|-------------|-----------|----------|-----|
| 1. Open staff page | `GET /dental/org/members` | `use-staff-members.test.ts` | ✅ `add-staff.spec.ts` FR6.5 | — |
| 2. Add staff member | `POST /dental/organizations/:id/branches/:id/members` | `staff-create-modal.test.ts` | ✅ `add-staff.spec.ts` FR6.1 | — |
| 3. Set PIN | `POST /dental/organizations/:id/branches/:id/members/:id/set-pin` | ❌ | ❌ No E2E for PIN set | **GAP** |
| 4. Staff logs in with PIN | `POST /dental/organizations/:id/branches/:id/members/:id/verify-pin` | `verifyPin.test.ts` | ✅ `auth-pin.spec.ts` | — |

**Journey 3: Billing → check eligibility → submit claim → track status**

| Step | Route/Action | Unit Test | E2E Test | Gap |
|------|-------------|-----------|----------|-----|
| 1. View invoices | `GET /dental/billing/invoices` | `use-invoices.test.ts` | ❌ | **GAP** |
| 2. Record payment | `POST /dental/billing/invoices/:id/payments` | `workspace-payment-modal.test.ts` | ⚠️ `clinical-billing-handoff.spec.ts` | — |
| 3. Check collections | `GET /dental/billing/collections/summary` | ❌ | ❌ | **GAP** |

---

### Jordan — Associate Dentist

**Journey 1: Check own schedule → view patient history → record visit**

| Step | Route/Action | Unit Test | E2E Test | Gap |
|------|-------------|-----------|----------|-----|
| 1. View own schedule | `GET /dental/appointments` (filtered) | ❌ No test for associate-scoped filter | ❌ | **GAP** |
| 2. View patient history | `GET /dental/visits` + tooth history | `use-visits.test.ts`, `use-tooth-history.test.ts` | ⚠️ `returning-patient-visit.spec.ts` | — |
| 3. Record visit | (same as Alex Journey 1, steps 4–7) | — | ⚠️ | — |

**Journey 2: Write prescription → submit**

| Step | Route/Action | Unit Test | E2E Test | Gap |
|------|-------------|-----------|----------|-----|
| 1. Open Rx sheet | Rx sheet component | `rx-sheet.test.ts` | ⚠️ `prescribe-medication.spec.ts` (workspace loads) | — |
| 2. Fill drug/dosage/frequency | Form validation | `rx-sheet.test.ts` | ❌ No E2E for form fill + submit | **GAP** |
| 3. Submit prescription | `POST /dental/visits/:id/prescriptions` | `rx-sheet.test.ts` | ❌ | **GAP** |

**Journey 3: Order lab → record results when received**

| Step | Route/Action | Unit Test | E2E Test | Gap |
|------|-------------|-----------|----------|-----|
| 1. Create lab order | `POST /dental/visits/:id/lab-orders` | `lab-orders-sheet.test.ts` | ✅ `lab-order-tracking.spec.ts` | — |
| 2. Advance status | `PATCH /dental/visits/:id/lab-orders/:id` | `lab-orders-sheet.test.ts` | ✅ `lab-order-tracking.spec.ts` | — |

---

### Sam — Front Desk Staff

**Journey 1: Patient arrives → find record → check in → collect consent**

| Step | Route/Action | Unit Test | E2E Test | Gap |
|------|-------------|-----------|----------|-----|
| 1. Find patient | `GET /dental/patients` | `use-patients.test.ts` | ✅ `patient-registration.spec.ts` (list) | — |
| 2. Check in | `POST /dental/appointments/:id/check-in` | `check-in-flow.test.ts` | ✅ `patient-checkin.spec.ts` | — |
| 3. Open consent sheet | Consent sheet component | `consent-sheet.test.ts` | ❌ | **GAP** |
| 4. Patient signs consent | `POST /dental/visits/:id/consents/:id/sign` | `consent-sheet.test.ts` [BR-014] | ❌ No E2E for consent signing | **GAP** |

**Journey 2: Book appointment → send confirmation**

| Step | Route/Action | Unit Test | E2E Test | Gap |
|------|-------------|-----------|----------|-----|
| 1. Check available slots | Calendar UI | `calendar-day.test.ts` | ⚠️ `calendar.spec.ts` FR3.1 | — |
| 2. Create appointment | `POST /dental/appointments` | `appointment-modal.test.ts` | ❌ No E2E for full appointment create | **GAP** |
| 3. Send confirmation | Notification trigger | ❌ | ❌ | **GAP** |

---

### Riley — Scheduling Specialist

**Journey 1–3: Set availability, inbound booking, referral booking**

| Step | Coverage |
|------|----------|
| Set practitioner working hours | `PUT /dental/branches/:id/working-hours` — unit test exists, no E2E |
| Book appointment (all 3 journeys) | `POST /dental/appointments` — no E2E for full booking flow |
| Send confirmation | No E2E |
| **Overall** | ❌ Riley journeys have no meaningful E2E coverage |

---

### Morgan — Billing Specialist

**Journey 1: End-of-day → review completed visits → process billing**

| Step | Route/Action | Unit Test | E2E Test | Gap |
|------|-------------|-----------|----------|-----|
| 1. View completed visits | `GET /dental/visits` (status=completed) | `use-visits.test.ts` | ❌ | **GAP** |
| 2. Open billing list | `GET /dental/billing/invoices` | `use-invoices.test.ts` | ❌ | **GAP** |
| 3. Issue invoice | `POST /dental/billing/invoices/:id/issue` | `dental-billing.test.ts` | ❌ | **GAP** |

**Journeys 2–3 (rejected claims, prior auth):** ❌ No tests at any layer. These workflows require insurance integration not yet implemented.

---

## 5. Route Health Check

Routes assessed across: backend unit test (U), E2E Playwright test (E), Hurl contract test (C).

**Key:** ✅ = has test | ❌ = no test | ⚠️ = inferred/partial

### `/dental/appointments`

| Route | U | E | C | Risk |
|-------|---|---|---|------|
| `POST /dental/appointments` | ✅ | ❌ | ✅ | Medium — no E2E create flow |
| `GET /dental/appointments` | ✅ | ✅ | ✅ | Low |
| `GET /dental/appointments/:id` | ✅ | ❌ | ✅ | Low |
| `PATCH /dental/appointments/:id` | ✅ | ❌ | ✅ | Medium — edit not E2E tested |
| `DELETE /dental/appointments/:id` | ✅ | ❌ | ✅ | Medium — cancel not E2E tested |
| `POST /dental/appointments/:id/check-in` | ✅ | ✅ | ✅ | Low |

### `/dental/billing`

| Route | U | E | C | Risk |
|-------|---|---|---|------|
| `POST /dental/billing/invoices` | ✅ | ✅ | ✅ | Low |
| `GET /dental/billing/invoices` | ✅ | ❌ | ✅ | Medium |
| `GET /dental/billing/invoices/:id` | ✅ | ❌ | ✅ | Low |
| `POST /dental/billing/invoices/:id/discount` | ✅ | ❌ | ✅ | Medium |
| `POST /dental/billing/invoices/:id/issue` | ✅ | ❌ | ✅ | Medium |
| `POST /dental/billing/invoices/:id/payments` | ✅ | ⚠️ | ✅ | Low |
| `POST /dental/billing/invoices/:id/payments/:id/void` | ✅ | ❌ | ✅ | High — void not E2E tested |
| `POST /dental/billing/invoices/:id/plan` | ✅ | ✅ | ✅ | Low |
| `POST /dental/billing/invoices/:id/void` | ✅ | ❌ | ✅ | High — void not E2E tested |
| `GET /dental/billing/patients/:id/balance` | ✅ | ❌ | ✅ | Medium |
| `GET /dental/billing/collections/summary` | ✅ | ❌ | ✅ | Medium |

### `/dental/branches`

| Route | U | E | C | Risk |
|-------|---|---|---|------|
| `GET /dental/branches/:id/consent-templates` | ✅ | ❌ | ✅ | Medium |
| `POST /dental/branches/:id/consent-templates` | ✅ | ❌ | ✅ | Medium |
| `GET /dental/branches/:id/settings` | ✅ | ❌ | ✅ | Low |
| `PUT /dental/branches/:id/settings` | ✅ | ❌ | ✅ | Medium |
| `GET /dental/branches/:id/working-hours` | ✅ | ❌ | ✅ | Low |
| `PUT /dental/branches/:id/working-hours` | ✅ | ❌ | ✅ | Medium |

### `/dental/imaging`

| Route | U | E | C | Risk |
|-------|---|---|---|------|
| `POST /dental/imaging/studies` | ✅ | ⚠️ | ✅ | Medium |
| `GET /dental/imaging/studies/:id` | ✅ | ⚠️ | ✅ | Low |
| `DELETE /dental/imaging/images/:id` | ✅ | ❌ | ✅ | **High** — role-gated delete, no E2E |
| `POST /dental/imaging/images/:id/measurements` | ✅ | ✅ | ✅ | Low |
| `PATCH /dental/imaging/images/:id/calibration` | ✅ | ✅ | ✅ | Low |
| `PATCH /dental/imaging/images/:id/modality` | ✅ | ❌ | ✅ | Medium |
| `/findings/:findingId` (PATCH, DELETE) | ✅ | ✅ | ❌ | Medium — no contract test |
| `/images/:imageId/findings` (POST, GET) | ✅ | ✅ | ❌ | Medium — no contract test |

> **Note:** `/findings/` and `/images/:imageId/findings` routes have **no `/dental/` prefix** in `routes.ts` — they appear unscoped. Verify these routes have proper `assertBranchAccess` middleware (BR-016 risk).

### `/dental/visits` (critical path)

| Route | U | E | C | Risk |
|-------|---|---|---|------|
| `POST /dental/visits` | ✅ | ✅ | ✅ | Low |
| `GET /dental/visits` | ✅ | ⚠️ | ✅ | Low |
| `PATCH /dental/visits/:id` | ✅ | ✅ | ✅ | Low |
| `POST /dental/visits/:id/chart` | ✅ | ✅ | ✅ | Low |
| `PATCH /dental/visits/:id/chart/teeth/:tooth` | ✅ | ✅ | ✅ | Low |
| `GET /dental/visits/history/:patientId/teeth/:tooth` | ✅ | ❌ | ✅ | Medium |
| `POST /dental/visits/:id/consents/:id/sign` | ✅ | ❌ | ✅ | **High** — consent signing, no E2E |
| `POST /dental/visits/:id/prescriptions` | ✅ | ❌ | ✅ | **High** — prescription submit, no E2E |
| `POST /dental/visits/:id/treatments` | ✅ | ❌ | ✅ | **High** — add treatment, no E2E |
| `PATCH /dental/visits/:id/treatments/:id` | ✅ | ❌ | ✅ | High |
| `POST /dental/visits/:id/lab-orders` | ✅ | ✅ | ✅ | Low |
| `PATCH /dental/visits/:id/lab-orders/:id` | ✅ | ✅ | ✅ | Low |
| `POST /dental/visits/:id/attachments` | ✅ | ❌ | ✅ | Medium |
| `POST /dental/visits/:id/amendments` | ✅ | ❌ | ✅ | Medium — amendment UI deferred |
| `POST /dental/visits/:id/carry-over` | ✅ | ❌ | ✅ | Medium — BR-008 placeholder |
| `POST /dental/visits/:id/pmd` | ✅ | ✅ | ✅ | Low |
| `POST /dental/visits/:id/notes` | ✅ | ❌ | ✅ | Medium — SOAP notes no E2E |

### `/dental/patients`

| Route | U | E | C | Risk |
|-------|---|---|---|------|
| `POST /dental/patients` | ✅ | ✅ | ✅ | Low |
| `GET /dental/patients` | ✅ | ✅ | ✅ | Low |
| `GET /dental/patients/:id` | ✅ | ❌ | ✅ | Low |
| `GET /dental/patients/:id/safety-floor` | ✅ | ❌ | ✅ | **High** — medical safety info, no E2E |
| `GET /dental/patients/:id/statement` | ✅ | ❌ | ✅ | Medium |
| `POST /dental/patients/import` | ✅ | ❌ | ✅ | Medium |
| `GET /dental/patients/export` | ✅ | ❌ | ✅ | Medium |

---

## 6. Untested Critical Paths (Priority Order)

### P0 — Safety-Critical, No E2E

| Priority | Gap | AC / BR | Recommended Test |
|----------|-----|---------|-----------------|
| P0 | `GET /dental/patients/:id/safety-floor` — medical alerts (allergies, medications) not E2E verified | AC-MED-02 | E2E: patient with active allergy → workspace top bar shows red badge |
| P0 | Consent signing flow — no E2E from open sheet → sign → read-only | AC-MED-03, BR-014 | E2E: open consent, sign, re-open, verify locked state |
| P0 | Prescription submit — prescribe-medication.spec.ts only loads workspace | AC-RX-01, BR-017 | E2E: fill Rx form → submit → verify appears in list |

### P1 — Workflow-Breaking, No E2E

| Priority | Gap | AC / BR | Recommended Test |
|----------|-----|---------|-----------------|
| P1 | Visit read-only after checkout | AC-VISIT-02, BR-003 | E2E: complete visit → re-open workspace → verify no edit buttons |
| P1 | Role-gated image delete | BR-026 | E2E: hygienist attempts delete → 403 |
| P1 | Add treatment in workspace | AC-VISIT (implied) | E2E: open slideout → save → verify treatment table row |
| P1 | Invoice void blocked by payment plan | AC-PAY-03, BR-011 | E2E: partial payment → void attempt → error shown |
| P1 | BR-002 state reversal guard | BR-002 | Backend: attempt `active→draft` → 4xx |

### P2 — Important, Partial Coverage

| Priority | Gap | AC / BR | Recommended Test |
|----------|-----|---------|-----------------|
| P2 | Cancel appointment | AC-SCHED-04 | E2E: cancel → status=cancelled, slot freed |
| P2 | Appointment edit | AC-SCHED-02 | E2E: edit time → calendar updates |
| P2 | PMD import | AC-PMD-03 | E2E: import PMD file → appears in patient history |
| P2 | Attachment upload | AC-ATTACH-01 | E2E: upload file → appears in list |
| P2 | Imaging BR tags | BR-023 to BR-029 | Add `@BR-NNN` tags to `imaging.test.ts` |
| P2 | SOAP notes | — | E2E: open notes sheet → save → retrieve |

### P3 — Lower Risk

| Priority | Gap | Recommended Test |
|----------|-----|-----------------|
| P3 | Riley journeys (scheduling specialist) — no E2E at all | E2E: set working hours → appears in calendar |
| P3 | Report page | AC-REPORT-01 | E2E: navigate to reports → verify daily totals render |
| P3 | Patient merge not implemented | BR-020 | Unit: confirm 501/404 returned |
| P3 | Tax stub | BR-010 | Already covered backend — add note to ADR-008 |

---

## 7. Recommendations

### Immediate (before next PR)

1. **Tag imaging tests** — Add `// @BR-023` etc. to `imaging.test.ts` to make coverage intentional. 60 tests exist but none are traceable to specific rules.

2. **Fix `/findings/` route scoping** — Verify `assertBranchAccess` is applied to `/findings/:findingId` and `/images/:imageId/findings`. These routes lack the `/dental/` prefix and may be missing the branch access guard (BR-016).

3. **Write BR-002 backend test** — Visit state reversal guard (`draft→active` only, no reversal) has zero tests. This is a core state machine invariant. Add to `business-rules.test.ts`.

### This Sprint

4. **E2E: consent signing** — AC-MED-03 + BR-014 gap. Single Playwright test: open → sign → verify read-only.

5. **E2E: prescription submit** — Extend `prescribe-medication.spec.ts` to fill + submit the Rx form and verify the prescription appears in the list.

6. **E2E: workspace read-only** — Add test to `returning-patient-visit.spec.ts` or new spec: complete a visit, re-navigate, verify no edit buttons.

7. **E2E: add treatment** — Workspace doesn't have an E2E that saves a treatment. Add to `action-contracts.spec.ts`.

### Before v2.0

8. **BR tags in all test files** — Implement the br-tagged-test-suite-design spec (`docs/superpowers/specs/2026-05-09-br-tagged-test-suite-design.md`). Add `// @BR-NNN @AC-XXX-NN` to every `describe`/`test` that verifies a rule. Then this matrix can be auto-generated from grep output rather than manual inference.

9. **BR-024 panoramic warning** — Phase 3a work. Add implementation + test when measurement tools land.

10. **Riley E2E coverage** — Scheduling specialist journeys have zero E2E. Add one end-to-end booking flow spec.

---

## Appendix: Counts

| Metric | Count |
|--------|-------|
| Total BRs | 29 (BR-001–BR-022 core, BR-023–BR-029 imaging) |
| BRs fully covered | 16 |
| BRs partially covered | 6 |
| BRs placeholder/skipped | 5 |
| BRs not implemented | 2 |
| Total ACs | 40 |
| ACs with E2E | 17 (43%) |
| ACs with unit test only | 10 (25%) |
| ACs with no test | 13 (33%) |
| Dental API routes | 113 |
| Routes with E2E | ~22 (19%) |
| Routes with contract test | ~95 (84%) |
| Backend unit test files | 85 |
| Backend E2E test files | 21 |
| Frontend unit test files | 99 |
| Playwright E2E spec files | 21 |
| Contract (Hurl) files | 36 |
| Total test cases (all layers) | ~4,645 |
