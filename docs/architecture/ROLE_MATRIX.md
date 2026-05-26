# RBAC Role Matrix

## MemberRole Values

| Role | Description |
|---|---|
| `dentist_owner` | Practice owner. Full access including financial overrides and branch configuration. |
| `dentist_associate` | Associate dentist. Full clinical write access; cannot void payments or configure branch hours. |
| `staff_full` | Front-desk / office manager. Billing and patient admin access; no clinical write access. |
| `staff_view` | View-only staff. Read access only; no write operations. |

## Access Tiers

| Tier | Roles | When to use |
|---|---|---|
| `OWNER_ONLY` | `dentist_owner` | Destructive financial ops (void, discount) and branch configuration |
| `CLINICAL_WRITE` | `dentist_owner`, `dentist_associate` | Clinical documentation: consents, lab orders, prescriptions, attachments, imaging findings/measurements/ceph, dentition |
| `BILLING_WRITE` | `dentist_owner`, `dentist_associate`, `staff_full` | Patient admin, invoicing, payment recording, medical history, PMD generation |
| `ANY_MEMBER` | all 4 roles | Read operations — use `assertBranchAccess` (no role check needed) |

## Handler Operation → Tier Table

### dental-billing

| Handler | Operation | Tier |
|---|---|---|
| `applyDentalDiscount` | Apply discount to invoice | OWNER_ONLY |
| `voidDentalPayment` | Void a payment record | OWNER_ONLY |
| `createDentalInvoice` | Create invoice from visit | BILLING_WRITE |
| `createDentalPaymentPlan` | Create payment plan | BILLING_WRITE |
| `recordDentalPayment` | Record a payment | BILLING_WRITE |

### dental-scheduling

| Handler | Operation | Tier |
|---|---|---|
| `workingHours` (updateWorkingHours) | Set branch working hours | OWNER_ONLY |

### dental-patient

| Handler | Operation | Tier |
|---|---|---|
| `restoreDentalPatient` | Restore archived patient | OWNER_ONLY |
| `initializeDentition` | Initialize patient dentition | CLINICAL_WRITE |
| `importPatients` | Bulk import patients | BILLING_WRITE |
| `updateDentalPatient` | Update patient record | BILLING_WRITE |

### dental-clinical

| Handler | Operation | Tier |
|---|---|---|
| `createConsentForm` | Create consent form | CLINICAL_WRITE |
| `signConsentForm` | Sign consent form | CLINICAL_WRITE |
| `createLabOrder` | Create lab order | CLINICAL_WRITE |
| `updateLabOrder` | Update lab order | CLINICAL_WRITE |
| `updatePrescription` | Update prescription | CLINICAL_WRITE |
| `createAttachment` | Add visit attachment | CLINICAL_WRITE |
| `deleteAttachment` | Delete visit attachment | CLINICAL_WRITE |
| `createMedicalHistoryEntry` | Add medical history entry | BILLING_WRITE |
| `updateMedicalHistoryEntry` | Update medical history entry | BILLING_WRITE |

### dental-imaging

| Handler | Operation | Tier |
|---|---|---|
| `createImagingStudy` | Upload imaging study | CLINICAL_WRITE |
| `deleteImage` | Soft-delete image | CLINICAL_WRITE |
| `updateImageModality` | Reclassify image modality | CLINICAL_WRITE |
| `createFinding` | Add imaging finding | CLINICAL_WRITE |
| `deleteFinding` | Delete imaging finding | CLINICAL_WRITE |
| `updateFinding` | Update imaging finding | CLINICAL_WRITE |
| `createMeasurement` | Add measurement annotation | CLINICAL_WRITE |
| `deleteMeasurement` | Delete measurement annotation | CLINICAL_WRITE |
| `CephMgmt_batchUpsertCephLandmarks` | Upsert ceph landmarks | CLINICAL_WRITE |
| `CephMgmt_createCephReport` | Create ceph report | CLINICAL_WRITE |
| `CephMgmt_deleteCephLandmark` | Delete ceph landmark | CLINICAL_WRITE |
| `CephMgmt_recomputeCephAnalysis` | Recompute ceph analysis | CLINICAL_WRITE |
| `CephMgmt_updateCephLandmark` | Update ceph landmark | CLINICAL_WRITE |

### dental-visit

| Handler | Operation | Tier |
|---|---|---|
| `carryOverTreatments` | Carry over treatments to new visit | CLINICAL_WRITE |

### dental-pmd

| Handler | Operation | Tier |
|---|---|---|
| `generatePMD` | Generate PMD document | BILLING_WRITE |
| `exportPMD` | Export PMD as download | BILLING_WRITE |
| `importPMD` | Import external PMD | BILLING_WRITE |

## Implementation Notes

- All **read** handlers use `assertBranchAccess` (membership check only — no role filter).
- All **write** handlers use `assertBranchRole` with the appropriate tier's role list.
- `assertBranchRole` subsumes membership + role in one query; do not call `assertBranchAccess` before it.
- For Step 3 imaging handlers (`createImagingStudy`, `deleteImage`, `updateImageModality`): the old `repo.getMemberRole()` + local role list pattern is replaced by a single `assertBranchRole` call. Any additional business rules (e.g., BR-027 associate own-image restriction) remain in place after the auth gate.
