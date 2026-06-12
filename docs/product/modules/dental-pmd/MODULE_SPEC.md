<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all | updated: 2026-05-25 SBT-011 -->

# Module Specification: dental-pmd

---
Spec Version: 1.0 | Last Updated: 2026-05-24
---

## 1. Module Overview
**Purpose:** Portable Medical Document generation (per-visit checksum-sealed snapshots) and import of external PMDs. PMDs are immutable, checksum-verified compliance records. One completed visit = one PMD. (Digital signing per FR12.4 is honestly deferred to Phase-2 — see §8b; V1 seals integrity with a SHA-256 checksum, not a signature.)

**Users:** dentist_owner, dentist_associate (generate), staff_full (view), patient (download)

**Related:** dental-visit (source — completed visit required, BR-021), dental-clinical (clinical data in snapshot), dental-org (assertBranchAccess), storage (PMD file storage)

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| PMD | Portable Medical Document — open, checksum-sealed document for portable health records. (Canonical expansion; supersedes any "Patient Medical Data"/"Patient Medical Dossier" usage — V-PMD-009. Digital signing is Phase-2 — see §8b.) |
| Checksum | SHA-256 of serialized visit snapshot; verified on import (BR-021) |
| ImportedPMD | External PMD stored as-is; never merged into editable records (BR-022) |
| Safety Floor merge | V-PMD-012: the act of surfacing an imported PMD's safety-critical items (allergies, conditions, medications) into the patient's **Safety Floor** — the dental-patient aggregate's minimum set of safety-critical info a dentist must always see (owned by dental-patient, see `getDentalPatientSafetyFloor`). Merge is **add-only**: it never mutates the imported PMD content and never overwrites existing Safety Floor entries. The `imported_pmd.safety_floor_merged` flag records whether this has occurred. |

---

