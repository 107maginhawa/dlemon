<!--
oli: oli-prd-audit v1.0 | generated: 2026-05-24 | [DRAFT] — verify against codebase before execution
source: docs/prd/v3-dentalemon.md, DOMAIN_MODEL.md, handler directories
-->

# Module Map — Dentalemon [DRAFT]

> 10 dental domain modules layered on top of 13 Monobase platform primitives.
> Dependencies listed as upstream → downstream (arrow = "depends on").

> **Layout & Bucketing**: Handler sub-domain folder structure and handler-count thresholds are defined in
> [`docs/development/MODULE_TEMPLATE.md`](../development/MODULE_TEMPLATE.md).
> Import boundary rules (what may cross module lines and what may not) are enforced via ESLint and documented in
> [`docs/development/MODULE_BOUNDARIES.md`](../development/MODULE_BOUNDARIES.md).

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
**Handler**: `services/api-ts/src/handlers/dental-patient/` — 46 handlers across 8 sub-domains: `identity/`, `contacts/`, `insurance/`, `alerts/`, `engagement/`, `recalls/`, `sync/`, `treatment-plans/`
**Key tables**: `dental_patient` (extends base `patient`)
**PRD Section**: §6.2 Patient Records, §11.2 Clinical Entities
**Dependencies**: `patient` (base PII), `dental-org` (branch scope)
**Depended on by**: `dental-visit`, `dental-billing`, `dental-clinical`, `dental-scheduling`

### M3: dental-visit
**Responsibility**: Clinical encounter state machine, tooth charting, treatment recording, visit notes, treatment templates, carry-over, treatment plans.
**Handler**: `services/api-ts/src/handlers/dental-visit/` — 26 handlers across 6 sub-domains: `chart/`, `notes/`, `templates/`, `treatments/`, `treatment-plans/`, `visits/`
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
**Handler**: `services/api-ts/src/handlers/dental-clinical/` — 27 handlers across 9 sub-domains: `amendments/`, `attachments/`, `consent/`, `inventory/`, `lab-orders/`, `medical-history/`, `occlusion/`, `postop/`, `prescriptions/`
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

### M9: external-records-import (formerly "dental-emr-integration")
**Responsibility**: External EMR/EHR data import bridge from third-party practice management systems (Open Dental, Dentrix, Eaglesoft, HL7/FHIR). Stores imported records read-only for clinical reference.
**Handler**: No handler directory — future phase (Phase 3+). Do not implement until scheduled.
**Spec**: `docs/product/modules/external-records-import/`
**Namespace**: `/dental/emr-import` (renamed 2026-05-29 to free the "EMR" name for the live consultation-notes module below)
**Key tables**: `emr_record` (planned)
**PRD Section**: Phase 3+ (not in current roadmap)
**Dependencies**: `dental-org`, `dental-patient`
**Note**: NOT an alias for dental-visit, and NOT the live `emr` handler. **`dental-visit` is the active dental EMR** for native visit/chart/treatment records; the live `emr` handler (see P-EMR below) ships telemedicine consultation notes. This module handles external practice data portability only.

### M10: dental-audit (dental-org module)
**Responsibility**: Dental-specific audit trail and compliance event log.
**Handler**: `services/api-ts/src/handlers/dental-org/getAuditEvents.ts` + base `audit` module
**PRD Section**: §8 NFR Security (audit logging requirement)
**Dependencies**: `audit` (base), `dental-org`

### P-EMR: emr-consultation (platform-level module)
**Responsibility**: Telemedicine / minor-ailment **consultation notes** (chief complaint, assessment, plan, vitals, symptoms, prescriptions, follow-up) with a `draft→finalized→amended` lifecycle. Ported from the `monobase-mycure` upstream template.
**Handler**: `services/api-ts/src/handlers/emr/` (6 handlers) — **implemented**.
**Spec**: `docs/product/modules/emr-consultation/`
**Namespace**: `/emr` (distinct from M9's `/dental/emr-import`)
**Key tables**: `consultation_note`
**Dependencies (facade-only, loose-coupling, no DB FKs)**: `patient` (`patient-emr.facade`), `provider` (`provider-emr.facade`), `person` (surfaced via the `*WithPerson` facade variants on `expand=person`).
**Note**: This is a platform-level module (consumes generic `patient`/`provider`/`person`), **not** a `dental-*` domain module, and is **not** the external-records-import bridge (M9).

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
        └──→ external-records-import (M9) [future phase, /dental/emr-import]
emr-consultation (P-EMR) ─→ patient/provider/person facades [platform, /emr]
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
