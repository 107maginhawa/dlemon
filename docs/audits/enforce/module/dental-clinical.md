<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-module | run: 7 -->
<!-- module: dental-clinical | wave3-sprint: enforce-fix Wave3 claimed to close all P0s -->

# Enforcement Report: dental-clinical

**Run:** 7 | **Date:** 2026-05-29 | **Auditor:** oli-enforce-module v1.1
**Spec:** `docs/product/modules/dental-clinical/MODULE_SPEC.md` (v1.0, 2026-05-24)
**Source:** `services/api-ts/src/handlers/dental-clinical/`
**TypeSpec:** `specs/api/src/modules/dental-clinical.tsp` (authoritative contract)

---

## Compliance Score

| Dimension | Score (0-10) | Notes |
|-----------|:---:|-------|
| Public API Completeness | 8 | All spec endpoints exist; revoke route missing from TypeSpec |
| Workflow Implementation | 6 | WF-017 (lab email), WF-018 (patient link) partially absent |
| Domain Term Consistency | 7 | in_fabrication consistent; consent status model diverges from spec §7 |
| State Machine Enforcement | 5 | BR-003 missing in 3 handlers; signed→revoked transition not blocked |
| Event Publishing | 3 | Only DE-013 implemented; DE-012/014/015/016 absent |
| **OVERALL** | **58/100** | P0s present — capped at 58 |

**v1_status:** PARTIAL
**service_layer_status:** PRESENT (repos used; no separate service class layer — repo pattern directly in handlers, consistent with project convention)

---

## Findings (18 total: P0=5, P1=5, P2=5, P3=3)

---

### P0 Findings (Fix immediately — block all new work)

---

#### EM-CLI-7e8a61cb | P0 | BR-003 Guard Missing: createPrescription

**Title:** `createPrescription` writes to locked/completed visits without guard (BR-003)

**Description:** `createPrescription` calls `getVisitOrThrow()` (which only checks existence, not status) and `assertBranchRole()`, then immediately creates the prescription. No check for `visit.status === 'completed' || 'locked'`. Only `createLabOrder` correctly implements the visit immutability guard. Spec BR-003: "422 on write to locked visit."

**File:** `services/api-ts/src/handlers/dental-clinical/prescriptions/createPrescription.ts`
**Spec Section:** §5 BR-003, §11 AC-CLI-006, §15 VISIT_IMMUTABLE
**Confidence:** HIGH

**Fix:** Add `if (visit.status === 'completed' || visit.status === 'locked') { throw new BusinessLogicError(..., 'VISIT_IMMUTABLE'); }` after the `getVisitOrThrow` call, mirroring `createLabOrder.ts:35-39`.

---

#### EM-CLI-bd7bc565 | P0 | BR-003 Guard Missing: createConsentForm

**Title:** `createConsentForm` writes to locked/completed visits without guard (BR-003)

**Description:** `createConsentForm` has no visit status check before persisting the consent form. The handler runs `getVisitOrThrow` + `assertBranchRole` then calls `repo.createOne()` unconditionally. Completed-visit consent creation should return 422 VISIT_IMMUTABLE.

**File:** `services/api-ts/src/handlers/dental-clinical/consent/createConsentForm.ts`
**Spec Section:** §5 BR-003, §11 AC-CLI-006
**Confidence:** HIGH

**Fix:** Same pattern as `createLabOrder` — check `visit.status` after retrieving the visit.

---

#### EM-CLI-e7fc720a | P0 | BR-003 Guard Missing: createAttachment

**Title:** `createAttachment` writes to locked/completed visits without guard (BR-003)

**Description:** `createAttachment` performs branch authorization but does not guard against locked visit writes. Attachment uploads to a completed visit persist without error.

**File:** `services/api-ts/src/handlers/dental-clinical/attachments/createAttachment.ts`
**Spec Section:** §5 BR-003, §11 AC-CLI-006
**Confidence:** HIGH

**Note:** Edge case per §13: "Lab order completed after visit locked is allowed." Attachments have no such exception — they must be blocked.

