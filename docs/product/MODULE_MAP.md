<!--
oli: oli-prd-audit v1.0 | generated: 2026-05-24 | [DRAFT] — verify against codebase before execution
source: docs/prd/v3-dentalemon.md, DOMAIN_MODEL.md, handler directories
-->

# Module Map — Dentalemon [DRAFT]

> 10 dental domain modules layered on top of 13 Monobase platform primitives.
> Dependencies listed as upstream → downstream (arrow = "depends on").

---

## Dental Domain Modules

### M1: dental-org
**Responsibility**: Organizations, clinic branches, staff memberships. Top-level tenant and access scope unit.
**Handler**: `services/api-ts/src/handlers/dental-org/`
**Key tables**: `dental_organization`, `dental_branch`, `dental_membership`
**PRD Section**: §6.6 Staff and Roles, §11.1 Multi-Tenancy
**Dependencies**: `person` (identity), `better-auth` (auth)
**Depended on by**: ALL dental modules (branch scope + membership guards)

### M2: dental-patient
**Responsibility**: Dental-specific patient extensions (dentition record, dental identifiers, patient preferences).
**Handler**: `services/api-ts/src/handlers/dental-patient/`
**Key tables**: `dental_patient` (extends base `patient`)
**PRD Section**: §6.2 Patient Records, §11.2 Clinical Entities
**Dependencies**: `patient` (base PII), `dental-org` (branch scope)
**Depended on by**: `dental-visit`, `dental-billing`, `dental-clinical`, `dental-scheduling`

### M3: dental-visit
**Responsibility**: Clinical encounter state machine, tooth charting, treatment recording, visit notes, treatment templates, carry-over, treatment plans.
**Handler**: `services/api-ts/src/handlers/dental-visit/`
**Key tables**: `dental_visit`, `dental_treatment`, `dental_chart`, `visit_notes`, `visit_note_version`, `dental_treatment_template`, `treatment_plan_version`
**PRD Section**: §6.1 Dental Workspace (primary), §3 Timeline Carousel, §4 Per-Tooth Timeline
**Dependencies**: `dental-org`, `dental-patient`, `patient`
**Depended on by**: `dental-billing`, `dental-clinical`, `dental-pmd`, `dental-imaging`
**State machines**: Visit FSM (`draft→active→completed→locked`), Treatment FSM (`diagnosed→planned→performed→verified→dismissed`)

### M4: dental-scheduling
**Responsibility**: Appointment booking, cancellation, check-in, working hours configuration.
**Handler**: `services/api-ts/src/handlers/dental-scheduling/`
**Key tables**: `dental_appointment`
**PRD Section**: §6.3 Scheduling
**Dependencies**: `dental-org`, `dental-patient`, `booking` (base slots)
**State machine**: Appointment FSM [VERIFY]

### M5: dental-billing
**Responsibility**: Dental invoices, line items, payment plans, payment recording.
**Handler**: `services/api-ts/src/handlers/dental-billing/`
**Key tables**: `dental_invoice`, `dental_invoice_line_item`, `dental_payment_plan`
**PRD Section**: §6.4 Billing, §11.3 Financial Entities
**Dependencies**: `dental-org`, `dental-patient`, `dental-visit` (treatment → line items)
**State machine**: Invoice FSM (`draft→issued→partial→paid|overdue|voided`)
**Coupling risk**: Imports `dental-visit` schemas + `patient` schemas directly (G-003 pattern)

### M6: dental-clinical
**Responsibility**: Prescriptions, lab orders, consent forms, medical history, file attachments, clinical amendments.
**Handler**: `services/api-ts/src/handlers/dental-clinical/`
**Key tables**: `prescription`, `lab_order`, `consent_form`, `medical_history_entry`, `dental_attachment`, `amendment`
**PRD Section**: §6.1 Workspace (clinical tabs), §6.12 PMD
**Dependencies**: `dental-org`, `dental-visit` (visit context), `patient`, `storage` (attachments)
**Coupling risk**: Imports `VisitRepository` from `dental-visit` (P1 cross-module repo access)

