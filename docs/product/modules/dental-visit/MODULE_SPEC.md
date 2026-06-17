<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all -->
<!-- based-on: PRD v3, DOMAIN_MODEL.md, WORKFLOW_MAP.md, existing docs/modules/dental-visit/MODULE_SPEC.md -->

# Module Specification: dental-visit

---
Spec Version: 1.0 | Last Updated: 2026-05-24 | Last Validated Against: PRD v3-dentalemon.md
---

## 1. Module Overview
**Purpose:** Core clinical workspace. Manages visit lifecycle (draft→active→completed→locked), dental chart, treatments, SOAP notes, carry-over, dentition, and treatment templates. The workspace is the primary daily touchpoint for dentists.

**Users:** dentist_owner, dentist_associate (full), staff_full (read-only workspace)

**Related:** dental-org (assertBranchAccess), dental-scheduling (check-in), dental-billing (treatment→invoice), dental-clinical (clinical records), dental-pmd (snapshot)

**In Scope:** Visit CRUD, treatment CRUD, dental chart, SOAP notes, dentition init, carry-over display, treatment templates, visit locking (scheduled job).

**Out of Scope:** Prescriptions/lab orders/consent (dental-clinical), invoices (dental-billing), appointments (dental-scheduling).

---

## 2. Domain Terms

| Term | Definition |
|------|-----------|
| Visit | Dental encounter; state machine: draft→active→completed→locked |
| Treatment | Clinical procedure linked to a visit; forward-only state machine |
| Dental Chart | SVG per-tooth map of conditions and treatments (FDI/Universal notation) |
| SOAP Notes | Subjective/Objective/Assessment/Plan clinical notes; append-only with versions |
| Carry-over | Planned/diagnosed treatments from prior visits shown as indicators |
| Focal Card | Active card in the Timeline Carousel; left/right are preview-only |
| Baseline | Chart snapshot captured at a specific visit |
| Declined | Terminal treatment state meaning the patient explicitly declined the recommended procedure (not the same as dismissed — dismissed is clinician-initiated, declined is patient-initiated). Reachable from `diagnosed` or `planned`. |

---

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-007 | Staff/Dentist | Check-in → create visit | P0 |
| WF-008 | Dentist, Staff Full | Open workspace | P0 |
| WF-009 | Dentist | Chart entry (condition/treatment) | P0 |
| WF-010 | Dentist | Mark treatment as performed | P0 |
| WF-011 | Dentist | SOAP notes authoring | P0 |
| WF-012 | Dentist | Complete visit | P0 |
| WF-032 | Dentist | Initialize dentition | P1 |
| WF-033 | Dentist | Carry-over display | P1 |
| WF-034 | Dentist | Timeline carousel navigation | P1 |
| WF-045 | Dentist | Create visit from workspace (+) — two-step POST draft → PATCH active | P1 |
| WF-046 [INFERRED] | System (pg-boss) | Lock completed visits | P2 |
| WF-047 [INFERRED] | System | Auto-discard empty draft (BR-005 deferred) | P3 |

---

## 4. Workflow Details

### WF-012: Complete Visit
**Actor:** Dentist | **Preconditions:** Visit is active, no unsigned treatment consents blocking
**Steps:** 1. Dentist clicks "Complete Visit" 2. System checks for unsigned required consents (BR-014 — enforced in dental-clinical) 3. Visit status → completed 4. isReadOnly flag set for all workspace write operations 5. DE-002 VisitCompleted published
**Postconditions:** Visit immutable; invoice creation unlocked (dental-billing); PMD generation eligible (dental-pmd)

---

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-001 | No concurrent active visits per patient (enforced globally per patient, across all branches — a partial unique index on `(patient_id, status) WHERE status='active'` plus the `findActiveByPatient` app guard; stricter than the original "per branch" wording) | createVisit / activate | 409 ACTIVE_VISIT_EXISTS |
| BR-002 | Visit transitions linear: draft→active→completed→locked | All status changes | 422 on invalid |
| BR-003 | Visit immutable after completed/locked | All write handlers | 422 + isReadOnly flag |
| BR-005 | Auto-discard empty visit (deferred ADR-010) | Empty visit on complete | Gated behind default-false flag `dental_visit_auto_discard` (V-VIS-004). When OFF (default), empty visits complete via the normal path; when ON, a complete with no treatments/notes/attachments redirects to `discarded`. |
| BR-006 | Treatment state forward-only: diagnosed→planned→performed→verified; any non-terminal→dismissed or declined (patient refusal). `declined` is a terminal state reachable from `diagnosed` or `planned` only (not from `performed`/`verified`). | updateTreatment | 422 on reversal |
| BR-007 | Completed treatment immutable (code, tooth, surface, price) | updateTreatment | 422 |
| BR-008 | Carry-over creates new `dental_treatment` rows on the next visit with `carriedOver=true, sourceVisitId=<prior visit id>`, status=`diagnosed`; not billed until status moves to `performed` | `carryOverTreatments.ts` | Enforced |

