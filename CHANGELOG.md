# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

This section consolidates the dental practice-management build-out that has
landed on top of the `0.2.0.0` template baseline (2026-05-18). It is a curated
summary grouped by domain, not a per-commit log; the full history is in the git
log and the merged PRs. For tracked debt see
[docs/KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md); for architectural
decisions see [docs/decisions/](./docs/decisions/). No version has been cut yet
— the next release bump will tag this set.

### Added

- **Patient records & treatment planning**: patient contacts/guardians and
  household (family file) with guarantor; per-channel communication consent;
  duplicate-patient detection; CSV bulk import; treatment plans with a plan-level
  FSM, status history, clinical phasing/priority sequencing, alternate cases, and
  CDT versioning; recalls and tasks with their own FSMs.
- **Clinical workflows**: structured informed consent (content, refusal,
  revoke/history, per-clinic template bodies); prescriptions (Rx list and
  dispense/cancel lifecycle, drug–drug interaction check, allergy
  blocking-with-override, DEA/NPI/controlled-substance legal fields); ASA
  classification with periodic re-confirmation; lab orders; occlusion screening
  and post-op instruction templates; dental alerts; clinical-note amendments.
- **Dental charting**: per-notation rendering (FDI/Universal/Palmer); mixed and
  pediatric dentition; multi-select layers and a diff/compare overlay; a
  cumulative cross-visit "living document" (Proposed/Completed/Declined layers,
  baseline carry-over into new visits); condition-vocabulary findings that drive
  treatments; selected-tooth context panel; structured chart export; an
  append-only `dental_chart_version` audit table.
