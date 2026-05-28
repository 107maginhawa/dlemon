<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/product/modules/*/API_CONTRACTS.md, docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md -->
<!-- generated: 2026-05-27 -->
<!-- scope: ALL 11 modules -->

# Enforcement Coverage Report — All 11 Modules

---

## Audit Scope

| Artifact | Status |
|----------|--------|
| MODULE_SPEC files | Found: 11 modules |
| API_CONTRACTS files | Found: 11 modules |
| Reference standard | `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` |
| WORKFLOW_MAP.md | Found at `docs/product/WORKFLOW_MAP.md` (587 lines) |
| EVENT_CONTRACTS.md | Found at `docs/product/EVENT_CONTRACTS.md` (569 lines) |
| ROLE_PERMISSION_MATRIX.md | Found at `docs/product/ROLE_PERMISSION_MATRIX.md` (121 lines) |
| DOMAIN_MODEL.md | Not found — entity cross-reference skipped |
| Source directories scanned | All 11 handler directories under `services/api-ts/src/handlers/` |

Steps executed: Depth analysis (section coverage), Breadth analysis (unspecced handlers), API_CONTRACTS cross-reference, implementation status check.

---

## Executive Summary

| Module | Spec Lines | Handler Files (total) | Non-Test Handlers | Sections Present | Coverage Score | Status |
|--------|-----------|----------------------|-------------------|-----------------|----------------|--------|
| dental-audit | 101 | 4 | 1 | 16/21 (76%) | **52%** | HIGH RISK |
| dental-billing | 221 | 34 | 15 | 21/21 (100%) | **72%** | MEDIUM RISK |
| dental-clinical | 228 | 64 | 30 | 21/21 (100%) | **68%** | MEDIUM RISK |
| dental-emr-integration | 96 | 0 | 0 | 14/21 (67%) | **N/A (future phase)** | PLANNED |
| dental-imaging | 218 | 45 | 34 | 21/21 (100%) | **61%** | HIGH RISK |
| dental-org | 347 | 64 | 36 | 21/21 (100%) | **64%** | HIGH RISK |
| dental-patient | 323 | 82 | 53 | 21/21 (100%) | **55%** | HIGH RISK |
| dental-perio | 306 | 12 | 6 | 20/21 (95%) | **90%** | LOW RISK |
| dental-pmd | 160 | 13 | 7 | 20/21 (95%) | **82%** | LOW RISK |
| dental-scheduling | 183 | 25 | 12 | 21/21 (100%) | **75%** | MEDIUM RISK |
| dental-visit | 218 | 59 | 28 | 21/21 (100%) | **89%** (quality-adj: 73%) | MEDIUM RISK (prior analysis) |

> **Coverage score formula:** 40% structural completeness (sections) + 40% API breadth (handlers specced / handlers implemented) + 20% critical spec accuracy (P1 findings present = deducted). dental-emr-integration excluded — future phase with 0 handlers.

> **Overall pipeline status:** 5 of 11 active modules have coverage below 75%. Enforcement runs on these modules will generate unreliable results. Fix P1 findings before running `/oli-enforce-all`.

---

## Per-Module Coverage

### 1. dental-audit

**Size:** 101 lines | **Implementation:** 4 total files, 1 non-test handler | **Status:** Minimally implemented

**Sections present:** §1, §2, §3, §5, §6, §7, §7b, §8, §10, §10b, §11, §14, §16, §17, §19, §20
**Sections absent:** §4 Workflow Details, §9 UI/UX, §12 Test Expectations, §13 Edge Cases, §15 Error Handling, §18 Feature Flags

**API coverage:** 1 documented endpoint (GET /dental/audit-events), 1 implemented (getAuditEvents.ts)

#### P1 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DAUD-001 | P1 | xref_role_mismatch | §6 Permissions + getAuditEvents.ts:18 | **Role enforcement mismatch.** MODULE_SPEC §6 says "Read: dentist_owner (branch-scoped)". API_CONTRACTS says "Auth: `dentist_owner` only". Handler code checks `roles.includes('admin')` — the platform admin role, not the dental `dentist_owner` role. A dentist_owner cannot access their own audit log. |
| EC-DAUD-002 | P1 | xref_endpoint_missing | §10 API Expectations + app.ts:192 | **Endpoint path mismatch.** MODULE_SPEC §10 and API_CONTRACTS document `GET /dental/audit-events`. Handler is registered at `GET /dental/admin/audit`. Any enforcement test using the specced path will get 404. |
| EC-DAUD-003 | P1 | depth_empty_section | §3 Workflows, WF-096 | **pg-boss consumer not implemented.** MODULE_SPEC §3 declares WF-096 "Write audit event (async, all modules via pg-boss)". No pg-boss consumer file exists in `services/api-ts/src/handlers/dental-audit/`. The audit event write path is entirely unimplemented. AC-AUD-001 ("any write → audit event within 5s") cannot pass. |

#### P2 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DAUD-004 | P2 | depth_empty_section | §9, §12, §13, §15, §18 | **Six spec sections absent.** §4 Workflow Details, §9 UI/UX, §12 Test Expectations, §13 Edge Cases, §15 Error Handling, §18 Feature Flags are all missing. 71% structural coverage prevents reliable enforcement agent operation. |
| EC-DAUD-005 | P2 | depth_missing_signatures | §10 API Expectations | **PHI guard (G-005) enforcement gap has no spec target.** MODULE_SPEC §5 mentions "G-005 PHI currently logged in auth handlers — must fix in Wave G1" but §11 AC-AUD-004 is the only spec handle for it. No test expectation (§12 absent) documents what test verifies AC-AUD-004. |

---

### 2. dental-billing

**Size:** 221 lines | **Implementation:** 34 total files, 15 non-test handlers | **Status:** Fully implemented

**Sections present:** All 21 (plus §7.1 extra — data scope detail is a quality addition)

**API coverage:** MODULE_SPEC §10 lists 8 endpoints. API_CONTRACTS documents 7. Implementation has 15 handlers.

**Unspecced handlers (not in MODULE_SPEC §10 or API_CONTRACTS):**
- `applyDentalDiscount` — discount endpoint
- `getCollectionsSummary` — collections/reporting endpoint
- `getDentalPaymentReceipt` — receipt endpoint
- `listDentalPayments` — payment list endpoint
- `updateDentalPaymentPlan` — plan mutation endpoint
- `voidDentalPayment` — payment void (BILL-BR-005 mentions voids/refunds but no endpoint spec)
- `getPatientBalance` — patient balance (MODULE_SPEC §10 has `GET /dental/patients/:id/statement`, may overlap)

#### P1 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DBIL-001 | P1 | xref_status_mismatch | API_CONTRACTS.md line 9 | **Invoice FSM status terminology mismatch.** API_CONTRACTS header declares FSM as `draft → sent → partial → paid | overdue | voided`. CODE schema (`dental-invoice.schema.ts:17`) uses `draft → issued → partial → paid | overdue | voided`. MODULE_SPEC §8 uses `issued`. The value `sent` does not exist as an enum value in code. Any enforcement test filtering by status `sent` will silently find zero results. |

#### P2 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DBIL-002 | P2 | depth_missing_signatures | §10 API Expectations + API_CONTRACTS | **7 implemented handlers have no spec coverage.** `applyDentalDiscount`, `getCollectionsSummary`, `getDentalPaymentReceipt`, `listDentalPayments`, `updateDentalPaymentPlan`, `voidDentalPayment`, `getPatientBalance` are live in production with no endpoint documentation in MODULE_SPEC §10 or API_CONTRACTS. Enforcement agents cannot verify these endpoints. |
| EC-DBIL-003 | P2 | depth_tbd_marker | §11 AC-BIL-003 | **AC-BIL-003 spec is internally inconsistent.** AC-BIL-003 states "Record partial payment → invoice transitions to partial + requires PaymentPlan." §8 state machine shows `partial` state is set by the system (WF-053) only when a payment plan is active. The AC implies that recording *any* partial payment creates a partial state — this conflicts with §8 where partial is plan-driven. Enforcement agents will test the wrong invariant. |
| EC-DBIL-004 | P2 | depth_empty_section | §5 Business Rules, BR-013 | **markUncollectible spec inconsistency.** BR-013 says "markUncollectible not implemented → 501 NOT_IMPLEMENTED". But the implementation file list shows no `markUncollectible` handler. BR-013 documents an endpoint that returns 501 but no such route is registered. Enforcement expecting a 501 will get 404. |

---

### 3. dental-clinical

**Size:** 228 lines | **Implementation:** 64 total files, 30 non-test handlers | **Status:** Fully implemented + significant extensions

**Sections present:** All 21

**API coverage:** MODULE_SPEC §10 lists 10 endpoints. API_CONTRACTS documents 10 endpoints. Implementation has 30 handlers.

**Unspecced handlers (not in MODULE_SPEC §10 or API_CONTRACTS):**
- `createInventoryAdjustment`, `createInventoryItem`, `listInventoryAdjustments`, `listInventoryItems`, `updateInventoryItem` — entire inventory sub-module (5 handlers)
- `createOcclusionScreening`, `listOcclusionScreenings` — occlusion sub-module (2 handlers)
- `createPostopTemplate`, `listPostopTemplates`, `updatePostopTemplate` — post-op templates (3 handlers)
- `updateMedicalHistoryEntry` — spec says append-only (no PATCH), but handler exists
- `deleteAttachment` — spec §13 edge cases don't mention delete; §5 BR-003 implies immutability concern
- `updatePrescription` — spec §3 WF-065 is "[INFERRED] Edit prescription (before visit locked)" at P2, not in §10 API Expectations
- `listAmendments` — listed in §3 workflows implicitly but not in §10
- `updateLabOrder` — §10 only has PATCH `/lab-orders/:lid` for status progression (may be this handler)

#### P1 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DCLI-001 | P1 | depth_spec_conflict | §5 BR-003 + §7b + updateMedicalHistoryEntry.ts | **updateMedicalHistoryEntry violates append-only rule.** MODULE_SPEC §5 business rules state `BR-015c` (patient follow-ups) are append-only, and §7 data requirements mark medical history as "append-only". §11 AC-CLI-005 states "Medical history entry → no PATCH/DELETE endpoints available". Handler `updateMedicalHistoryEntry.ts` exists and presumably registers a PATCH endpoint. AC-CLI-005 would fail against this implementation. |

#### P2 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DCLI-002 | P2 | depth_missing_signatures | §10 API Expectations + API_CONTRACTS | **10+ implemented handlers have no spec coverage.** The inventory (5 handlers), occlusion screening (2), post-op templates (3), plus `deleteAttachment`, `listAmendments`, `updatePrescription` are live in production with no endpoint documentation. |
| EC-DCLI-003 | P2 | depth_missing_sections | §10 | **Entire inventory sub-module is unspecced.** `createInventoryAdjustment`, `createInventoryItem`, `listInventoryAdjustments`, `listInventoryItems`, `updateInventoryItem` implement a lightweight inventory module inside dental-clinical. IDEAL standard §3.11 places inventory as a separate module. This is a boundary violation that is completely undocumented in any MODULE_SPEC. |
| EC-DCLI-004 | P2 | xref_coupling_risk | §1 Note, §7b | **G-003 coupling risk is documented but not resolved.** MODULE_SPEC §1 states "KNOWN COUPLING RISK (G-003): Imports `VisitRepository` directly from dental-visit — must be refactored to service interface in Wave G1." This appears in §7b and §20 as well. No evidence of resolution in committed code per git status. This is a live architectural risk, not future work. |

---

### 4. dental-emr-integration

**Size:** 96 lines | **Implementation:** 0 files | **Status:** FUTURE PHASE (Phase 3+)

**Sections present:** 14/21 (missing §4, §9, §12, §13, §15, §17, §18)

**Note:** 0 handler files is EXPECTED per MODULE_SPEC §1 "Implementation status: future_phase (Phase 3+)". No enforcement should run against this module until explicitly scheduled. Coverage gaps below are for spec completeness only.

#### P3 Findings (spec quality only — no enforcement target)

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DEMR-001 | P3 | depth_empty_section | Multiple sections | **7 sections absent.** §4 Workflow Details, §9 UI/UX, §12 Test Expectations, §13 Edge Cases, §15 Error Handling, §17 Observability, §18 Feature Flags are all missing. When Phase 3+ implementation begins, the spec will need significant expansion before enforcement can run. |

---

### 5. dental-imaging

**Size:** 218 lines | **Implementation:** 45 total files, 34 non-test handlers | **Status:** Fully implemented + significant extensions + duplicate handlers

**Sections present:** All 21

**API coverage:** MODULE_SPEC §10 lists 9 endpoints. API_CONTRACTS documents 9 endpoints. Implementation has 34 non-test handlers.

**Critical issue: DUAL handler sets (old + facade migration in progress)**

Old handler set still present:
- `createFinding.ts`, `updateFinding.ts`, `deleteFinding.ts`, `listFindings.ts`
- `createMeasurement.ts`, `deleteMeasurement.ts`, `listMeasurements.ts`
- `createImagingStudy.ts`, `getImagingStudy.ts`, `listPatientImages.ts`, `updateFinding.ts`, `updateImageCalibration.ts`, `updateImageModality.ts`

New facade set (`Mgmt_*`):
- `ImagingFindingsMgmt_createFinding.ts`, `ImagingFindingsMgmt_deleteFinding.ts`, `ImagingFindingsMgmt_listFindings.ts`, `ImagingFindingsMgmt_updateFinding.ts`
- `ImagingMgmt_createImagingStudy.ts`, `ImagingMgmt_getImagingStudy.ts`, `ImagingMgmt_deleteImage.ts`, `ImagingMgmt_createMeasurement.ts`, `ImagingMgmt_deleteMeasurement.ts`, `ImagingMgmt_listMeasurements.ts`, `ImagingMgmt_updateImageCalibration.ts`, `ImagingMgmt_updateImageModality.ts`
- `PatientImageMgmt_listPatientImages.ts`

**Unspecced handlers (not in MODULE_SPEC §10 or API_CONTRACTS):**
- `ImagingMgmt_updateImageCalibration` — not in §10
- `ImagingMgmt_updateImageModality` — not in §10
- `ImagingMgmt_deleteImage` — not in §10
- `ImagingMgmt_listMeasurements` / `listMeasurements` — not in §10 (only POST measurements documented)
- `ImagingMgmt_deleteMeasurement` / `deleteMeasurement` — not in §10
- `ImagingFindingsMgmt_listFindings` / `listFindings` — not in §10 (only POST findings documented)
- `ImagingFindingsMgmt_updateFinding` / `updateFinding` — not in §10
- `ImagingFindingsMgmt_deleteFinding` / `deleteFinding` — not in §10
- `CephMgmt_createCephReport`, `CephMgmt_getCephReport` — not in §10
- `CephMgmt_deleteCephLandmark` — not in §10 (spec has batch upsert, no delete)
- `CephMgmt_listCephLandmarks` — not in §10
- `CephMgmt_updateCephLandmark` — §10 has `PUT /ceph-analyses/:id/landmarks` (batch upsert); individual update is a different pattern
- `PatientImageMgmt_listPatientImages` — not in §10

#### P1 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DIMG-001 | P1 | depth_spec_conflict | §10 API Expectations, handler directory | **Duplicate handler sets create undefined behavior.** Old handlers (`createFinding.ts`, `listFindings.ts`, `deleteFinding.ts`, `updateFinding.ts`, `createMeasurement.ts`, `deleteMeasurement.ts`, `listMeasurements.ts`, `createImagingStudy.ts`, `getImagingStudy.ts`) coexist alongside new `ImagingFindingsMgmt_*` and `ImagingMgmt_*` facades. Both sets likely register routes, causing either route conflicts or redundant dual registrations. MODULE_SPEC has no documentation of this migration state. Enforcement cannot determine which handler is authoritative. |

#### P2 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DIMG-002 | P2 | depth_missing_signatures | §10 API Expectations + API_CONTRACTS | **13+ implemented handlers have no spec coverage.** All CRUD operations for findings (list, update, delete), measurements (list, delete), image operations (delete, calibrate, modality), ceph reports (create, get), individual landmark operations (list, update, delete), and patient image list are live with no endpoint documentation. |
| EC-DIMG-003 | P2 | depth_spec_conflict | §10, CephMgmt_* handlers | **Ceph report concept absent from spec.** `CephMgmt_createCephReport.ts` and `CephMgmt_getCephReport.ts` implement a ceph report entity. MODULE_SPEC §10 mentions `POST /ceph-analyses/:id/recompute` and describes ceph analysis, but has no mention of a separate "CephReport" entity with create/get endpoints. This is an undocumented API surface. |
| EC-DIMG-004 | P2 | depth_spec_conflict | §5 BR-036–047, §8 SM-02 | **Ceph landmark delete is spec-prohibited.** MODULE_SPEC §8 shows `Ceph Landmark: not_placed → placed → locked`. Once placed, landmarks progress forward; the spec documents no delete path. `CephMgmt_deleteCephLandmark.ts` implements a delete endpoint that conflicts with the immutable landmark progression defined in SM-02. |

---

### 6. dental-org

**Size:** 347 lines | **Implementation:** 64 total files, 36 non-test handlers | **Status:** Fully implemented + significant extensions + duplicate handlers

**Sections present:** All 21

**API coverage:** MODULE_SPEC §10 lists 9 endpoints. API_CONTRACTS documents 9 endpoints. Implementation has 36 non-test handlers.

**Critical issue: DUAL handler sets (old + facade migration)**

Old handlers still present:
- `createOrganization.ts`, `createMember.ts`, `deactivateMember.ts`, `updateMember.ts`, `listMembers.ts`
- `branchSettings.ts`, `getBranchSettings.ts`, `updateBranchSettings.ts`
- `consentTemplates.ts`, `createConsentTemplate.ts`, `deleteConsentTemplate.ts`, `updateConsentTemplate.ts`, `listConsentTemplates.ts`
- `setPin.ts`, `verifyPin.ts`, `pinRecovery.ts`, `recoverPin.ts`, `resetMemberPin.ts`, `setSecurityQuestion.ts`
- `getBranchesByUser.ts`, `getDashboardSummary.ts`, `getOrgContext.ts`, `getWorkingHours.ts`, `updateWorkingHours.ts`

New facade set:
- `DentalBranchManagement_create.ts`, `DentalBranchManagement_get.ts`, `DentalBranchManagement_list.ts`
- `DentalMembershipManagement_create.ts`, `DentalMembershipManagement_deactivate.ts`, `DentalMembershipManagement_list.ts`
- `DentalMembershipManagement_setPin.ts`, `DentalMembershipManagement_verifyPin.ts`
- `DentalOrganizationManagement_create.ts`, `DentalOrganizationManagement_get.ts`, `DentalOrganizationManagement_update.ts`

**Unspecced handlers:**
- All 6 PIN handlers (`setPin`, `verifyPin`, `pinRecovery`, `recoverPin`, `resetMemberPin`, `setSecurityQuestion`) — §19 ORG-S5 mentions PIN but §10 API Expectations lists 0 PIN endpoints
- `getBranchesByUser`, `getOrgContext` — not in §10
- `branchSettings` — appears to be a legacy handler for branch settings, overlapping with `getBranchSettings`/`updateBranchSettings`
- `consentTemplates` — appears to be a legacy handler, overlapping with `listConsentTemplates`

#### P1 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DORG-001 | P1 | xref_endpoint_missing | §10 API Expectations, §19 ORG-S5 | **PIN auth endpoints entirely unspecced.** MODULE_SPEC §19 ORG-S5 declares "PIN set, verify, lockout" as a vertical slice. §5 BR-016b documents PIN lockout. §7 data requirements include `pin_hash`, `pin_failed_attempts`, `pin_locked_until`. Yet §10 API Expectations has ZERO PIN endpoints documented. API_CONTRACTS.md has ZERO PIN endpoints. Six PIN handlers are live in production: `setPin`, `verifyPin`, `pinRecovery`, `recoverPin`, `resetMemberPin`, `setSecurityQuestion`. Any enforcement run will be blind to the entire PIN auth surface. |
| EC-DORG-002 | P1 | depth_spec_conflict | §10 API Expectations, handler directory | **Duplicate handler sets create route conflicts.** Old handlers (e.g. `createOrganization.ts`, `createMember.ts`) coexist with new `DentalOrganizationManagement_create.ts`, `DentalMembershipManagement_create.ts` facades. MODULE_SPEC has no documentation of the migration state. Route conflicts or double-registration are likely. This is structurally identical to the imaging module problem (EC-DIMG-001). |

#### P2 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DORG-003 | P2 | depth_missing_signatures | §10 API Expectations + API_CONTRACTS | **15+ implemented handlers have no spec coverage.** In addition to 6 PIN handlers: `getBranchesByUser`, `getOrgContext`, `branchSettings` (legacy), `consentTemplates` (legacy), `setSecurityQuestion` are live with no endpoint documentation in MODULE_SPEC or API_CONTRACTS. |
| EC-DORG-004 | P2 | depth_empty_section | §10, PIN endpoints | **Security question endpoint (`setSecurityQuestion`) has no spec basis.** No workflow, business rule, acceptance criteria, or API expectation mentions a security question feature. This endpoint is a spec orphan with potential security implications (recoverable credentials, security question answer storage). |

---

### 7. dental-patient

**Size:** 323 lines | **Implementation:** 82 total files, 53 non-test handlers | **Status:** Fully implemented + massive extensions

**Sections present:** All 21

**API coverage:** MODULE_SPEC §10 lists 10 endpoints. API_CONTRACTS documents 10 endpoints. Implementation has 53 non-test handlers.

**Ratio: 53 implemented vs 10 documented = 81% of implemented handlers are unspecced**

**Unspecced handlers (not in MODULE_SPEC §10 or API_CONTRACTS):**
- `createClaimDraft`, `getClaimReadiness`, `listPatientClaims`, `updateClaimStatus` — entire claims sub-module (4 handlers)
- `createInsuranceProfile`, `listPatientInsuranceProfiles`, `updateInsuranceProfile` — insurance sub-module (3 handlers)
- `createTask`, `listPatientTasks`, `updateTask` — task sub-module (3 handlers)
- `createSyncLog`, `listSyncLogs`, `updateSyncLog` — sync log sub-module (3 handlers)
- `createDentalAlert`, `listDentalAlerts`, `updateDentalAlert` — dental alerts sub-module (3 handlers)
- `createTreatmentPlan`, `getTreatmentPlan`, `getTreatmentPlanVersion`, `listPatientTreatmentPlans`, `updateTreatmentPlan`, `acceptTreatmentPlan` — treatment plan sub-module (6 handlers; ownership conflicts with dental-visit)
- `createPatientContact`, `listPatientContacts`, `updatePatientContact`, `deletePatientContact` — contacts sub-module (4 handlers)
- `listPatientConditions` — conditions endpoint
- `listPatientVisits` — visit list endpoint (dental-visit owns visits)
- `initializeDentition` — MODULE_SPEC §10 doesn't list this; prior analysis found it routes to `/dental/patients/:patientId/dentition` (EC-DVIS-6c9d1a38 in dental-visit report)

#### P1 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DPAT-001 | P1 | depth_spec_conflict | §10 API Expectations, dental-visit MODULE_SPEC | **Treatment plan ownership conflict between dental-patient and dental-visit.** `dental-patient` implements `createTreatmentPlan`, `getTreatmentPlan`, `getTreatmentPlanVersion`, `listPatientTreatmentPlans`, `updateTreatmentPlan`, `acceptTreatmentPlan` (6 handlers). dental-visit MODULE_SPEC also claims treatment plan ownership (§10: `acceptTreatmentPlan`; §2: TreatmentPlan is a dental-visit entity). Neither MODULE_SPEC §10 for dental-patient nor dental-visit explicitly resolves this conflict. Enforcement agents testing treatment plan operations will find duplicate routes and ambiguous ownership. |
| EC-DPAT-002 | P1 | depth_missing_signatures | §10 API Expectations + API_CONTRACTS | **43 of 53 handlers (81%) are not in any spec.** The documented API surface (10 endpoints) is less than one-fifth of the implemented surface (53 handlers). Claims, insurance, tasks, sync logs, dental alerts, treatment plans, contacts, conditions, visit list, dentition — all are live in production without spec coverage. Enforcement cannot validate these handlers. |

#### P2 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DPAT-003 | P2 | depth_missing_sections | §10, dental-clinical MODULE_SPEC | **Sync log handlers may belong to dental-clinical or a separate sync module.** `createSyncLog`, `listSyncLogs`, `updateSyncLog` live in dental-patient but the IDEAL standard §3.13 and dental-patient MODULE_SPEC §2 both define sync as a cross-cutting concern. These 3 handlers are unspecced and may be misplaced. |
| EC-DPAT-004 | P2 | depth_missing_sections | §10 | **Claims/insurance sub-module in dental-patient conflicts with IDEAL standard.** IDEAL §3.9 places claims/insurance as a distinct context. The 7 claims and insurance handlers embedded in dental-patient create a boundary violation with no spec rationale. |

---

### 8. dental-perio

**Size:** 306 lines | **Implementation:** 12 total files, 6 non-test handlers | **Status:** Implemented (Phase 2)

**Sections present:** 20/21 (missing §20 AI Instructions only)

**API coverage:** MODULE_SPEC §10 lists 5 endpoints. API_CONTRACTS documents 5 endpoints. Implementation has 6 non-test handlers (5 specced + `utils/perio-validation.ts`).

**Assessment: BEST-SPECCED module. All 5 API endpoints are specced and implemented. No duplicate handlers.**

#### P2 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DPER-001 | P2 | depth_empty_section | §20 | **§20 AI Instructions section absent.** All other fully-specced modules include §20 AI Instructions. dental-perio spec ends at §19. Missing AI guidance for: loose coupling rules, assertBranchRole enforcement location, visit lock check pattern. Low risk since module is well-specced otherwise. |
| EC-DPER-002 | P2 | depth_tbd_marker | §5 BR-P07, §13 | **Primary dentition minimum reading count inconsistency.** §5 BR-P07 says minimum 16/32 for completion. §13 Edge Cases says "Primary dentition (tooth 51-85): 20 teeth, min 8/20 for completion." These are two different minimum thresholds for a single business rule. Enforcement will produce conflicting results depending on which section is tested. |

---

### 9. dental-pmd

**Size:** 160 lines | **Implementation:** 13 total files, 7 non-test handlers | **Status:** Implemented

**Sections present:** 20/21 (missing §4 Workflow Details; has §7.1 and §7.2 extra detail)

**API coverage:** MODULE_SPEC §10 lists 5 endpoints. API_CONTRACTS documents 5 endpoints. Implementation has 7 non-test handlers.

**Unspecced handlers:**
- `exportPMD` — MODULE_SPEC §10 has `GET /dental/pmd/:id/download`; this may be the same endpoint with a different name
- `getPMDForVisit` — not in §10 or API_CONTRACTS (§10 has list by patientId, not by visitId)
- `listImportedPMDs` — §10 has only `GET /dental/pmd/imported/:id` (single get), not list

#### P2 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DPMD-001 | P2 | depth_empty_section | §4 Workflow Details | **§4 Workflow Details absent.** WF-021, WF-022, WF-066 are declared in §3 but have no step-by-step details in §4. The spec has §7.1 (Data Scope) and §7.2 (Import Contract) which partially compensate for PMD generation, but WF-022 (Import) and WF-066 (Download) have no detailed step flows. |
| EC-DPMD-002 | P2 | xref_endpoint_missing | §10 API Expectations + API_CONTRACTS | **3 implemented handlers not in spec.** `getPMDForVisit` (get by visitId, not patientId), `listImportedPMDs` (list all vs single get), and `exportPMD` (may alias the download endpoint) are live in production without spec coverage. |
| EC-DPMD-003 | P2 | depth_tbd_marker | §13 Edge Cases | **Multiple-PMD-per-visit edge case unresolved.** §13 states "Multiple PMDs per visit (re-generate) → allowed, creates new version [VERIFY]". The `[VERIFY]` marker indicates this is undecided. Enforcement cannot determine whether `generatePMD` for an existing PMD should 409 or create a new version. |

---

### 10. dental-scheduling

**Size:** 183 lines | **Implementation:** 25 total files, 12 non-test handlers | **Status:** Fully implemented

**Sections present:** All 21

**API coverage:** MODULE_SPEC §10 lists 5 endpoints. API_CONTRACTS documents 5 endpoints. Implementation has 12 non-test handlers.

**Unspecced handlers:**
- `createQueueItem` — not in §10 or API_CONTRACTS (spec explicitly says no standalone queue entity)
- `listQueueBoard` — not in §10 or API_CONTRACTS
- `updateQueueItemStatus` — not in §10 or API_CONTRACTS
- `workingHours` — working hours endpoint is in dental-org (WF-026), not dental-scheduling §10
- `getAppointment` — not in API_CONTRACTS (only list documented)

#### P1 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DSCH-001 | P1 | depth_spec_conflict | §8 State Transitions (IDEAL-GAP-P2-011), createQueueItem.ts | **QueueItem handlers contradict MODULE_SPEC §8.** MODULE_SPEC §8 explicitly states: "No standalone `dental_queue_item` table exists; queue state is derived from appointment + visit status." Yet `createQueueItem.ts`, `listQueueBoard.ts`, `updateQueueItemStatus.ts` implement a standalone queue. This directly contradicts the documented architectural decision. The spec says one thing; the code does the opposite. |

#### P2 Findings

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DSCH-002 | P2 | depth_missing_signatures | §10 API Expectations + API_CONTRACTS | **5 of 12 handlers (42%) not in spec.** `createQueueItem`, `listQueueBoard`, `updateQueueItemStatus`, `workingHours`, `getAppointment` are live in production without API documentation. |
| EC-DSCH-003 | P2 | depth_tbd_marker | §14 Dependencies, §10 | **Working hours endpoint in wrong module.** `workingHours.ts` in dental-scheduling implements a working hours endpoint. MODULE_SPEC §14 Dependencies lists `dental-org (working hours)` as a dependency — i.e., dental-scheduling READS working hours from dental-org, it does not OWN them. WF-026 (configure branch hours) is owned by dental-org. Placing a working hours handler in dental-scheduling is a boundary violation. |

---

### 11. dental-visit

**Size:** 218 lines | **Implementation:** 59 total files, 28 non-test handlers | **Status:** Fully implemented

> **Full analysis in prior ENFORCEMENT_COVERAGE.md run.** Summary reproduced here for completeness.

**Sections present:** All 21 | **Quality-adjusted depth score:** 73%

#### P1 Findings (reproduced from prior run)

| ID | Severity | Check Type | Location | Description |
|----|----------|-----------|----------|-------------|
| EC-DVIS-a4b8c3d1 | P1 | depth_spec_conflict | §5 BR-008 | BR-008 says carry-over is "visual only" but code persists DB rows. |
| EC-DVIS-f2e19a7c | P1 | xref_endpoint_missing | API_CONTRACTS.md line 11 | Visit FSM: API_CONTRACTS says `scheduled`; code uses `draft`. |
| EC-DVIS-6c9d1a38 | P1 | xref_endpoint_missing | §10 + API_CONTRACTS | Dentition endpoint path mismatch: spec shows `/visits/:id/initialize-dentition`, code routes to `/patients/:patientId/dentition`. |

---

## Cross-Module Issues

### Unresolved Module Boundary Violations

| ID | Modules | Description |
|----|---------|-------------|
| CMI-001 | dental-patient + dental-visit | Treatment plan ownership conflict — both modules claim ownership via their handler sets. No spec resolves this. |
| CMI-002 | dental-clinical + IDEAL §3.11 | Inventory sub-module (5 handlers) lives inside dental-clinical with no spec rationale. IDEAL standard places inventory as a separate module. |
| CMI-003 | dental-scheduling + dental-org | `workingHours.ts` in dental-scheduling owns a resource that MODULE_SPEC assigns to dental-org. |
| CMI-004 | dental-patient + IDEAL §3.9 | Claims/insurance (7 handlers) embedded in dental-patient. IDEAL places these in a separate Claims/Insurance context. |

### Facade Migration Incomplete

Three modules (dental-org, dental-imaging, and prior work on dental-billing) are in a mid-migration state where both old handlers and new `*Mgmt_*` facade handlers coexist:

| Module | Old Handlers | Facade Handlers | Risk |
|--------|-------------|-----------------|------|
| dental-org | 24 non-facade | 11 facade | Route conflicts possible |
| dental-imaging | 14 non-facade | 21 facade | Route conflicts likely |

---

## Enforcement Manifest

| Module | Spec Lines | Sections | Implemented Handlers | Documented Endpoints | Spec Gap (handlers) | P1 | P2 | P3 |
|--------|-----------|----------|---------------------|---------------------|--------------------|----|----|----|
| dental-audit | 101 | 16/21 | 1 | 1 | 0 | 3 | 2 | 0 |
| dental-billing | 221 | 21/21 | 15 | 8 | 7 | 1 | 3 | 0 |
| dental-clinical | 228 | 21/21 | 30 | 10 | 20+ | 1 | 3 | 0 |
| dental-emr-integration | 96 | 14/21 | 0 | 3 | N/A | 0 | 0 | 1 |
| dental-imaging | 218 | 21/21 | 34 | 9 | 25+ | 1 | 3 | 0 |
| dental-org | 347 | 21/21 | 36 | 9 | 27+ | 2 | 2 | 0 |
| dental-patient | 323 | 21/21 | 53 | 10 | 43 | 2 | 2 | 0 |
| dental-perio | 306 | 20/21 | 6 | 5 | 1 | 0 | 2 | 0 |
| dental-pmd | 160 | 20/21 | 7 | 5 | 3 | 0 | 3 | 0 |
| dental-scheduling | 183 | 21/21 | 12 | 5 | 5 | 1 | 2 | 0 |
| dental-visit | 218 | 21/21 | 28 | 12 | 8 | 3 | 8 | 2 |
| **TOTAL** | — | — | **222** | **77** | **145** | **14** | **30** | **3** |

> Of 222 implemented non-test handlers across all 11 active modules, only 77 (35%) have matching API_CONTRACTS documentation. 145 handlers (65%) are implemented with no spec coverage.

---

## Routing Decision by Module

| Module | Coverage Score | Routing |
|--------|----------------|---------|
| dental-audit | 52% | **DO NOT ENFORCE** — Fix EC-DAUD-001, EC-DAUD-002, EC-DAUD-003 first |
| dental-billing | 72% | **ENFORCE WITH CAUTION** — Fix EC-DBIL-001 (status mismatch) first |
| dental-clinical | 68% | **DO NOT ENFORCE** — Fix EC-DCLI-001 first; add 20+ endpoints to spec |
| dental-emr-integration | N/A | **SKIP** — Future phase |
| dental-imaging | 61% | **DO NOT ENFORCE** — Fix EC-DIMG-001 (duplicate handlers) first |
| dental-org | 64% | **DO NOT ENFORCE** — Fix EC-DORG-001 (PIN endpoints) + EC-DORG-002 (duplicates) first |
| dental-patient | 55% | **DO NOT ENFORCE** — Fix EC-DPAT-001 (ownership conflict) + expand spec |
| dental-perio | 90% | **PROCEED TO `/oli-enforce-all`** — Fix EC-DPER-002 first |
| dental-pmd | 82% | **PROCEED TO `/oli-enforce-all`** — Fix EC-DPMD-003 first |
| dental-scheduling | 75% | **ENFORCE WITH CAUTION** — Fix EC-DSCH-001 (queue contradiction) first |
| dental-visit | 89% | **ENFORCE WITH CAUTION** — Fix EC-DVIS-a4b8c3d1, EC-DVIS-f2e19a7c, EC-DVIS-6c9d1a38 first |

---

## Prioritized Pre-Enforcement Fix List

### Priority 0 — Fix Before ANY Enforcement (Blockers)

1. **EC-DAUD-001** — Fix `getAuditEvents.ts` role check from `admin` to `dentist_owner`
2. **EC-DAUD-002** — Register audit endpoint at `/dental/audit-events`, not `/dental/admin/audit`
3. **EC-DAUD-003** — Implement pg-boss consumer for writing audit events (WF-096)
4. **EC-DCLI-001** — Resolve `updateMedicalHistoryEntry` vs append-only spec rule (AC-CLI-005 fails)
5. **EC-DIMG-001** — Complete facade migration in dental-imaging; remove old duplicate handlers
6. **EC-DORG-001** — Add PIN endpoints to MODULE_SPEC §10 and API_CONTRACTS.md
7. **EC-DORG-002** — Complete facade migration in dental-org; remove old duplicate handlers
8. **EC-DPAT-001** — Resolve treatment plan module ownership (dental-patient vs dental-visit)
9. **EC-DSCH-001** — Resolve QueueItem: either update MODULE_SPEC §8 to document standalone queue table, or remove the 3 queue handlers
10. **EC-DBIL-001** — Fix API_CONTRACTS header: `sent` → `issued` for invoice FSM

### Priority 1 — Fix Before Individual Module Enforcement

11. **EC-DVIS-a4b8c3d1** — Fix BR-008 carry-over spec
12. **EC-DVIS-f2e19a7c** — Fix API_CONTRACTS visit FSM initial state: `scheduled` → `draft`
13. **EC-DVIS-6c9d1a38** — Fix dentition endpoint path in both spec and API_CONTRACTS
14. **EC-DIMG-004** — Resolve ceph landmark delete vs SM-02 immutability
15. **EC-DPER-002** — Resolve primary dentition minimum reading count (BR-P07 vs §13 conflict)
16. **EC-DPMD-003** — Resolve multiple PMD per visit [VERIFY] marker

### Priority 2 — Spec Expansion (improve breadth coverage)

17. Add 20+ unspecced dental-clinical endpoints to MODULE_SPEC §10 and API_CONTRACTS
18. Add 43+ unspecced dental-patient endpoints to MODULE_SPEC §10 and API_CONTRACTS
19. Add 27+ unspecced dental-org endpoints (especially PIN) to MODULE_SPEC §10 and API_CONTRACTS
20. Add 25+ unspecced dental-imaging endpoints to MODULE_SPEC §10 and API_CONTRACTS
21. Resolve cross-module boundary violations (CMI-001 through CMI-004)

---

## What's Next

**2 modules ready for enforcement:** `dental-perio` and `dental-pmd` (after resolving their P2 findings).

**For all other active modules:** Run spec backfill before enforcement. The pattern is consistent across 9 modules — implementation has outpaced spec documentation by a 3:1 ratio (222 handlers vs 77 documented endpoints).

Pipeline position: `/oli-module-specs` → **`/oli-enforce-coverage` ← YOU ARE HERE** → `/oli-enforce-all`

Use `/oli-module-specs --module <name>` to expand each module spec before re-running enforcement.