---

## 6. Permissions

| Action | Allowed Roles | Notes |
|--------|--------------|-------|
| Create/complete visit | dentist_owner, dentist_associate | — |
| Read workspace | all dental roles | — |
| Add chart entries / treatments | dentist_owner, dentist_associate | — |
| Apply treatment template (creates treatments) | dentist_owner, dentist_associate | V-VIS-012: clinical-role gate, parity with create-treatment (fixed audit 2026-06-08; template must belong to the visit's branch) |
| Read / accept treatment plan, read plan version | all dental roles | V-VIS-011: authorized against the **patient's** branch, not the caller-supplied `branchId` query param (cross-tenant guard, fixed audit 2026-06-08) |
| Sign SOAP notes | dentist_owner, dentist_associate | Clinical role required |
| Add note addendum | dentist_owner, dentist_associate | After sign |
| Lock visit (job) | System | Automated |

---

## 7. Data Requirements (key fields; full schema in code)

**`dental_visit`:** id, patient_id, branch_id, dentist_member_id, status (enum), chief_complaint, check_in_time, completed_at, locked_at, version, notes_count (computed — count of visit_notes rows)

**`dental_treatment`:** id, visit_id, tooth_fdi, surface, cdt_code, icd10_code, status (enum: diagnosed/planned/performed/verified/dismissed/declined), price_cents, notes, created_by, carried_over, source_visit_id, refusal_reason (text — populated when status=declined)

**`dental_chart`:** id, visit_id, patient_id, teeth (JSONB per-tooth conditions/treatments)

**`visit_notes`:** id, visit_id, author_member_id, subjective, objective, assessment, plan, notes (four structured SOAP columns + free-text `notes` — single record per visit, NOT a collection; V-VIS-009), signed, signed_at, signed_by, locked_at (append-only history in `visit_note_version`)

---

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Key Invariants |
|---|---|---|
| Visit | Treatment, ChartEntry, VisitNotes (versions), TreatmentPlanVersion | BR-001 (no concurrent active), BR-002 (linear), BR-003 (immutable after completed) |

External refs by ID: Invoice (dental-billing), PMDDocument (dental-pmd), ImagingStudy (dental-imaging — UUID ref only).

---

## 8. State Transitions

See DOMAIN_MODEL.md §6 SM-VISIT and SM-TREATMENT (source of truth).
```
Visit:  draft → active → completed → locked   (+discarded, BR-005 deferred)

Treatment (forward-only):
  diagnosed → planned → performed → verified
  diagnosed → dismissed  (clinician-initiated)
  diagnosed → declined   (patient refusal — terminal)
  planned   → performed → verified
  planned   → dismissed
  planned   → declined   (terminal)
  performed → verified
  performed → dismissed
  verified  → dismissed
  dismissed: []  (terminal)
  declined:  []  (terminal — patient explicitly declined recommended treatment)
```
Note: `declined` differs from `dismissed` in intent — `dismissed` is clinician-initiated
(e.g. "treatment no longer applicable"), `declined` records a patient refusal and
populates `refusal_reason`. Both are terminal and reachable from pre-performed states.

---

## 9. UI/UX Requirements

**Workspace Layout:** Flex-row — Timeline Carousel (left) + Clinical Table (right) per ADR-005.
**Timeline Carousel:** Swiper-based, touch gestures (ADR-004); Focal Card fully interactive; adjacent cards preview-only.
**Dental Chart:** SVG, FDI notation (default), Universal toggle; per-tooth popover for conditions/treatments.
**States per component:** Loading, Empty (no visits → new visit prompt), Active visit (editable), ReadOnly (completed/locked), Error.

---

## 10. API Expectations (key endpoints; full list in existing spec)

POST /dental/visits (BR-001), GET /dental/visits/:id, PATCH /dental/visits/:id (BR-002/BR-003), POST /dental/visits/:id/treatments (BR-003), PATCH /dental/visits/:id/treatments/:tid (BR-006/BR-007), POST/GET /dental/visits/:id/chart (BR-003), POST/GET/sign /dental/visits/:id/notes (BR-003), POST /dental/patients/:patientId/dentition, GET /dental/patients/:id/treatment-plan, POST /dental/visits/:id/carry-over

---

## 10b. Domain Events

**Published:** DE-001 VisitCheckedIn, DE-002 VisitCompleted, DE-003 VisitLocked, DE-004 TreatmentDiagnosed, DE-005 TreatmentPerformed, DE-006 TreatmentDismissed

**Consumed:** (none directly — check-in is triggered by dental-scheduling via WF-089)

Per ADR-006 (domain-events-descope), domain events here are audit-log-only semantic markers — there is NO event bus. Producers satisfy them by writing the corresponding dental_audit_log row synchronously via logAuditEvent(); reactive consumers (e.g. notifs) are deferred to a future phase. No publisher/emit scaffolding is required.

---

## 11. Acceptance Criteria

**AC-VIS-001:** Given active visit exists for patient P, When new check-in attempted for P at same branch, Then 409 returned (BR-001).
**AC-VIS-002:** Given visit.status = completed, When any write to chart/treatment/notes attempted, Then 422 returned (BR-003).
**AC-VIS-003:** Given treatment.status = performed, When PATCH to change cdt_code attempted, Then 422 returned (BR-007).
**AC-VIS-004:** Given treatment.status = performed, When PATCH to set status = diagnosed attempted, Then 422 returned (BR-006).
**AC-VIS-005:** Given carry-over treatments from previous visit, When workspace opened, Then they appear with visual indicator (not as new charges).

---

## 12. Test Expectations
Unit: BR-001 concurrent guard, BR-003 immutability, BR-006 transition guard, BR-007 completed immutable.
Integration: check-in flow creates visit; complete visit publishes DE-002.
E2E: full visit workflow (check-in → chart → notes → complete).

---

## 13. Edge Cases
- Dentition init called twice (idempotent — must not duplicate teeth)
- Visit completed with no treatments (allowed — dentist may only do exam)
- SOAP note addendum after sign (allowed via addendum endpoint, not edit)
- Treatment template applied to locked visit (422)
- Carry-over scoping: `carryOverTreatments` authorizes on the **current** visit's branch (assertBranchRole owner/associate) and validates the source visit belongs to the **same patient** — but does NOT block a source visit in a *different* branch (auto-discovery also spans all of the patient's branches). This favors cross-branch clinical continuity for one patient over strict branch isolation. ⚠ Drift vs the original "blocked — assertBranchAccess" intent — PRODUCT DECISION pending (audit 2026-06-08): keep patient-scoped, or add a source-branch guard. Not unilaterally changed.