## 3. Workflows
WF-021: Generate PMD (dentist, post visit completion, BR-021) | WF-022: Import external PMD (dentist/staff, BR-022) | WF-066 [INFERRED]: Download PMD (dentist, patient — patient may download/export their OWN PMDs, V-PMD-008/EF-PMD-007) | P2-18: Whole-patient continuity-of-care export (FHIR R4 Bundle — `GET /dental/pmd/patient/:patientId/care-record`; authorized staff OR patient-self, HIPAA right-of-access)

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
> Reconciled 2026-06-08 to the implemented schema (`repos/pmd-document.schema.ts`). The
> original draft listed `storage_file_id`/`format_version` and a `branch_id` on `imported_pmd`;
> there is no object-store file flow for PMDs (content is stored inline as JSON — see
> API_CONTRACTS V-PMD-006) and `imported_pmd` has NO `branch_id` column (access is derived from
> the patient's preferred branch). Below is the real column set.

**`pmd_document`:** id, visit_id, patient_id, author_member_id, branch_id (nullable), status (`generated`|`signed`|`superseded`), content (JSON snapshot, inline), signature (nullable), signed_at (nullable), supersedes_id (nullable, self-FK), checksum (`sha256-<hex>`), created_at, updated_at
**`imported_pmd`:** id, patient_id, source_facility, source_reference (nullable), source_description (required, max 200), content (inline), imported_at, safety_floor_merged, created_at, updated_at — **no `branch_id`, no `storage_file_id`**

---

## 7.1 Data Scope

The PMD snapshot aggregates data from the source modules at generation time. Fields are serialized into an immutable JSON content blob; the snapshot is never updated after creation.

**V1 snapshot field set (narrowed — AHA decision #6).** PRD FR12.1 lists a broader content set; for V1 the snapshot ships the **decision-free minimum**: visit identity + treatments + prescriptions + the **safety floor** + **narrowed demographics**. The narrowed set documented here is the **V1 truth**; the remaining FR12.1 fields (e.g. full identifiers, structured ICD-10 diagnoses, free-text clinical notes) are deferred. The attesting author is the visit's **treating dentist**, not the actor who triggered generation (AHA decision #5).

| Source Module | Fields Included | Rationale |
|---|---|---|
| dental-visit | visit.id, visit.activatedAt/createdAt (as `visitDate`) | Core visit identity and date; required for compliance record |
| dental-visit (treatments) | treatment.id, cdtCode, description, toothNumber, surfaces, conditionCode, status, priceCents | Complete treatment record; CDT codes required for insurance portability |
| dental-clinical (prescriptions) | prescription.id, rxNormCode, drugName, dosage, frequency | Medication record at time of visit; required for continuity of care |
| dental-clinical (safety floor) | `safetyFloor` = active allergies, medications, conditions (each: displayName, code, codeSystem, notes, onsetDate) | FR12.1/FR12.3: the safety-critical data the document exists to carry; sourced from medical-history (active entries only) |
| dental-patient / person (demographics) | `demographics` = firstName, lastName, dateOfBirth, gender (narrowed set) | FR12.1 patient identity; narrowed to name/DOB/sex for V1 (decision #6) |
| dental-visit (treating dentist) | `authorMemberId` = visit.dentistMemberId | Attestation: the clinician who delivered the care attests the PMD (decision #5); the triggering actor is captured in the audit trail |

**Excluded / deferred:** dental_chart tooth state (large JSONB, not standard PMD format), lab orders (not yet in snapshot scope), imaging studies (separate export flow); full FR12.1 demographics (insurance/identifiers/address), structured ICD-10 diagnosis list, and free-text clinical notes are **Phase-2** (narrowed-set decision #6). PMD digital signing (FR12.4) is honestly deferred to Phase-2 (decision #4) — see §8b; the checksum seals content integrity in V1.

---

## 7.2 Import Contract

When an ImportedPMD row is created via POST /dental/pmd/import, the following invariants must hold:

1. **UUID refs only** — imported PMD rows store `patient_id` as a plain UUID. No DB foreign key constraints to `dental_patient` (so an import from a defunct facility is not blocked by a missing FK target, and survives later patient anonymisation/erasure). (The original draft listed `branch_id`/`imported_by_member_id` columns; neither exists — `imported_pmd` derives access from the patient's preferred branch and audits the importer via the audit log, not a stored column.)
2. **No FK joins** — the import pipeline must not JOIN imported_pmd rows against any live dental table in read paths.
3. **Read-only after import** — no UPDATE or DELETE operations on imported_pmd rows after creation. Router must reject PATCH/PUT/DELETE at the route level (405 Method Not Allowed, not a 403).
4. **Checksum required** — import must provide a checksum field; server verifies it against the uploaded content before creating the row. Missing or mismatched checksum → 422 CHECKSUM_MISMATCH.
5. **source_description required** — the originating system must be identified (e.g., "Open Dental v21.1", "Dentrix G7"). Enables audit trail for data provenance.

---

## 7b. Aggregate Boundaries
PMDDocument: immutable after creation. ImportedPMD: read-only aggregate root. Both reference Visit/Patient by UUID (loose coupling).

---

## 8. State Transitions
PMDDocument: `generated` → `superseded` (a re-generation for the same visit creates a new `generated` document and marks the prior one `superseded`). A `superseded` document is otherwise immutable and retained for the audit trail (never deleted). `superseded` is terminal. The `generated` → `signed` transition is **Phase-2 reserved** (FR12.4 — see §8b): no V1 code path produces a `signed` PMD. ImportedPMD: `imported` (terminal — read-only).

> V-PMD-011: `generated` is the entry state, not strictly terminal. Re-generation (BR/§13 "multiple PMDs per visit") is the only path that mutates an existing row's status, transitioning the older row `generated → superseded` via `PMDDocumentRepository.supersede()`. Content/checksum of a superseded row are never altered.

---

## 8b. Signing posture (FR12.4 — Phase-2 honestly deferred)
**Decision #4 (2026-06-12): strip + defer honestly.** V1 does **not** digitally sign PMDs. The document's integrity is sealed with a **SHA-256 checksum** (`sha256-<hex>`), which provides **tamper-evidence** (any content change is detectable on import/verification) but is **NOT** a digital signature and provides **NO non-repudiation** (it does not cryptographically bind a facility's identity to the content).

- The `signature` / `signed_at` columns, the `signed` document status, and `PMDDocumentRepository.sign()` are **reserved forward-compatible stubs** with **zero production callers** — no PMD ever reaches the `signed` state in V1. Retained (not removed) to avoid a destructive enum/column migration and to keep the Phase-2 signing path ready.
- Facility digital signing — a self-signed pilot certificate scheme binding the issuing clinic to each PMD (FR12.4) — is **Phase-2**. It requires per-clinic cert custody (dental-org settings) and is out of V1 scope.
- **Honesty rule:** product copy, API descriptions, and recipient-facing language must say "checksum-sealed / integrity-verified", **never** "digitally signed" or "non-repudiable", until FR12.4 ships. Shipping a non-repudiation claim we do not enforce is a compliance liability.

---

## 9. UI/UX Requirements
PMD list per patient: generated date, visit date, download button. Import: file upload + validation. States: Loading, List, Download progress, Import error.

---

## 10. API Expectations
PMD generation/export is **visit-scoped** (matches API_CONTRACTS.md + generated routes; V-PMD-006). Canonical routes:
POST /dental/visits/:visitId/pmd (generate, BR-021 — visit must be completed), GET /dental/visits/:visitId/pmd (returns 204 when no PMD yet — matches getVisitPerioChart precedent), GET /dental/visits/pmd?patientId= (list — canonical path is `/dental/visits/pmd`, **not** `/dental/pmd`; V-PMD-006), GET /dental/visits/:visitId/pmd/export (download, inline JSON — no presigned URL), POST /dental/pmd/import (JSON inline `content`, **not** multipart upload; BR-022), GET /dental/pmd/imported?patientId= (list), GET /dental/pmd/imported/:id, GET /dental/pmd/patient/:patientId/care-record (P2-18 whole-patient FHIR R4 continuity-of-care export).

---

## 10b. Domain Events
Published: DE-017 PMDGenerated (→ notifs: patient download link, dental-audit)
Consumed: DE-002 VisitCompleted (triggers PMD-eligible flag)

Per ADR-006 (domain-events-descope), domain events here are audit-log-only semantic markers — there is NO event bus. Producers satisfy them by writing the corresponding dental_audit_log row synchronously via logAuditEvent(); reactive consumers (e.g. notifs) are deferred to a future phase. No publisher/emit scaffolding is required.

DE-017 PMDGenerated is satisfied by the `pmd.generated` audit row written synchronously in `generatePMD.ts`.

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
- GDPR erasure request: PMD cannot be deleted (immutable, checksum-sealed compliance record); anonymize DB record only
- Import with corrupted file → 422 CHECKSUM_MISMATCH
- Multiple PMDs per visit (re-generate) → allowed, creates new version [VERIFY]

---

## 14. Dependencies
**Internal:** dental-visit (completed visit required), dental-clinical (snapshot data), dental-org (assertBranchAccess), storage (file store), notifs (download notification)

---

## 15. Error Handling
| Condition | Code | Status |
|-----------|------|--------|
| Generate from a non-completed/non-locked visit (BR-021/AC-PMD-001) | `VISIT_NOT_COMPLETED` | 422 |
| `body.patientId` disagrees with the visit's patient (N-PMD-02) | `PATIENT_VISIT_MISMATCH` | 422 |
| Import `checksum` does not match SHA-256 of `content` (EF-PMD-001) | `CHECKSUM_MISMATCH` | 422 |
| `sourceDescription` > 200 chars (V-PMD-010) | `VALIDATION_ERROR` | 422 |
| Missing required body/query field (e.g. patientId) | `VALIDATION_ERROR` | 400 |
| PATCH / PUT / DELETE on an imported PMD (BR-022/AC-PMD-002) | `IMPORTED_PMD_IMMUTABLE` | 405 |
| Caller lacks the required branch role / membership | `BRANCH_ACCESS_DENIED` / `FORBIDDEN` | 403 |
| Visit / patient / imported-PMD not found | `NOT_FOUND` | 404 |
| Unauthenticated | `UNAUTHORIZED` | 401 |

> Note: `GET /dental/visits/:visitId/pmd` returns **204** (not 404) when the visit exists but
> has no PMD yet — an absent optional sub-resource, matching the perio precedent.

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