**Fix:** Add visit status guard post `getVisitOrThrow`.

---

#### EM-CLI-6ff99c36 | P0 | State Machine Violation: Signed Consent Can Be Revoked

**Title:** Signed consent form is not guarded from revocation (BR-014 state machine)

**Description:** Spec §8 declares `ConsentForm: pending → signed → (immutable after signed, BR-014)` and separately `pending → revoked`. A signed consent form must not be revocable. However:
- `revokeConsentForm.ts` only checks `existing.revoked` — it does NOT check `existing.signed`
- `consent-form.repo.revoke()` WHERE clause: `eq(consentForms.revoked, false)` — no `signed` check
- A signed form will pass both checks and be revoked, enabling the illegal transition `signed → revoked`

**File:** `services/api-ts/src/handlers/dental-clinical/consent/revokeConsentForm.ts` (line 44), `services/api-ts/src/handlers/dental-clinical/repos/consent-form.repo.ts` (line 66)
**Spec Section:** §8 State Transitions, §5 BR-014
**Confidence:** HIGH

**Fix:** In `revokeConsentForm.ts` add: `if (existing.signed) { throw new ConflictError('Signed consent form is immutable and cannot be revoked'); }`. Also add `eq(consentForms.signed, false)` to the repo `revoke()` WHERE clause as defense-in-depth.

---

#### EM-CLI-ba65c348 | P0 | Permission Mismatch: createAttachment Uses Wrong Role

**Title:** `createAttachment` grants `hygienist` role instead of `staff_full` (MODULE_SPEC §6 + ROLE_PERMISSION_MATRIX)

**Description:** MODULE_SPEC §6: "Upload attachment: dentist_owner, dentist_associate, staff_full." ROLE_PERMISSION_MATRIX line 65: "Upload attachment (staff_full = allowed)". Code at `createAttachment.ts:34`: `assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist'])`. The `hygienist` role is not declared in this permission; `staff_full` is missing.

**File:** `services/api-ts/src/handlers/dental-clinical/attachments/createAttachment.ts` (line 34)
**Spec Section:** §6 Permissions, ROLE_PERMISSION_MATRIX Clinical Write Operations
**Confidence:** HIGH

**Fix:** Replace `'hygienist'` with `'staff_full'` in the `assertBranchRole` call. Verify if `hygienist` should be granted separately via a ROLE_PERMISSION_MATRIX update.

---

### P1 Findings (Fix before any new work)

---

#### EM-CLI-7df05775 | P1 | Domain Event DE-012 ConsentSigned Not Emitted

**Title:** `signConsentForm` does not emit DE-012 ConsentSigned

**Description:** MODULE_SPEC §10b: "Published: DE-012 ConsentSigned." `domain-events.ts` only defines `CONSENT_REVOKED` (DE-013) and has no `ConsentSigned` event type. `signConsentForm.ts` logs INFO but emits no domain event. Consumers of DE-012 (e.g., treatment-gating workflows) will never be notified of consent signature.

**File:** `services/api-ts/src/handlers/dental-clinical/consent/signConsentForm.ts`, `services/api-ts/src/handlers/dental-clinical/domain-events.ts`
**Spec Section:** §10b Domain Events
**Confidence:** HIGH

**Fix:** Add `emitConsentSigned()` to `domain-events.ts` and call it from `signConsentForm.ts` post-signature, mirroring the `emitConsentRevoked` pattern.

---

#### EM-CLI-68f8f19e | P1 | Domain Event DE-014 LabOrderCreated Not Emitted

**Title:** `createLabOrder` does not emit DE-014 LabOrderCreated

**Description:** MODULE_SPEC §10b: "Published: DE-014 LabOrderCreated." `createLabOrder.ts` has no event emission. `domain-events.ts` has no `LabOrderCreated` event type. WF-017 step 3 also requires a pg-boss lab notification email — neither is implemented.

**File:** `services/api-ts/src/handlers/dental-clinical/lab-orders/createLabOrder.ts`, `services/api-ts/src/handlers/dental-clinical/domain-events.ts`
**Spec Section:** §10b Domain Events, §4 WF-017 step 3
**Confidence:** HIGH

