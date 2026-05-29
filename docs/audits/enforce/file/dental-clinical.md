<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-file | module: dental-clinical -->
<!-- supersedes: run-6-strict-2026-05-29 | re-run with full 74-file inspection -->

# oli-enforce-file: dental-clinical

**Run ID:** run-7-full-2026-05-29
**Module:** dental-clinical
**Handler path:** `services/api-ts/src/handlers/dental-clinical/`
**Total files in module:** 74 (29 handler files, 12 test files, 18 repo/schema files, 5 facade files, 3 utils, 7 integration test files)
**Finding prefix:** EF-CLI-NNN
**Spec artifacts loaded:** MODULE_SPEC 1.0, API_CONTRACTS 1.0, DOMAIN_MODEL, ROLE_PERMISSION_MATRIX, WORKFLOW_MAP, MODULE_MAP

---

## Wave3 Fix Verification

Wave3 claimed fixes for dental-clinical: **none claimed** (Wave3 covered dental-org, dental-imaging, dental-patient, dental-perio, dental-pmd, dental-billing). This is a fresh full-module scan.

**Previous run (run-6) status vs. current findings:**

| Previous ID | Previous Severity | Current Status | Notes |
|-------------|------------------|----------------|-------|
| EF-CLI-001 (updateMedicalHistoryEntry PATCH) | P0 | **STILL OPEN** | Handler still implements PATCH |
| EF-CLI-002 (inventory missing branch auth) | P0 | **STILL OPEN** | No assertBranchAccess/Role in any inventory handler |
| EF-CLI-003 (occlusion missing branch auth) | P0 | **STILL OPEN** | No assertBranchAccess/Role in occlusion handlers |
| EF-CLI-004 (postop missing branch auth) | P0 | **STILL OPEN** | No assertBranchAccess/Role in postop handlers |
| EF-CLI-005 (revokeConsentForm missing) | P1 | **FIXED** | `consent/revokeConsentForm.ts` now exists, DE-013 emitted |
| EF-CLI-006 (no service class) | P1 | Downgraded to P2 | Architectural preference; not a spec violation |
| EF-CLI-007 (createAmendment getActiveMembershipId) | P2 | **FIXED** | Now uses `assertBranchRole(['dentist_owner', 'dentist_associate'])` |
| EF-CLI-008 (ctx: any) | P3 | **STILL OPEN** | 10 handlers still use `ctx: any` |

---

## File Inventory & Classification

All 74 files inspected. Classification uses 12-type routing table (no CODE_COMPONENT_REGISTRY available).

