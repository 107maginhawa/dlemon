# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

The tagged entries below track released versions. Substantial product work
has landed since `0.2.0.0` (2026-05-18) on feature branches; it is recorded in
the git history and merged PRs rather than per-commit here, and the next
version bump will consolidate it. For interim changes see `git log
v0.2.0.0..HEAD` and the PR list; for tracked debt see
[docs/KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md).

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