**Fix:** Add `emitLabOrderCreated()` to `domain-events.ts`; call from `createLabOrder.ts`. Separately schedule a lab notification email via `ctx.get('jobs')`.

---

#### EM-CLI-743e7b05 | P1 | Domain Event DE-015 LabOrderCompleted Not Emitted

**Title:** `updateLabOrder` does not emit DE-015 LabOrderCompleted when status reaches `fitted`

**Description:** MODULE_SPEC §10b: "Published: DE-015 LabOrderCompleted." `updateLabOrder.ts` handles the `fitted` transition but emits no domain event. Downstream workflows (e.g., treatment plan linkage) are never notified.

**File:** `services/api-ts/src/handlers/dental-clinical/lab-orders/updateLabOrder.ts`
**Spec Section:** §10b Domain Events
**Confidence:** HIGH

**Fix:** After `repo.updateStatus()` succeeds with `newStatus === 'fitted'`, emit `LabOrderCompleted` event.

---

#### EM-CLI-1f1f48d5 | P1 | Domain Event DE-016 PrescriptionWritten Not Emitted

**Title:** `createPrescription` does not emit DE-016 PrescriptionWritten

**Description:** MODULE_SPEC §10b: "Published: DE-016 PrescriptionWritten." `createPrescription.ts` logs INFO (`dental_prescription_create`) but emits no domain event. `domain-events.ts` has no `PrescriptionWritten` event type.

**File:** `services/api-ts/src/handlers/dental-clinical/prescriptions/createPrescription.ts`, `services/api-ts/src/handlers/dental-clinical/domain-events.ts`
**Spec Section:** §10b Domain Events
**Confidence:** HIGH

**Fix:** Add `emitPrescriptionWritten()` to `domain-events.ts`; call from `createPrescription.ts`.

---

#### EM-CLI-84148bcf | P1 | Consent Revoke Endpoint Missing from TypeSpec

**Title:** `PATCH /dental/visits/:visitId/consents/:cid/revoke` is not declared in TypeSpec

**Description:** WF-035 consent revocation is implemented in `revokeConsentForm.ts` and registered manually via `(app as any).patch(...)` in `app.ts:482`. The endpoint is absent from `specs/api/src/modules/dental-clinical.tsp`. TypeSpec is the authoritative API contract per project CLAUDE.md. Absent from TypeSpec means absent from OpenAPI spec, SDK clients cannot discover it, and contract tests cannot cover it.

**File:** `services/api-ts/src/app.ts` (line 480-485), `specs/api/src/modules/dental-clinical.tsp`
**Spec Section:** §4 WF-035, §10 API Expectations
**Confidence:** HIGH

**Fix:** Add `@patch @route("/{visitId}/consents/{cid}/revoke")` operation to `dental-clinical.tsp`. Regenerate routes. Remove the `(app as any).patch` manual registration from `app.ts`.

---

### P2 Findings (Fix when touching related code)

---

#### EM-CLI-475c25ca | P2 | WF-038 Audit Event Not Emitted: clinical.amendment.created

**Title:** `createAmendment` does not emit the `clinical.amendment.created` audit event declared in WF-038

**Description:** MODULE_SPEC §4 WF-038 step 5: "Audit event emitted: `clinical.amendment.created` with both original and amendment IDs." `createAmendment.ts` returns the amendment but emits neither a structured audit event nor a domain event for this action. `listAmendments.ts` does log a `data-access` audit event, but create does not.

**File:** `services/api-ts/src/handlers/dental-clinical/amendments/createAmendment.ts`
**Spec Section:** §4 WF-038, §17 Observability Hooks
**Confidence:** HIGH

**Fix:** After `repo.createOne()`, call the audit logger with `action: 'create'`, `resourceType: 'amendment'`, `details: { originalRecordId, originalRecordType, amendmentId }`.

---

#### EM-CLI-671475f9 | P2 | MODULE_SPEC AC-CLI-005 Contradicts TypeSpec PATCH Route