### M7: dental-imaging
**Responsibility**: Radiographic study management, per-image annotations, cephalometric analysis, findings.
**Handler**: `services/api-ts/src/handlers/dental-imaging/`
**Key tables**: `imaging_study`, `imaging_study_image`, `imaging_study_tooth`, `imaging_annotation`
**PRD Section**: §6.1 Workspace (Imaging tab), v1.3/v1.4 imaging features
**Dependencies**: `storage` (file storage), `dental-org` (branch scope) — uses **loose-coupling** (no DB-level FKs, UUID references only)
**Model pattern**: No DB-level FKs to other modules — intentional loose coupling

### M8: dental-pmd
**Responsibility**: Portable Medical Document generation (signed visit snapshots) and import.
**Handler**: `services/api-ts/src/handlers/dental-pmd/`
**Key tables**: `pmd_document`, `imported_pmd`
**PRD Section**: §6.12 PMD, Appendix E
**Dependencies**: `dental-visit`, `dental-clinical`, `dental-org`
**Rules**: BR-021 (requires completed visit), BR-022 (import creates records)

### M9: dental-emr
**Responsibility**: SOAP-style telemedicine/walk-in consultation notes (EMR separate from dental visit workflow).
**Handler**: `services/api-ts/src/handlers/emr/`
**Key tables**: [VERIFY — emr.repo.ts]
**PRD Section**: [INFERRED — not prominently in v3 PRD; may be Phase 2]
**Dependencies**: `dental-org`, `patient`
**Note**: Separate from `dental-visit` note system. Overlap risk with dental-visit SOAP notes.

### M10: dental-audit (dental-org module)
**Responsibility**: Dental-specific audit trail and compliance event log.
**Handler**: `services/api-ts/src/handlers/dental-org/getAuditEvents.ts` + base `audit` module
**PRD Section**: §8 NFR Security (audit logging requirement)
**Dependencies**: `audit` (base), `dental-org`

---

## Monobase Platform Modules (base layer)

| Module | Responsibility | Used By |
|--------|---------------|---------|
| `person` | Central PII (name, email, phone) | All dental modules (identity) |
| `patient` | Base patient record | `dental-patient`, `dental-visit`, `dental-billing` |
| `audit` | Structured compliance event log | `dental-org` (audit events) |
| `billing` | Stripe Connect base invoices | Superseded by `dental-billing` for dental flows |
| `booking` | Generic time-slot scheduling | `dental-scheduling` extends |
| `comms` | Real-time chat + WebRTC | [Phase 2 for dental] |
| `email` | Transactional email (SMTP/Postmark) | All notification flows |
| `notifs` | Multi-channel push (OneSignal) | Appointment reminders, billing |
| `storage` | S3/MinIO file storage | `dental-imaging`, `dental-clinical` (attachments) |
| `reviews` | NPS review system | [Optional — dental feedback] |
| `provider` | Provider profile | [dental-org membership extends] |
| `shared` | `assertBranchAccess`, `assertBranchRole` | ALL dental modules |

---

## Dependency Graph (simplified)

```
person ──────────────────────────────────────┐
patient ──────────────────────────────────────┤
dental-org (M1) ──────────────────────────────┤──→ ALL dental modules
        │                                      │
        ├──→ dental-patient (M2)               │
        │         └──→ dental-visit (M3) ──────┤──→ dental-billing (M5)
        │                   └──→ dental-clinical (M6)
        │                   └──→ dental-pmd (M8)
        │                   └──→ dental-imaging (M7) [loose coupling]
        ├──→ dental-scheduling (M4)
        └──→ dental-emr (M9)
storage ──────────────────────────────────────→ dental-imaging, dental-clinical
shared (assertBranchAccess/Role) ─────────────→ ALL clinical handlers
```

---

## Cross-Module Coupling Risks

| Coupling | Type | Risk |
|----------|------|------|
| `dental-clinical` → `dental-visit` VisitRepository | Repo access | P1 — should go through service interface |
| `dental-billing` → `dental-visit` schema | Schema access | P2 — acceptable but document as contract |
| `dental-billing` → `dental-org` schema | Schema access | P2 — document as contract |
| `dental-imaging` → all others | UUID-only | OK — explicit loose coupling pattern |
