
---

## 03 — `docs/audits/prompts/03-dental-product-workflow-audit.md`

```md
# Dental Product and Workflow Coverage Audit

## Purpose

Audit whether the dental system is production-useful for a real dental clinic without being over-engineered.

Do not limit the audit to the modules listed in `MODULES.md`. Treat `MODULES.md` as the current implementation inventory, not the complete definition of what should exist.

Compare:

1. What the PRD/specs say.
2. What the current code implements.
3. What a real production-grade dental clinic reasonably needs.

---

## Required Guardrail

Before running this pass, load:

`docs/audits/prompts/01-audit-enforcement-guardrails.md`

Update:

- `docs/audits/AUDIT_COVERAGE_MANIFEST.md`
- `docs/audits/DENTAL_AUDIT_RUN_LOG.md`
- `docs/audits/DENTAL_GAP_REGISTRY.md`

---

## Inputs

Inspect if present:

- `MODULES.md`
- `docs/product/MASTER_PRD.md`
- `docs/product/WORKFLOW_MAP.md`
- `docs/product/MODULE_MAP.md`
- `docs/product/DOMAIN_MODEL.md`
- `docs/product/ROLE_PERMISSION_MATRIX.md`
- `docs/product/modules/*/MODULE_SPEC.md`
- backend handlers under `services/api-ts/src/handlers/`
- frontend routes/features under app source directories
- tests
- seed data if present

---

## Product Standard

Audit for a small-to-mid-sized dental clinic, not a hospital-grade enterprise system.

The system should be useful for:

- solo dentists
- small dental clinics
- clinics with multiple dentists/staff
- multi-branch setup if supported by product scope
- chairside iPad/tablet usage
- admin/front-desk workflows
- billing and collections
- patient record continuity

Avoid recommending enterprise bloat unless clearly needed by the PRD.

---

## Core Dental Clinic Workflows

Audit these end-to-end workflows.

### WF-001 Organization and Branch Setup

Check:

- create organization
- configure branch
- working hours
- membership roles
- branch access
- org switcher/context
- consent templates if applicable

### WF-002 Member Authentication and Access

Check:

- login/session
- PIN setup/verify/recovery if implemented
- role-based permissions
- branch-scoped access
- staff/provider/admin distinctions

### WF-003 Patient Registration and Profile

Check:

- create dental patient
- update demographics
- medical history
- allergies/contraindications if in scope
- dentition initialization
- archive/deactivate/delete behavior
- import/export
- duplicate/merge behavior if applicable

### WF-004 Scheduling and Appointment Lifecycle

Check:

- create appointment
- reschedule
- cancel
- check-in
- no-show if applicable
- reject/confirm if booking module applies
- appointment-to-visit linkage
- working hours and schedule exceptions

### WF-005 Visit Creation and Clinical Workspace

Check:

- new visit creation
- active visit selection
- visit status lifecycle
- visit note creation
- charting
- treatment entries
- clinical attachments
- completed/locked behavior

### WF-006 Dental Charting

Check:

- 32-tooth adult charting
- pediatric dentition if in scope
- tooth-level status
- surfaces
- condition codes
- notes
- baseline vs current visit
- proposed vs completed work
- tooth history
- locked/past visit protection

### WF-007 Treatment Planning

Check:

- create treatment plan
- version treatment plan
- accept treatment plan
- decline/dismiss items
- carry-over proposed/diagnosed items
- apply treatment templates
- treatment status transitions
- connection to billing

### WF-008 Consent and Clinical Safety

Check:

- consent form creation/signing
- consent required before performed treatment if applicable
- signed note protection
- addenda/amendments
- audit trail
- destructive action safeguards

### WF-009 Perio Charting

Check:

- create perio chart
- tooth readings
- probing depths
- bleeding/suppuration/mobility/recession if in scope
- complete perio chart
- visit linkage
- history comparison if in scope

### WF-010 Imaging and Cephalometric Workflow

Check:

- imaging study
- measurements
- findings
- calibration
- ceph landmarks
- recompute analysis
- reports
- image-to-visit or patient linkage
- read-only past analysis if finalized

### WF-011 Prescriptions, Lab Orders, and Clinical Documents

Check:

- prescription creation
- lab order creation
- consent signing
- attachments
- amendments
- patient/visit linkage
- auditability

### WF-012 Billing and Collections

Use Stripe/Square/QuickBooks-level clarity as benchmark, not feature bloat.

Check:

- dental invoice
- treatment-to-charge linkage
- discounts
- partial payments
- payment plans
- receipts
- refunds/reversals
- patient balance
- collections summary
- statement generation
- audit trail
- status clarity: unpaid, partially paid, paid, refunded, overdue

### WF-013 Patient Medical Document / PMD

Check:

- generate PMD
- import PMD
- export PMD
- visit PMD retrieval
- patient-friendly portability
- data scope clarity
- privacy/security assumptions

### WF-014 Notifications, Comms, Audit, Storage

Check:

- notifications
- mark read/all read
- email templates/queue if applicable
- chat/comms if applicable
- file uploads/downloads
- audit logs
- event history

---

## Module Architecture and Boundary Audit

Do not assume the current module list is correct. Treat `MODULES.md` as the current implementation inventory only.

For each module, evaluate:

- Is the module too broad?
- Is it too thin to justify being separate?
- Does it duplicate another module?
- Does it mix unrelated responsibilities?
- Does it represent a clear bounded context?
- Are business rules located in the right module?
- Are workflows split across modules in a confusing way?
- Are generic/base modules properly separated from dental-specific modules?
- Should this module be kept, split, merged, renamed, or moved?

Special boundary checks:

- `patient` vs `dental-patient`
- `booking` vs `dental-scheduling`
- `billing` vs `dental-billing`
- `emr` vs `dental-visit` / `dental-clinical`
- `dental-visit` vs `dental-perio` vs `dental-imaging`
- `dental-clinical` vs prescriptions / lab orders / consents / amendments
- `shared` RBAC/tenancy vs per-module authorization
- `dental-pmd` as standalone bounded context vs export layer

For each recommendation, classify:

- `KEEP`
- `SPLIT`
- `MERGE`
- `RENAME`
- `MOVE_RESPONSIBILITY`
- `BACKLOG_REVIEW`

Do not recommend restructuring purely for elegance. Recommend changes only if they improve workflow clarity, testability, maintainability, security/tenancy enforcement, or production usefulness.

---

## Module Depth Audit

For each module, evaluate:

```md
## Module: [name]

### Functional Depth

- What user jobs does this module support?
- Are endpoints merely CRUD or workflow-aware?
- Are business rules enforced?
- Are edge cases handled?

### Workflow Integration

- What upstream workflows feed this module?
- What downstream workflows depend on it?
- Are cross-module transitions reliable?

### Data Lifecycle

- Create
- Update
- Finalize/sign/lock
- Archive/deactivate/delete
- Versioning/history
- Audit trail

### Production Usefulness

- Would a real clinic use this as-is?
- What would block adoption?
- What is overbuilt or unnecessary?

### Findings