**Title:** MODULE_SPEC AC-CLI-005 declares medical history append-only, but TypeSpec defines `PATCH /medical-history/{entryId}`

**Description:** MODULE_SPEC §11 AC-CLI-005: "Medical history entry → no PATCH/DELETE endpoints available (append-only)." However TypeSpec `dental-clinical.tsp` defines `@patch updateMedicalHistoryEntry` and the generated `routes.ts:584` registers `PATCH /dental/clinical/medical-history/:entryId`. TypeSpec is the authoritative contract, so the PATCH route is correct. MODULE_SPEC §11 AC-CLI-005 is stale and contradicts the TypeSpec definition.

**File:** `services/api-ts/src/handlers/dental-clinical/medical-history/updateMedicalHistoryEntry.ts`, `docs/product/modules/dental-clinical/MODULE_SPEC.md`
**Spec Section:** §11 AC-CLI-005, §20 AI Instructions item 3
**Confidence:** HIGH

**Fix:** Update MODULE_SPEC §11 AC-CLI-005 to reflect that `updateMedicalHistoryEntry` exists (with status-only or `active` flag updates), and clarify that append-only refers to entries not being deleted. Update §20 AI instruction item 3 accordingly.

---

#### EM-CLI-b2c9c167 | P2 | Consent Form Schema Uses Boolean Flags, Not Status Enum

**Title:** Consent form schema uses `boolean signed + boolean revoked` instead of `status` enum (MODULE_SPEC §7)

**Description:** MODULE_SPEC §7 data requirements: `consent_form: status (pending/signed/revoked)`. The actual schema (`consent-form.schema.ts`) uses two boolean columns (`signed`, `revoked`) with no enum `status` field. This means: (a) API responses expose booleans not a `status` string, (b) querying all pending consent forms requires `WHERE signed=false AND revoked=false` rather than `WHERE status='pending'`, (c) MODULE_SPEC §7 is misleading for implementers.

**File:** `services/api-ts/src/handlers/dental-clinical/repos/consent-form.schema.ts`
**Spec Section:** §7 Data Requirements, §8 State Transitions
**Confidence:** HIGH

**Fix (two options):** (A) Add a computed/virtual `status` field to API responses in the repo layer. (B) Update MODULE_SPEC §7 to reflect the boolean-flag representation. Either way the spec and implementation must align.

---

#### EM-CLI-393fb20b | P2 | Lab Order Missing tooth_fdi Field (MODULE_SPEC §7 vs TypeSpec)

**Title:** MODULE_SPEC §7 declares `tooth_fdi` in `lab_order` but TypeSpec and schema omit it

**Description:** MODULE_SPEC §7: `lab_order: id, visit_id, tooth_fdi, lab_name, instructions, due_date, status`. Neither the TypeSpec `LabOrder` model nor `lab-order.schema.ts` includes a `tooth_fdi` or equivalent field. The lab order cannot be linked to a specific tooth/surface, limiting WF-017 (step 1: "Dentist selects tooth/surface from chart then Send to Lab").

**File:** `services/api-ts/src/handlers/dental-clinical/repos/lab-order.schema.ts`, `specs/api/src/modules/dental-clinical.tsp`
**Spec Section:** §7 Data Requirements, §4 WF-017 step 1
**Confidence:** MEDIUM (TypeSpec is authoritative — this may be intentional deferral)

**Fix:** Add optional `toothFdi?: int32` to TypeSpec `CreateLabOrderRequest` and `LabOrder` model, regenerate, and add the column to the schema. Or update MODULE_SPEC §7 to remove the field if deferred.

---

#### EM-CLI-f38e2295 | P2 | createMedicalHistoryEntry Grants hygienist Role Not in MODULE_SPEC §6

**Title:** `createMedicalHistoryEntry` allows `hygienist` role — not declared in MODULE_SPEC §6

**Description:** MODULE_SPEC §6: "Add medical history: dentist_owner, dentist_associate, staff_full." `createMedicalHistoryEntry.ts:37`: `assertBranchRole(..., ['dentist_owner', 'dentist_associate', 'hygienist', 'staff_full'])`. The `hygienist` role is added beyond the spec declaration. This may be intentional (hygienists take medical histories) but is undeclared.

