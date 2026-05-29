# TDD_PROOF — Wave 1 dental-pmd P2/P3 mechanical fixes

## EF-PMD-007: allow patient role in exportPMD download handler

**Files changed:**
- `services/api-ts/src/handlers/dental-pmd/exportPMD.ts`
- `services/api-ts/src/handlers/patient/repos/patient-pmd.facade.ts`

**Change summary:**
- Extended `getPatientForPMD` facade to expose the `person` (personId) field alongside `id` and `preferredBranchId`.
- In `exportPMD`, fetched the PMD list before the auth check so the patient's identity can be resolved.
- Added a patient-self bypass: if `patient.person === user.id`, the staff `assertBranchRole` check is skipped — the patient can download their own PMD without a branch membership row.
- Staff access path (dentist_owner, dentist_associate, staff_full) is unchanged.

**Commit:** `976969a7` — `fix(dental-pmd): EF-PMD-007 — allow patient role in exportPMD download handler`

**Typecheck:** no new errors in `exportPMD.ts` or `patient-pmd.facade.ts`

---

## EF-PMD-008: add index.ts barrel export to dental-pmd handler directory

**Files changed:**
- `services/api-ts/src/handlers/dental-pmd/index.ts` (new file)

**Change summary:**
- Created a barrel that re-exports all seven dental-pmd handler functions:
  `exportPMD`, `generatePMD`, `getImportedPMD`, `getPMDForVisit`, `importPMD`, `listImportedPMDs`, `listPMDs`.
- Consumers can now import from `@/handlers/dental-pmd` instead of individual file paths.

**Commit:** `bc64bc7c` — `fix(dental-pmd): EF-PMD-008 — add index.ts barrel export to dental-pmd handler directory`

**Typecheck:** no errors on `index.ts`
