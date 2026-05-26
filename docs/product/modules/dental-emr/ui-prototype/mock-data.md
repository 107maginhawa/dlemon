# Mock data — dental-emr
<!-- oli: v3-dentalemon | dental-emr | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Patient `pt_001` imported records:
- `emr_001` — Royal Melbourne Hospital, type=hospital, record_date 2024-11-20, FHIR JSON; 2 diagnoses, 3 meds, 0 labs
- `emr_002` — Dr Lee GP Clinic, type=gp, record_date 2025-01-08, PDF referral letter (opaque)
- `emr_003` — PathLab Australia, type=lab, record_date 2025-02-15, FHIR JSON; 0 diagnoses, 0 meds, 4 lab observations (HbA1c 7.2% high, WBC 6.4 normal, Hemoglobin 13.8 normal, Platelets 240 normal)

Imported by: `usr_dentist_owner_1` for `emr_001` and `emr_003`; `usr_dentist_assoc_2` for `emr_002`.