**File:** `services/api-ts/src/handlers/dental-clinical/medical-history/createMedicalHistoryEntry.ts` (line 37)
**Spec Section:** §6 Permissions
**Confidence:** MEDIUM

**Fix:** Either (A) add `hygienist` to MODULE_SPEC §6 for medical history entries, or (B) remove `hygienist` from the `assertBranchRole` call if unintended scope creep.

---

### P3 Findings (Track — optional per spec)

---

#### EM-CLI-b22df7cf | P3 | BR-019 Supervisor Approval Endpoint Returns 501 (Not Implemented)

**Title:** Amendment supervisor approval endpoint (BR-019) not implemented — 501 per spec

**Description:** MODULE_SPEC §15 error handling: "Amendment supervisor approval → 501 NOT_IMPLEMENTED." There is no approval endpoint registered anywhere. The spec acknowledges BR-019 is deferred; the 501 endpoint should be explicitly registered to prevent clients from receiving 404 vs the spec-defined 501.

**File:** `services/api-ts/src/handlers/dental-clinical/amendments/` (no approval handler exists)
**Spec Section:** §5 BR-019, §13 Edge Cases, §18 Feature Flags
**Confidence:** HIGH

**Fix (low priority):** Register a stub `POST /dental/visits/:id/amendments/:amendmentId/approve` that returns 501 `NOT_IMPLEMENTED`. Guard behind `dental_clinical_amendment_approval` feature flag.

---

#### EM-CLI-31b51149 | P3 | WF-017 Lab Notification Email Not Scheduled

**Title:** `createLabOrder` does not schedule pg-boss lab notification email (WF-017 step 3)

**Description:** MODULE_SPEC §4 WF-017 step 3: "pg-boss sends lab notification email" on lab order creation. `createLabOrder.ts` has no reference to `ctx.get('jobs')` or any email scheduler call.

**File:** `services/api-ts/src/handlers/dental-clinical/lab-orders/createLabOrder.ts`
**Spec Section:** §4 WF-017 step 3
**Confidence:** HIGH

**Fix:** After `repo.createOne()`, enqueue a `lab.notification.email` job via `ctx.get('jobs')` with lab order details. This requires an email template for lab communication.

---

#### EM-CLI-3715e603 | P3 | updatePrescription Has No Visit Lock Guard (WF-065)

**Title:** `updatePrescription` does not enforce visit lock before allowing field updates

**Description:** MODULE_SPEC §3 WF-065: "Edit prescription (before visit locked) — P2." `updatePrescription.ts` allows field updates (drug name, dosage, etc.) without checking if the parent visit is locked/completed. The status FSM (pending→dispensed/cancelled) is correctly guarded, but non-status field updates bypass the visit immutability check.

**File:** `services/api-ts/src/handlers/dental-clinical/prescriptions/updatePrescription.ts`
**Spec Section:** §3 WF-065, §5 BR-003
**Confidence:** HIGH

**Fix (P3 because WF-065 is P2 priority):** Add visit status check before the non-status field update branch. Status transitions (dispensed/cancelled) may be allowed on locked visits (external workflow) — this needs product clarification.

---

## Workflow Coverage

| Workflow | Status | Code Path |
|----------|--------|-----------|
| WF-016 Write prescription | IMPLEMENTED | `prescriptions/createPrescription.ts` |
| WF-017 Create lab order | PARTIAL | `lab-orders/createLabOrder.ts` (email missing — P3) |
| WF-018 Obtain consent signature | PARTIAL | `consent/signConsentForm.ts` (DE-012 missing — P1) |
| WF-035 Consent revoke | PARTIAL | `consent/revokeConsentForm.ts` (TypeSpec missing — P1; signed guard missing — P0) |
| WF-036 Lab order status progression | IMPLEMENTED | `lab-orders/updateLabOrder.ts` |
| WF-037 Medical history entry | IMPLEMENTED | `medical-history/createMedicalHistoryEntry.ts` |
| WF-038 Clinical amendment | PARTIAL | `amendments/createAmendment.ts` (audit event missing — P2) |
| WF-039 File attachment upload | PARTIAL | `attachments/createAttachment.ts` (wrong role — P0, BR-003 missing — P0) |
| WF-062 View consent forms | IMPLEMENTED | `consent/listConsentForms.ts` |
| WF-063 Cancel lab order | IMPLEMENTED | `lab-orders/updateLabOrder.ts` (cancelled transition in FSM) |
| WF-064 View prescriptions | IMPLEMENTED | `prescriptions/listPrescriptions.ts` |
| WF-065 Edit prescription | PARTIAL | `prescriptions/updatePrescription.ts` (no visit lock guard — P3) |

