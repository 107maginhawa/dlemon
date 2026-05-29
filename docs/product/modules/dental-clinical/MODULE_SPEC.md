<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all -->

# Module Specification: dental-clinical

---
Spec Version: 1.0 | Last Updated: 2026-05-24
---

## 1. Module Overview
**Purpose:** Clinical records within a visit: prescriptions, lab orders, consent forms, medical history, file attachments, and clinical amendments. All records are visit-scoped and immutable after visit is completed (BR-003).

**Users:** dentist_owner, dentist_associate (write), staff_full (read consent/history), patient (consent signature)

**Related:** dental-org (assertBranchAccess, assertBranchRole for Rx), dental-visit (visit context + immutability guard), storage (attachments), dental-patient (medical history view, safety floor)

**KNOWN COUPLING RISK (G-003):** Imports `VisitRepository` directly from dental-visit — must be refactored to service interface in Wave G1.

---

## 2. Domain Terms

| Term | Definition |
|------|-----------|
| Prescription | Drug order by a dentist member; requires prescriberMemberId (BR-017) |
| Lab Order | Request to external dental lab; states: ordered→in_fabrication→delivered→fitted/cancelled (BR-018) |
| Consent Form | Patient authorization; states: pending→signed/revoked (BR-014) |
| Medical History Entry | Append-only systemic health, allergy, medication record |
| Amendment | Additive correction to any clinical record; original immutable |
| Attachment | File (PDF, image, scan) linked to a visit via storage module |

---

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-016 | Dentist | Write prescription (BR-017) | P0 |
| WF-017 | Dentist | Create lab order (BR-018) | P0 |
| WF-018 | Dentist | Obtain consent signature (BR-014) | P0 |
| WF-035 | Patient | Revoke consent | P1 |
| WF-036 | Dentist | Lab order status progression | P1 |
| WF-037 | Dentist, Staff Full | Medical history entry | P1 |
| WF-038 | Dentist | Clinical amendment (BR-019 — supervisor approval NOT IMPLEMENTED) | P2 |
| WF-039 | Dentist | File attachment upload | P1 |
| WF-062 [INFERRED] | Dentist | View consent forms list | P1 |
| WF-063 [INFERRED] | Dentist | Cancel lab order | P1 |
| WF-064 [INFERRED] | Dentist | View prescriptions | P1 |
| WF-065 [INFERRED] | Dentist | Edit prescription (before visit locked) | P2 |

---

## 4. Workflow Details

### WF-016 — Write Prescription
1. Dentist opens visit workspace → "Prescriptions" tab.
2. Clicks "+ New Prescription". Dialog opens (RxNorm search, dose, frequency, duration, notes).
3. On submit: `prescriberMemberId` set server-side from session; BR-017 enforced (dentist role only → 403 otherwise).
4. Prescription appears in list (`pending`). Dentist prints/shares PDF.
5. State transitions: `pending → dispensed | cancelled`. Visit lock blocks further edits.

### WF-017 — Create Lab Order
1. Dentist selects tooth/surface from chart → "Send to Lab" action.
2. Lab order dialog: lab name, instructions, due date, shade (optional).
3. On submit: record created (`ordered`). pg-boss sends lab notification email.
4. State machine: `ordered → in_fabrication → delivered → fitted | cancelled`.
5. Fitted lab orders link back to the treatment record on the chart.

### WF-018 — Obtain Consent Signature
1. Dentist selects treatment → "Request Consent" → picks consent template.
2. Patient receives link (email/on-screen). Signature captured (draw or click-to-sign).
3. Signed consent stored immutably; `signed_at` timestamp recorded.
4. BR-014: treatment cannot move to `performed` without a signed consent form.
5. Revocation (WF-035): patient revokes → state `revoked`; dentist alerted; treatment blocked.

### WF-038 — Clinical Amendment
1. Dentist opens locked/completed visit → "Add Amendment" on a specific clinical entry.
2. Amendment dialog: reason (required), corrected content.
3. Original entry remains visible and immutable; amendment appended alongside it.
4. Supervisor approval flow (BR-019) is **not implemented** — amendment saved immediately.
5. Audit event emitted: `clinical.amendment.created` with both original and amendment IDs.

### WF-039 — File Attachment Upload
1. Dentist or Staff Full opens visit → "Attachments" panel → drag-drop or file picker.
2. Smart Attachment tagging: image type (periapical, bitewing, panoramic, photo, other) + optional tooth numbers.
3. File stored in S3/MinIO via `storage` module. Metadata record linked to `dental_visit_id`.
4. Max file size: 50 MB per file. Accepted types: JPEG, PNG, TIFF, DICOM, PDF.
5. Attachment list updates optimistically; S3 upload confirmed before persisting DB record.

---

## 5. Business Rules

| Rule ID | Rule | Expected Behavior |
|---------|------|-------------------|
| BR-003 | Visit immutable after completed → no clinical writes | 422 on write to locked visit |
| BR-014 | Consent form required before treatment proceeds | UI guard; 422 if unsigned |
| BR-017 | Prescription requires prescriberMemberId (dentist role only) | 422 if missing/non-dentist |
| BR-018 | Lab order lifecycle: ordered→in_fabrication→delivered→fitted/cancelled; forward-only | 422 on reversal |
| BR-019 | Supervisor approval for amendments NOT IMPLEMENTED | 501 for amendment approval endpoint |

---

## 6. Permissions

| Action | Allowed | Notes |
|--------|---------|-------|
| Write prescription | dentist_owner, dentist_associate | assertBranchRole(dentist) |
| Create consent form | dentist_owner, dentist_associate | — |
| Sign consent | Patient (in-person via dentist device) | — |
| Add medical history | dentist_owner, dentist_associate, staff_full | — |
| Create lab order | dentist_owner, dentist_associate | — |
| Upload attachment | dentist_owner, dentist_associate, staff_full | — |
| Create amendment | dentist_owner, dentist_associate | Supervisor approval deferred (BR-019) |

