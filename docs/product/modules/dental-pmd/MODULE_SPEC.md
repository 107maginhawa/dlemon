<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all -->

# Module Specification: dental-pmd

---
Spec Version: 1.0 | Last Updated: 2026-05-24
---

## 1. Module Overview
**Purpose:** Portable Medical Document generation (per-visit signed snapshots) and import of external PMDs. PMDs are immutable, checksum-verified compliance records. One completed visit = one PMD.

**Users:** dentist_owner, dentist_associate (generate), staff_full (view), patient (download)

**Related:** dental-visit (source — completed visit required, BR-021), dental-clinical (clinical data in snapshot), dental-org (assertBranchAccess), storage (PMD file storage)

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| PMD | Portable Medical Document — open signed document for portable health records |
| Checksum | SHA-256 of serialized visit snapshot; verified on import (BR-021) |
| ImportedPMD | External PMD stored as-is; never merged into editable records (BR-022) |

---

## 3. Workflows
WF-021: Generate PMD (dentist, post visit completion, BR-021) | WF-022: Import external PMD (dentist/staff, BR-022) | WF-066 [INFERRED]: Download PMD (dentist, patient)

---

## 5. Business Rules
| Rule ID | Rule | Expected Behavior |
|---------|------|-------------------|
| BR-021 | PMD = visit snapshot; immutable; future visit changes don't alter it | Checksum verified |
| BR-022 | Imported PMD stored read-only; no auto-merge | 405 on PUT/PATCH/DELETE |

---

## 6. Permissions
Generate PMD: dentist_owner, dentist_associate | Import PMD: dentist_owner, dentist_associate, staff_full | Download: dentist_owner, dentist_associate, patient (own PMDs)

---

## 7. Data Requirements
**`pmd_document`:** id, visit_id, patient_id, branch_id, generated_at, checksum (SHA-256), storage_file_id, format_version
**`imported_pmd`:** id, patient_id, branch_id, imported_at, storage_file_id, source_description, checksum

---

## 7b. Aggregate Boundaries
PMDDocument: immutable after creation. ImportedPMD: read-only aggregate root. Both reference Visit/Patient by UUID (loose coupling).

---

## 8. State Transitions
PMDDocument: generated (terminal — no transitions). ImportedPMD: imported (terminal — read-only).

---

## 9. UI/UX Requirements
PMD list per patient: generated date, visit date, download button. Import: file upload + validation. States: Loading, List, Download progress, Import error.

---

## 10. API Expectations
POST /dental/pmd/generate (visitId, BR-021 — visit must be completed), GET /dental/pmd/:patientId (list), GET /dental/pmd/:id/download, POST /dental/pmd/import (file upload, BR-022), GET /dental/pmd/imported/:id

---

## 10b. Domain Events
Published: DE-017 PMDGenerated (→ notifs: patient download link, dental-audit)
Consumed: DE-002 VisitCompleted (triggers PMD-eligible flag)

---

## 11. Acceptance Criteria
**AC-PMD-001:** Generate PMD for active (not completed) visit → 422.
**AC-PMD-002:** PATCH imported PMD → 405 (BR-022).
**AC-PMD-003:** Checksum mismatch on verify → reject with CHECKSUM_MISMATCH.
**AC-PMD-004:** PMD content matches visit snapshot at generation time (future visit edits don't change PMD).

---

## 12. Test Expectations
Unit: BR-021 snapshot integrity + checksum, BR-022 read-only guard.
Integration: complete visit → generate PMD → verify checksum.

---

## 13. Edge Cases
- GDPR erasure request: PMD cannot be deleted (signed, non-repudiable); anonymize DB record only
- Import with corrupted file → 422 CHECKSUM_MISMATCH
- Multiple PMDs per visit (re-generate) → allowed, creates new version [VERIFY]

---

## 14. Dependencies
**Internal:** dental-visit (completed visit required), dental-clinical (snapshot data), dental-org (assertBranchAccess), storage (file store), notifs (download notification)

---

## 15. Error Handling
Visit not completed → 422 VISIT_NOT_COMPLETED | Import: 422 CHECKSUM_MISMATCH | Imported PMD write → 405

---

## 16. Performance Expectations
PMD generation < 5s (async preferred). Download < 2s (signed URL from S3). Volume: ~5 PMDs/day/branch.

---

## 17. Observability Hooks
dental-pmd.generated (INFO, pmdId, visitId), dental-pmd.imported (INFO), dental-pmd.checksum-failed (WARN). No PHI.

---

## 18. Feature Flags
dental_pmd_async_generation: false (enable async PMD generation via pg-boss)

---

## 19. Vertical Slice Plan
PMD-S1: Generate + checksum | PMD-S2: Download | PMD-S3: Import + read-only guard | PMD-S4: Async generation job

---

## 20. AI Instructions
1. PMD generation must be atomic — either full snapshot or fail.
2. No DB-level FKs to dental-visit (loose coupling) — use UUID ref only.
3. ImportedPMD: no PATCH/PUT/DELETE routes at router level.
4. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