---

## Public API Completeness

| Spec Endpoint | TypeSpec Route | Code Handler | Status |
|---------------|---------------|--------------|--------|
| POST prescriptions | `/visits/:id/prescriptions` | `createPrescription.ts` | FOUND |
| GET prescriptions | `/visits/:id/prescriptions` | `listPrescriptions.ts` | FOUND |
| PATCH prescription | `/visits/:id/prescriptions/:pid` | `updatePrescription.ts` | FOUND |
| POST lab-orders | `/visits/:id/lab-orders` | `createLabOrder.ts` | FOUND |
| PATCH lab-order | `/visits/:id/lab-orders/:lid` | `updateLabOrder.ts` | FOUND |
| POST consent forms | `/visits/:id/consents` | `createConsentForm.ts` | FOUND |
| GET consent forms | `/visits/:id/consents` | `listConsentForms.ts` | FOUND |
| POST consent sign | `/visits/:id/consents/:cid/sign` | `signConsentForm.ts` | FOUND |
| PATCH consent revoke | NOT IN TYPESPEC | `revokeConsentForm.ts` | MISSING FROM TYPESPEC (P1) |
| POST medical-history | `/clinical/medical-history` | `createMedicalHistoryEntry.ts` | FOUND |
| GET medical-history | `/clinical/medical-history` | `listMedicalHistory.ts` | FOUND |
| PATCH medical-history | `/clinical/medical-history/:id` | `updateMedicalHistoryEntry.ts` | FOUND (spec contradiction — P2) |
| POST attachments | `/visits/:id/attachments` | `createAttachment.ts` | FOUND |
| GET attachments | `/visits/:id/attachments` | `listAttachments.ts` | FOUND |
| DELETE attachment | `/visits/:id/attachments/:aid` | `deleteAttachment.ts` | FOUND (not in spec prose) |
| POST amendments | `/visits/:id/amendments` | `createAmendment.ts` | FOUND |
| GET amendments | `/visits/:id/amendments` | `listAmendments.ts` | FOUND |

---

## State Machine Verification

| State Machine | Spec Transitions | Guard Implemented | Status |
|--------------|-----------------|-------------------|--------|
| ConsentForm: pending → signed | BR-014 | `consent-form.repo.sign()` WHERE `signed=false` | PASS |
| ConsentForm: pending → revoked | WF-035 | `consent-form.repo.revoke()` WHERE `revoked=false` | PARTIAL (signed forms not blocked — P0) |
| ConsentForm: signed → immutable | BR-014 | NOT GUARDED in revoke path | FAIL (P0) |
| LabOrder: forward-only FSM | BR-018 | `LAB_ORDER_TRANSITIONS` in `lab-order.schema.ts` | PASS |
| Prescription: pending→dispensed/cancelled | WF-016 | `PRESCRIPTION_TRANSITIONS` in `prescription.schema.ts` | PASS |
| Visit immutability (BR-003) | BR-003 | Only in `createLabOrder` — MISSING from prescription/consent/attachment create | FAIL (P0) |

---

## Domain Event Publishing