---

## 14. Dependencies
**Internal:** dental-org (assertBranchAccess), dental-scheduling (check-in source), dental-billing (treatment→invoice), dental-clinical (cross-module repo coupling G-003 — needs refactor), dental-pmd (visit snapshot consumer)
**External:** pg-boss (visit lock job, DE-003)

---

## 15. Error Handling

| Scenario | HTTP | Code |
|----------|------|------|
| Concurrent active visit | 409 | ACTIVE_VISIT_EXISTS |
| Invalid status transition | 422 | INVALID_STATUS_TRANSITION |
| Write to locked/completed visit | 422 | VISIT_IMMUTABLE |
| Completed treatment modified | 422 | TREATMENT_IMMUTABLE |

---

## 16. Performance Expectations
Workspace load < 2s (PRD NFR), chart entry < 1s, treatment update < 1s. Volume: up to 100 visits/day/branch, 20 treatments/visit.

---

## 17. Observability Hooks
dental-visit.checked-in (INFO), dental-visit.completed (INFO), dental-visit.locked (INFO, pg-boss), dental-visit.immutable-write-attempt (WARN) — no PII in any log field.

---

## 18. Feature Flags
| Flag | Default | Description |
|------|---------|-------------|
| dental_visit_auto_discard | false | Enable BR-005 auto-discard (ADR-010 deferred) |
| dental_visit_universal_notation | false | Enable Universal tooth notation toggle |

---

## 19. Vertical Slice Plan
VIS-S1: Visit creation + check-in | VIS-S2: Dental chart CRUD | VIS-S3: Treatment lifecycle (diagnosed→performed) | VIS-S4: SOAP notes + sign + addendum | VIS-S5: Dentition init + carry-over | VIS-S6: Visit completion + lock job | VIS-S7: Treatment templates

---

## 20. AI Instructions
1. All write handlers MUST check `visit.status` first — throw 422 if completed/locked.
2. Treatment TRANSITIONS constant must be enforced in updateDentalTreatment (G-003 gap: currently partial).
3. assertBranchAccess called at TOP of every handler — confirmed via G-003 audit.
4. SOAP notes: append-only versioning — never overwrite, always create new version.
5. Follow ARCHITECTURE.md, CONTRIBUTING.md, CLAUDE.md, VERTICAL_TDD.md.