---

## 7. Data Requirements (key fields)
**`prescription`:** id, visit_id, patient_id, branch_id, prescriber_member_id, drug_name, dosage, frequency, duration, status
**`lab_order`:** id, visit_id, tooth_fdi, lab_name, instructions, due_date, status (ordered/in_fabrication/delivered/fitted/cancelled)
**`consent_form`:** id, visit_id, patient_id, template_id, status (pending/signed/revoked), signed_at, signature_data
**`medical_history_entry`:** id, patient_id, branch_id, entry_type (allergy/condition/medication), value, created_by (append-only)
**`dental_attachment`:** id, visit_id, storage_file_id, file_name, mime_type, image_type_enum

---

## 7b. Aggregate Boundaries
All entities in this module owned by Visit (via visit_id). MedicalHistoryEntry is owned by Patient (patient_id, no visit_id required).

Cross-module coupling: VisitRepository imported directly — refactor to service call (G-003, Wave G1).

---

## 8. State Transitions
```
ConsentForm:  pending → signed → (immutable after signed, BR-014)
              pending → revoked
LabOrder:     ordered → in_fabrication → delivered → fitted
              ordered / in_fabrication / delivered → cancelled
```

---

## 9. UI/UX Requirements
**Prescription sheet:** Drug name autocomplete, dosage form, prescriberMemberId auto-filled from session. **Consent sheet:** Display template text, signature capture, signed = immutable (BR-014). **Lab order sheet:** Lab name, tooth, instructions, due date, status tracker. **Medical history:** Append-only list; no edit/delete controls shown.

---

## 10. API Expectations
POST /dental/visits/:id/prescriptions (BR-017), GET /dental/visits/:id/prescriptions, POST /dental/visits/:id/lab-orders (BR-018), PATCH /dental/visits/:id/lab-orders/:lid (status progression), POST /dental/visits/:id/consent-forms (BR-014), PATCH /dental/visits/:id/consent-forms/:cid/sign, PATCH /dental/visits/:id/consent-forms/:cid/revoke, POST /dental/patients/:id/medical-history (append-only), POST /dental/visits/:id/attachments, POST /dental/visits/:id/amendments

---

## 10b. Domain Events
**Published:** DE-012 ConsentSigned, DE-013 ConsentRevoked, DE-014 LabOrderCreated, DE-015 LabOrderCompleted, DE-016 PrescriptionWritten
**Consumed:** DE-002 VisitCompleted (trigger immutability guard)

---

## 11. Acceptance Criteria
**AC-CLI-001:** Prescription without prescriberMemberId → 422 (BR-017).
**AC-CLI-002:** Prescription by non-dentist → 422 (assertBranchRole).
**AC-CLI-003:** Sign consent form → status = signed, immutable (BR-014).
**AC-CLI-004:** Lab order: in_fabrication → ordered (reversal) → 422 (BR-018).
**AC-CLI-005:** Medical history entry → no PATCH/DELETE endpoints available (append-only).
**AC-CLI-006:** Write to clinical record on completed visit → 422 (BR-003).

---

## 12. Test Expectations
Unit: BR-017 prescriber guard, BR-018 lab state machine, BR-014 consent immutability.
Integration: prescription created on active visit; prescription rejected on completed visit.

---

## 13. Edge Cases
- Consent form for template that has been deactivated → use template snapshot at form creation time
- Lab order completed after visit locked → allowed (lab updates are external; immutability only blocks new creation)
- Amendment creation → original record must persist; amendment links to original_id
- BR-019 supervisor approval → return 501 for approval endpoint

---

## 14. Dependencies
**Internal:** dental-org (assertBranchAccess, assertBranchRole), dental-visit (visit immutability — G-003 coupling to fix), storage (attachments), dental-patient (medical history consumer)
**External:** Storage module (S3/MinIO) for attachment upload

---

## 15. Error Handling

| Scenario | HTTP | Code |
|----------|------|------|
| Missing prescriberMemberId | 422 | PRESCRIBER_REQUIRED |
| Non-dentist writes Rx | 403 | DENTIST_ROLE_REQUIRED |
| Invalid lab order transition | 422 | INVALID_STATUS_TRANSITION |
| Write on locked visit | 422 | VISIT_IMMUTABLE |
| Amendment supervisor approval | 501 | NOT_IMPLEMENTED |

---

## 16. Performance Expectations
Consent form load < 1s. Attachment upload < 10s (10MB). Prescription + lab order CRUD < 500ms.

---

## 17. Observability Hooks
dental-clinical.prescription.created (INFO), dental-clinical.consent.signed (INFO), dental-clinical.lab-order.completed (INFO), dental-clinical.immutable-write (WARN). No PHI in log fields.

---

## 18. Feature Flags
| Flag | Default | Description |
|------|---------|-------------|
| dental_clinical_amendment_approval | false | Enable BR-019 supervisor approval workflow |

---

## 19. Vertical Slice Plan
CLI-S1: Prescription (BR-017) | CLI-S2: Consent form (BR-014, sign/revoke) | CLI-S3: Lab orders (BR-018) | CLI-S4: Medical history (append-only) | CLI-S5: Attachments | CLI-S6: Amendments + G-003 repo decoupling

---

## 20. AI Instructions
1. G-003: Replace `VisitRepository` import with a service interface call — this is Wave G1 priority.
2. assertBranchRole(dentist) required for prescriptions — check before any Rx write.
3. Medical history: no PATCH/DELETE routes — append-only enforced at router level.
4. Consent form signed → all future PATCH attempts on that form must return 422.
5. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