| Event | Spec Reference | Emitted | Status |
|-------|---------------|---------|--------|
| DE-012 ConsentSigned | §10b | NO | MISSING (P1) |
| DE-013 ConsentRevoked | §10b | YES — `domain-events.ts` + `revokeConsentForm.ts` | PASS |
| DE-014 LabOrderCreated | §10b | NO | MISSING (P1) |
| DE-015 LabOrderCompleted | §10b | NO | MISSING (P1) |
| DE-016 PrescriptionWritten | §10b | NO | MISSING (P1) |
| DE-002 VisitCompleted (consumed) | §10b | N/A — consumed not published | NOT VERIFIED |

---

## Undeclared Sub-Modules Found

The following sub-module directories exist in `dental-clinical/` but are NOT declared in MODULE_SPEC:

| Directory | Routes Registered | Auth | Notes |
|-----------|------------------|------|-------|
| `inventory/` | 5 routes via `(app as any)` | `authMiddleware` present | P2-004 per app.ts comment |
| `occlusion/` | 2 routes via `(app as any)` | `authMiddleware` present | ad-hoc |
| `postop/` | 3 routes via `(app as any)` | `authMiddleware` present | P2-008 per app.ts comment |

All three are auth-protected. No P0 auth finding. However, MODULE_SPEC has no §19 slice entries for these sub-modules — they should be added to the spec or extracted to their own MODULE_SPEC files.

---

## Stabilization Plan

### Fix Now (P0 — block all new work)
1. **EM-CLI-7e8a61cb** — Add BR-003 visit lock guard to `createPrescription`
2. **EM-CLI-bd7bc565** — Add BR-003 visit lock guard to `createConsentForm`
3. **EM-CLI-e7fc720a** — Add BR-003 visit lock guard to `createAttachment`
4. **EM-CLI-6ff99c36** — Block revocation of signed consent forms in handler + repo
5. **EM-CLI-ba65c348** — Fix `createAttachment` role: `hygienist` → `staff_full`

### Fix Before New Work (P1)
6. **EM-CLI-7df05775** — Add DE-012 ConsentSigned emission to `signConsentForm`
7. **EM-CLI-68f8f19e** — Add DE-014 LabOrderCreated emission to `createLabOrder`
8. **EM-CLI-743e7b05** — Add DE-015 LabOrderCompleted emission to `updateLabOrder`
9. **EM-CLI-1f1f48d5** — Add DE-016 PrescriptionWritten emission to `createPrescription`
10. **EM-CLI-84148bcf** — Add consent revoke route to TypeSpec; remove manual `(app as any)` registration

### Fix When Touching (P2)
11. **EM-CLI-475c25ca** — Add `clinical.amendment.created` audit event in `createAmendment`
12. **EM-CLI-671475f9** — Update MODULE_SPEC AC-CLI-005 to match TypeSpec PATCH reality
13. **EM-CLI-b2c9c167** — Align consent form `status` representation (schema vs spec §7)
14. **EM-CLI-393fb20b** — Add `tooth_fdi` to lab order TypeSpec + schema, or update MODULE_SPEC §7
15. **EM-CLI-f38e2295** — Declare `hygienist` in MODULE_SPEC §6 for medical history, or remove

### Track (P3)
16. **EM-CLI-b22df7cf** — Register 501 stub for BR-019 amendment approval endpoint
17. **EM-CLI-31b51149** — Schedule lab notification email in `createLabOrder`
18. **EM-CLI-3715e603** — Add visit lock guard to `updatePrescription` field updates

---

## What's Next

1. **Immediate:** Run `/oli-enforce-fix --module=dental-clinical` targeting the 5 P0 findings
2. **After P0s:** Address P1 domain events (bulk fix — add all 4 events to `domain-events.ts` in one pass)
3. **TypeSpec update:** Add consent revoke to `dental-clinical.tsp` and regenerate routes
4. **Spec reconciliation:** Update MODULE_SPEC §11 AC-CLI-005, §7 data requirements to match TypeSpec reality
5. **Re-run enforcement:** `/oli-enforce-module --module=dental-clinical` after P0+P1 fixes to verify score improvement

---

*Report generated by oli-enforce-module v1.1 | Run 7 | 2026-05-29*
*Finding IDs are content-based (SHA256 truncated to 8 hex chars) — stable across runs*