- **Workspace & charting UX pass** (`ux/workspace-first-slice`): a command-center
  dashboard Home (schedule timeline with now-line, attention queue, KPI ribbon); a
  Default↔clinic-white theme toggle; and a chart-readability sweep so the odontogram
  never lies at a glance — chart-layer precedence flipped to proposed > completed (a
  tooth with new pending work reads Planned, not a green Treated ring), an obvious
  dotted "Planned" tooth edge, the tooth layer relabeled "Completed" → "Treated",
  multi-select layer chips that carry their own cue swatch (filter doubles as legend),
  per-visit status layers painted on historical carousel cards, a multi-surface pip on
  the grid, the payment modal scoped to the current visit's invoice, and the per-tooth
  slideout "Treatment Breakdown" turned into a truthful timeline (date column, active
  visit's in-progress work included, status-honest badges).
- **Periodontal**: periodontal charting (MVP), read-only Clinical Attachment
  Level per site, 2017 AAP/EFP staging/grading/extent assistance, multi-exam
  comparison (History view), and voice/hands-free charting.
- **Imaging & cephalometrics**: cephalometric analysis workspace with Downs,
  Tweed, McNamara, Jarabak, and Ricketts analyses plus population norms;
  superimposition registration engine with deltas; versioned 2-point calibration;
  assistant-prepares/clinician-finalizes sign-off; explicit report revision
  lineage and analysis/norm/formula provenance pinning; an AI/auto-landmarking
  Phase-0 seam (detector + provenance + safety + UX); DICOM and CBCT ingest
  (MIME allowlist, PixelSpacing calibration, viewer handoff); FMX anatomical mount
  layout; image-library metadata (diagnostic/quality/tags + filters) and context
  links to treatment plans/ortho/reports.
- **Scheduling**: operatories with appointment FKs; online self-service patient
  booking (backend + public UI); reminders + recall engine; drag-to-reschedule;
  waitlist/ASAP fill; a confirmed-appointment status lifecycle; side-by-side
  columns for overlapping appointments; a queue board.
- **Billing & revenue cycle**: payment plans (create dialog, idempotent replay),
  discounts, payment void, mark-invoice-uncollectible write-off (BR-013), AR aging
  buckets with batch statements, and a PH insurance / revenue-cycle backend with a
  claims worklist and coverage surfaces.
- **Org, onboarding & access control**: self-service clinic onboarding with a
  one-active-org invariant; provisional-org PHI write gate and owner activation;
  fee-schedule GET/PATCH; a granular per-feature permission grid; provider
  credentials on membership; HIPAA auto-logoff on PIN idle timeout; server-side
  PIN session. New roles (hygienist, read_only, treatment_coordinator) with a
  systematic `assertBranchRole` matrix across 37 write handlers and an
  RBAC-filtered dashboard sidebar; a dental-assistant clinical-assist workflow.
- **Compliance & data governance**: right-to-erasure workflow (subject queue,
  physical S3 radiograph/attachment deletion, person-only rejection); real
  LegalHold store wired into erasure and retention; policy-driven data-retention
  enforcement with appointment auto-purge; a DB-level append-only trigger on
  `dental_audit_log`, a queryable audit table, and an owner audit viewer.
- **Offline-first sync**: `localId` idempotency on visit/treatment/invoice/chart
  creates; clock-aware last-write-wins for baseline tooth merges; a monotonic
  status-merge primitive; durable persistence of rejected stale writes as sync
  conflicts (with FE visibility/resolution); sync-metadata foundation and sync
  status badges.
- **Patient portal & case presentation**: patient self-service reads
  (`/me/appointments`, `/me/invoices` behind assert-self-patient) and a
  patient-facing case-presentation surface.
- **Platform & developer experience**: extracted `@monobase/ui` (35 shadcn
  primitives), `@monobase/shared-utils`, and `@monobase/ceph-math` packages;
  module-boundary lint and a no-duplicate-`operationId` generator gate; a
  `no-raw-fetch` lint enforcing SDK-only data access; a cross-layer contract-spine
  for AI extensibility; centralized error-taxonomy toasts; a Prometheus metrics
  endpoint with a latency-histogram middleware; an autocannon performance ratchet;
  a migration-safety lint; and OpenAPI drift CI. Numerous manual route groups were
  migrated to TypeSpec codegen.

### Changed

- Imaging list hook (`use-imaging-studies`) requires `branchId` and disables the
  query when missing, preventing spurious 400s (carried from 0.2.0.0 and extended
  across patient/billing/scheduling lists, which now show explicit error states).
- Tenant isolation is enforced at the application/repository layer (per-query
  tenant filters, `assertBranchRole`, mandatory `branchId` on list/report
  endpoints); DB row-level security is a tracked pre-GA gate
  ([ADR-010](./docs/decisions/ADR-010-tenant-isolation-rls-pre-ga.md)).

## [0.2.0.0] - 2026-05-18

### Added
- **Cephalometric analysis workspace**: full tracing overlay, landmark detection, and 8 clinical measurements (SNA, SNB, ANB, FMA, IMPA, Wits appraisal, facial convexity, Y-axis) in the imaging workspace
- **Ceph canvas components**: 7 composable canvas layers (CephTracingOverlay, CephLandmarkLayer, CephAngleArcLayer, CephWorkspacePanel, CephLayerPanel, CephMeasurementsPanel, CephLandmarkPalette)
- **Ceph report + print route**: CephReportView with patient summary, measurements table, and browser print support
- **PNG export**: one-click canvas export from the ceph workspace
- **E2E test suite**: 32 ceph-specific Playwright tests, all green; shared imaging harness helper
- **Comprehensive demo seed**: 10 patients with full clinical data — visits, treatments, imaging studies, billing, appointments, prescriptions, and notes across all modules
- **Imaging handler fixes**: modality and filename now correctly saved on study create; list endpoint reads filename from `dicomMetadata` instead of raw file UUID; frontend hook passes required `branchId` parameter

### Changed
- Imaging list hook (`use-imaging-studies`) accepts `branchId` and disables query when missing, preventing spurious 400 errors
- Demo seed defaults to "mixed" billing states: P0 paid, P1/P2 partial, P7 overdue (auto-patched), P9 draft

## [0.1.0.1] - 2026-05-09

### Fixed
- Patient profile page: PROF-03 test now uses `fireEvent.click` instead of hidden button workaround
- Patient profile page: removed hidden button workaround from component
- PROF-01–04 all verified passing (9/9 tests green)

### Changed
- Planning docs updated: REQUIREMENTS.md and STATE.md reflect Phase 3 completion