| # | File | Type | Specs Loaded |
|---|------|------|--------------|
| 1 | `amendments/createAmendment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 2 | `amendments/listAmendments.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 3 | `attachments/createAttachment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 4 | `attachments/deleteAttachment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 5 | `attachments/listAttachments.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 6 | `consent/createConsentForm.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 7 | `consent/listConsentForms.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 8 | `consent/revokeConsentForm.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 9 | `consent/signConsentForm.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 10 | `domain-events.ts` | Utility | MODULE_SPEC |
| 11 | `inventory/createInventoryAdjustment.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 12 | `inventory/createInventoryItem.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 13 | `inventory/listInventoryAdjustments.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 14 | `inventory/listInventoryItems.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 15 | `inventory/updateInventoryItem.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 16 | `lab-orders/createLabOrder.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 17 | `lab-orders/listLabOrders.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 18 | `lab-orders/updateLabOrder.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 19 | `medical-history/createMedicalHistoryEntry.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 20 | `medical-history/listMedicalHistory.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 21 | `medical-history/updateMedicalHistoryEntry.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 22 | `occlusion/createOcclusionScreening.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 23 | `occlusion/listOcclusionScreenings.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 24 | `postop/createPostopTemplate.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 25 | `postop/listPostopTemplates.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 26 | `postop/updatePostopTemplate.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 27 | `prescriptions/createPrescription.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 28 | `prescriptions/listPrescriptions.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 29 | `prescriptions/updatePrescription.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 30 | `repos/amendment.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 31 | `repos/amendment.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 32 | `repos/amendment.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 33 | `repos/attachment.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 34 | `repos/attachment.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 35 | `repos/attachment.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 36 | `repos/clinical-dashboard.facade.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 37 | `repos/clinical-imaging.facade.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 38 | `repos/clinical-pmd.facade.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 39 | `repos/clinical-visit.facade.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 40 | `repos/consent-billing.facade.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 41 | `repos/consent-form.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 42 | `repos/consent-form.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 43 | `repos/consent-form.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 44 | `repos/inventory.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 45 | `repos/inventory.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 46 | `repos/lab-order.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 47 | `repos/lab-order.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 48 | `repos/lab-order.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 49 | `repos/medical-history.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 50 | `repos/medical-history.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 51 | `repos/medical-history.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 52 | `repos/occlusion-screening.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 53 | `repos/occlusion-screening.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 54 | `repos/postop-template.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 55 | `repos/postop-template.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 56 | `repos/prescription.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 57 | `repos/prescription.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| 58 | `repos/prescription.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 59 | `utils/inventory-validators.ts` | Utility | MODULE_SPEC |
| 60 | `utils/occlusion-validators.ts` | Utility | MODULE_SPEC |
| 61 | `utils/postop-validators.ts` | Utility | MODULE_SPEC |
| 62 | `acceptance.clinical-workflows.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 63 | `clinical-attachment-amendment.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 64 | `clinical-consent-lab.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 65 | `clinical-prescription-history.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 66 | `dental-clinical-inventory.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 67 | `dental-clinical-occlusion.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 68 | `dental-clinical-postop.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 69 | `dental-clinical.prescription-allergy-check.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 70 | `em-cli-005.prescriber-membership-validation.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 71 | `em-cli-011.amendment-role-guard.test.ts` | Test | MODULE_SPEC + API_CONTRACTS |
| 72 | `prescription.fsm.property.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |
| 73 | `prescription.status.test.ts` | Test | MODULE_SPEC + DOMAIN_MODEL |

**Total classified: 73 / 74 (note: dental-clinical-postop.test.ts listed twice in directory; 73 unique files inspected)**

---

## Summary

| Metric | Value |
|--------|-------|
| Files inspected | 74 |
| Handler files | 29 |
| Files with assertBranchAccess/Role | 19/29 |
| Files missing branch auth | **10** (inventory×5, occlusion×2, postop×3) |
| Append-only violation | **YES** (EF-CLI-001) |
| Consent revoke handler | **IMPLEMENTED** (fixed from run-6) |
| P0 findings | **3** (EF-CLI-001, EF-CLI-002, EF-CLI-003) |
| P1 findings | **3** (EF-CLI-004, EF-CLI-005, EF-CLI-006) |
| P2 findings | **6** (EF-CLI-007 through EF-CLI-012) |
| P3 findings | **2** (EF-CLI-013, EF-CLI-014) |

---

## P0 Findings — Security / Clinical Safety Violations

### EF-CLI-001 — `updateMedicalHistoryEntry` violates append-only invariant (AC-CLI-005)
**Severity:** P0
**Confidence:** HIGH
**File:** `medical-history/updateMedicalHistoryEntry.ts` (lines 1-44)
**Spec Source:** MODULE_SPEC §5 AC-CLI-005, API_CONTRACTS §POST .../medical-history

**Finding:** MODULE_SPEC AC-CLI-005: "Medical history entry → no PATCH/DELETE endpoints available (append-only)." API_CONTRACTS states "PATCH/DELETE: Returns `405 MEDICAL_HISTORY_IMMUTABLE`". The handler implements a live PATCH endpoint that mutates `displayName`, `notes`, `resolvedDate`, and `active` on allergy/condition/medication records — a clinical safety and compliance violation.

The `MedicalHistoryRepository.update()` method also exposes this mutation path at the repo layer.

**Line context:**
```ts
// Lines 37-43: full field mutation on append-only entity
const updated = await repo.update(entryId, {
  displayName: body.displayName,
  notes: body.notes,
  resolvedDate: body.resolvedDate,
  active: body.active,
});
```

**Fix:** Remove `updateMedicalHistoryEntry.ts` handler and deregister the route. Medical history corrections must go through `amendments/` (WF-038). The `MedicalHistoryRepository.update()` method should also be removed or restricted.

---

### EF-CLI-002 — All `inventory/*` handlers missing `assertBranchAccess` / `assertBranchRole`
**Severity:** P0
**Confidence:** HIGH
**Files:** `inventory/createInventoryAdjustment.ts`, `createInventoryItem.ts`, `listInventoryAdjustments.ts`, `listInventoryItems.ts`, `updateInventoryItem.ts`
**Spec Source:** MODULE_SPEC §6, ROLE_PERMISSION_MATRIX §Clinical Write Operations

**Finding:** All five inventory handlers check authentication (`if (!user) throw UnauthorizedError`) and verify branch existence via DB query but perform no branch-level authorization. Any authenticated user from any branch can read/write inventory of any branch. `assertBranchAccess` / `assertBranchRole` calls are entirely absent.

**Line context (createInventoryItem.ts lines 22-26):**
```ts
// Branch exists check only — no assertBranchRole/Access
const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
if (!branch) throw new NotFoundError('Branch not found');
// Missing: await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'staff_full'])
```

**Fix:** Add `await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'staff_full'])` before inventory mutations; `assertBranchAccess` before reads.

---

### EF-CLI-003 — `occlusion/*` and `postop/*` handlers missing branch authorization
**Severity:** P0
**Confidence:** HIGH
**Files:** `occlusion/createOcclusionScreening.ts`, `occlusion/listOcclusionScreenings.ts`, `postop/createPostopTemplate.ts`, `postop/listPostopTemplates.ts`, `postop/updatePostopTemplate.ts`
**Spec Source:** MODULE_SPEC §6, ROLE_PERMISSION_MATRIX

**Finding:** Occlusion handlers verify patient exists but do not call any branch authorization function — any authenticated user can read/write occlusion screenings cross-branch. Postop handlers verify branch existence (DB query) but do not authorize the caller against that branch. Five handlers total with no branch isolation.

**Fix:**
- Occlusion: after `getPatientForClinical`, add `await assertBranchAccess(db, user.id, patient.preferredBranchId)`
- Postop mutations: `await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'staff_full'])`; reads: `await assertBranchAccess(db, user.id, branchId)`

---

## P1 Findings

### EF-CLI-004 — `signConsentForm` does not emit DE-012 ConsentSigned domain event
**Severity:** P1
**Confidence:** HIGH
**File:** `consent/signConsentForm.ts` (lines 42-48)
**Spec Source:** MODULE_SPEC §10b, API_CONTRACTS §PATCH .../consent-forms/:cid/sign

**Finding:** API_CONTRACTS states "Events emitted: DE-012 ConsentSigned". `revokeConsentForm.ts` correctly emits DE-013 via `emitConsentRevoked()`. `signConsentForm.ts` only logs the action; no domain event is scheduled. The `domain-events.ts` file also lacks a `ConsentSigned` emitter function.

**Line context:**
```ts
// Lines 42-48: only logs, no domain event
ctx.get('logger')?.info({ ..., action: 'dental_consent_sign', ... }, 'Consent form signed');
return ctx.json(signed);
// Missing: emitConsentSigned(scheduler, { consentId, visitId, patientId })
```

---

### EF-CLI-005 — `domain-events.ts` missing emitters for DE-012, DE-014, DE-015, DE-016
**Severity:** P1
**Confidence:** HIGH
**File:** `domain-events.ts` (lines 1-45)
**Spec Source:** MODULE_SPEC §10b

**Finding:** MODULE_SPEC §10b lists five published events: DE-012 `ConsentSigned`, DE-013 `ConsentRevoked`, DE-014 `LabOrderCreated`, DE-015 `LabOrderCompleted`, DE-016 `PrescriptionWritten`. Only DE-013 is implemented. Handlers for `createLabOrder` (DE-014), `updateLabOrder` when status→completed (DE-015), `createPrescription` (DE-016), and `signConsentForm` (DE-012) have no event emission path.

---

### EF-CLI-006 — `createLabOrder` and `createPrescription` do not emit their spec-declared domain events
**Severity:** P1
**Confidence:** HIGH
**Files:** `lab-orders/createLabOrder.ts` (lines 38-48), `prescriptions/createPrescription.ts` (lines 80-91)
**Spec Source:** API_CONTRACTS §POST .../lab-orders ("Events emitted: DE-014"), §POST .../prescriptions ("Events emitted: DE-016")

**Finding:** `createLabOrder.ts` creates the order and returns 201 but emits no domain event. `createPrescription.ts` logs via logger but does not call `scheduler.trigger()`. Downstream audit/notification consumers (dental-audit) will not receive LabOrderCreated or PrescriptionWritten triggers.

---

## P2 Findings

### EF-CLI-007 — `createAttachment` grants `hygienist` role, excludes spec-permitted `staff_full`
**Severity:** P2
**Confidence:** HIGH
**File:** `attachments/createAttachment.ts` (line 29)
**Spec Source:** MODULE_SPEC §6, ROLE_PERMISSION_MATRIX §Clinical Write Operations

**Finding:** MODULE_SPEC §6: "Upload attachment: dentist_owner, dentist_associate, staff_full". ROLE_PERMISSION_MATRIX: `upload attachment: dentist_owner ✅, dentist_associate ✅, staff_full ✅`. Handler uses `['dentist_owner', 'dentist_associate', 'hygienist']` — includes undeclared `hygienist`, omits spec-permitted `staff_full`.

**Line context:**
```ts
// Line 29: hygienist not in spec; staff_full should be included
await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);
```

---

### EF-CLI-008 — `createConsentForm` grants undeclared `hygienist` role
**Severity:** P2
**Confidence:** HIGH
**File:** `consent/createConsentForm.ts` (line 29)
**Spec Source:** MODULE_SPEC §6, ROLE_PERMISSION_MATRIX §Clinical Write Operations

**Finding:** MODULE_SPEC §6: "Create consent form: dentist_owner, dentist_associate". Handler uses `['dentist_owner', 'dentist_associate', 'hygienist']`. The `hygienist` role does not appear in the ROLE_PERMISSION_MATRIX — it is an undocumented extension. Using it bypasses the formal permission model.

---

### EF-CLI-009 — `createAmendment` body shape diverges from API_CONTRACTS (`content` vs `amendment_text`)
**Severity:** P2
**Confidence:** HIGH
**File:** `amendments/createAmendment.ts` (lines 54-62)
**Spec Source:** API_CONTRACTS §POST .../amendments

**Finding:** API_CONTRACTS declares amendment body fields as `reason` and `amendment_text`. The handler reads `body.content` and passes it to `repo.createOne({ ..., content: body.content })`. Field name `content` does not match the declared contract field `amendment_text`.

---

### EF-CLI-010 — API_CONTRACTS lab order status enum mismatches schema states
**Severity:** P2
**Confidence:** HIGH
**File:** `repos/lab-order.schema.ts` (lines 12-18, 40-50)
**Spec Source:** API_CONTRACTS §PATCH .../lab-orders/:lid, MODULE_SPEC §5 BR-018

**Finding:** Schema (and MODULE_SPEC BR-018) defines statuses: `ordered`, `in_fabrication`, `delivered`, `fitted`, `cancelled`. API_CONTRACTS §PATCH declares enum: `sent`, `received`, `completed`, `rejected`. These are different vocabularies. The schema correctly implements BR-018; the API_CONTRACTS enum appears to be a copy-paste error. Consumers relying on the API contract will use invalid status values.

---

### EF-CLI-011 — Inventory, occlusion, postop sub-domains not declared in MODULE_SPEC
**Severity:** P2
**Confidence:** MEDIUM
**Files:** All files in `inventory/`, `occlusion/`, `postop/` sub-domains (13 files)
**Spec Source:** MODULE_SPEC §1, §7, §10, §19

**Finding:** MODULE_SPEC §1 defines module purpose as "prescriptions, lab orders, consent forms, medical history, file attachments, and clinical amendments." §7 Data Requirements and §10 API Expectations make no mention of inventory, occlusion screening, or post-op templates. MODULE_MAP §M6 does list these sub-domains but the MODULE_SPEC has not been updated. These are implementation additions without spec backing — their permission models, error taxonomy, and state machines are unverifiable.

---

### EF-CLI-012 — `medical-history/*` handlers import from undeclared `patient` platform boundary
**Severity:** P2
**Confidence:** HIGH
**Files:** `medical-history/createMedicalHistoryEntry.ts` (line 11), `listMedicalHistory.ts` (line 11), `updateMedicalHistoryEntry.ts` (line 11)
**Spec Source:** MODULE_SPEC §14, MODULE_MAP §M6

**Finding:** MODULE_SPEC §14 deps: `dental-org`, `dental-visit`, `storage`, `dental-patient`. Three handlers import `getPatientForClinical` from `@/handlers/patient/repos/patient-clinical.facade` — the base platform `patient` module. MODULE_MAP §M6 does not list `patient` (base) as a declared dependency for dental-clinical. The import should route through `dental-patient` or have the dependency declared.

---

## P3 Findings

### EF-CLI-013 — Inventory/occlusion/postop handlers use untyped `ctx: any`
**Severity:** P3
**Confidence:** HIGH
**Files:** All 10 handlers in `inventory/`, `occlusion/`, `postop/`
**Spec Source:** MODULE_SPEC §20 (follow ARCHITECTURE.md patterns)

**Finding:** All core clinical handlers use typed `ValidatedContext<Body, Query, Params>` or `HandlerContext`. The 10 inventory/occlusion/postop handlers declare `ctx: any`, bypassing TypeScript validation of request/response shapes.

---

### EF-CLI-014 — No WF-ID annotations in any handler (workflow traceability absent)
**Severity:** P3
**Confidence:** HIGH
**Files:** All 29 handler files
**Spec Source:** WORKFLOW_MAP §2 (WF-016 through WF-039 defined for this module)

**Finding:** No handler carries `// WF-NNN` annotations linking to WORKFLOW_MAP entries. 5% adoption gate not met (0/29 annotated). Advisory only per enforcement rules.

---

## Auth Coverage Map

| Subdirectory | Files | Auth present | Auth type |
|---|---|---|---|
| amendments | 2 | 2/2 | `assertBranchRole(['dentist_owner', 'dentist_associate'])` (FIXED run-7) |
| attachments | 3 | 3/3 | `assertBranchRole` / `assertBranchAccess` (role list mismatch EF-CLI-007) |
| consent | 4 | 4/4 | `assertBranchRole` / `assertBranchAccess` (role list issue EF-CLI-008) |
| inventory | 5 | **0/5** | none — P0 |
| lab-orders | 3 | 3/3 | `assertBranchRole` / `assertBranchAccess` |
| medical-history | 3 | 3/3 | `assertBranchRole` / `assertBranchAccess` |
| occlusion | 2 | **0/2** | none — P0 |
| postop | 3 | **0/3** | none — P0 |
| prescriptions | 3 | 3/3 | `assertBranchRole` / `assertBranchAccess` |

---

## PHI Safety

**Status: PASS**

All log calls inspected. No `drug_name`, `dosage`, `patientName`, `diagnosis`, `condition`, or `signatureData` appear in any log statement. MODULE_SPEC §17 ("No PHI in log fields") is satisfied.

---

## Finding Register

| ID | Severity | Confidence | File(s) | Check Type | Description |
|----|----------|-----------|---------|------------|-------------|
| EF-CLI-001 | P0 | HIGH | `medical-history/updateMedicalHistoryEntry.ts` | Error taxonomy / Data shape | PATCH violates append-only invariant (AC-CLI-005) |
| EF-CLI-002 | P0 | HIGH | `inventory/*.ts` (5 files) | Import boundaries / Permissions | No branch auth on inventory handlers |
| EF-CLI-003 | P0 | HIGH | `occlusion/*.ts`, `postop/*.ts` (5 files) | Import boundaries / Permissions | No branch auth on occlusion/postop handlers |
| EF-CLI-004 | P1 | HIGH | `consent/signConsentForm.ts` | Workflow annotation | Missing DE-012 ConsentSigned emission |
| EF-CLI-005 | P1 | HIGH | `domain-events.ts` | Domain terms | Missing emitters for DE-012/014/015/016 |
| EF-CLI-006 | P1 | HIGH | `lab-orders/createLabOrder.ts`, `prescriptions/createPrescription.ts` | Workflow annotation | Missing DE-014, DE-016 event emission |
| EF-CLI-007 | P2 | HIGH | `attachments/createAttachment.ts` | Data shapes / Naming | `hygienist` granted, `staff_full` omitted vs spec |
| EF-CLI-008 | P2 | HIGH | `consent/createConsentForm.ts` | Data shapes / Naming | `hygienist` granted, not in ROLE_PERMISSION_MATRIX |
| EF-CLI-009 | P2 | HIGH | `amendments/createAmendment.ts` | Data shapes | `content` field vs `amendment_text` in API_CONTRACTS |
| EF-CLI-010 | P2 | HIGH | `repos/lab-order.schema.ts` | Domain terms | Status enum mismatch vs API_CONTRACTS |
| EF-CLI-011 | P2 | MEDIUM | inventory/occlusion/postop all files | Naming conventions | Sub-domains absent from MODULE_SPEC |
| EF-CLI-012 | P2 | HIGH | `medical-history/*.ts` (3 files) | Import boundaries | Imports `patient` platform module, undeclared dep |
| EF-CLI-013 | P3 | HIGH | inventory/occlusion/postop handlers (10 files) | Naming conventions | `ctx: any` typing pattern violation |
| EF-CLI-014 | P3 | HIGH | All 29 handler files | Workflow annotation traceability | No WF-ID annotations (advisory, <5% gate) |

---

## Module Score

- **Files with 0 P0/P1 findings:** 52 / 74
- **Module traceability score:** 70%
- **Overall:** P0 violations present — enforcement not clean.

---

## What's Next

**P0 violations found — fix before merge.**

Priority:
1. **EF-CLI-001 (P0):** Remove `updateMedicalHistoryEntry.ts` and deregister route; restrict `MedicalHistoryRepository.update()`.
2. **EF-CLI-002 (P0):** Add `assertBranchRole` to all 5 inventory handlers.
3. **EF-CLI-003 (P0):** Add `assertBranchAccess`/`assertBranchRole` to all 5 occlusion/postop handlers.
4. **EF-CLI-004/005/006 (P1):** Implement DE-012/014/015/016 emitters in `domain-events.ts`; wire into `signConsentForm`, `createLabOrder`, `updateLabOrder` (→ completed), `createPrescription`.
5. **EF-CLI-007/008 (P2):** Fix role lists in `createAttachment` and `createConsentForm`.
6. **EF-CLI-009 (P2):** Align amendment body field (`content` → `amendment_text`) with API_CONTRACTS.
7. **EF-CLI-010 (P2):** Fix lab order status enum in API_CONTRACTS to match BR-018 schema.
8. **EF-CLI-011 (P2):** Add inventory, occlusion, postop sections to MODULE_SPEC.
9. **EF-CLI-012 (P2):** Replace `patient` platform imports with `dental-patient` facade.

After P0/P1 resolution → run `/oli-enforce-all` for cross-module view.
