/**
 * Built-in erasure targets (V-DG-002).
 *
 * Each target binds an entity type to its PII-anonymization op, accessed ONLY
 * through the owning module's `*-erasure.facade.ts` (Phase 10 boundary lint) —
 * never the other module's repos/schemas directly. Targets only anonymize;
 * none touches the audit trail.
 *
 * Coverage per DATA_GOVERNANCE.md §3:
 *  - person / patient    : the PII records (name→pseudonym, identifiers nulled).
 *  - consent_form        : signer-identity PII (signature, name snapshot, revokedBy).
 *  - medical_history     : free-text `notes` (systemic-health PII §1.2); codes retained.
 *  - prescription        : free-text `instructions` sig (PII §1.2); drug codes retained.
 *  - imaging             : DICOM/finding/annotation identifiers, image_link cleanup
 *                          (G6.3), + image S3-delete handles.
 *  - attachment          : x-ray/photo PII (fileName, note) + the backing S3-delete handle.
 *
 * KNOWN RESIDUAL (free-text columns that can embed identifiers inline and are NOT
 * yet scrubbed — anonymizing the patientId FK does not remove a name typed inside
 * a note). These are a RULING-PENDING follow-up (GDPR-scrub vs documented retain,
 * incl. the medico-legal-immutable consent_refusal/amendment): visit_notes (SOAP),
 * dental_visit.chief_complaint, dental_treatment.clinical_notes, dental_finding.note,
 * dental_perio_chart/reading.notes, consent_refusal.*, amendment.content,
 * lab_order.description, case_presentation.signer_name. Tracked in
 * DATA_GOVERNANCE.md §3 "KNOWN RESIDUAL — ruling pending". Do NOT add scrub targets
 * for the medico-legal-immutable tables without the documented legal ruling.
 */

import type { DatabaseInstance } from '@/core/database';
import type { ErasureTarget, ErasureTargetRegistry } from './erasure-engine';
import { anonymizePersonPii } from '@/handlers/person/repos/person-erasure.facade';
import { anonymizePatientPiiByPerson } from '@/handlers/patient/repos/patient-erasure.facade';
import {
  anonymizeConsentFormsByPerson,
  anonymizeMedicalHistoryByPerson,
  anonymizePrescriptionsByPerson,
} from '@/handlers/dental-clinical/repos/clinical-erasure.facade';
import { anonymizeAttachmentsByPersonDetailed } from '@/handlers/dental-clinical/repos/attachment-erasure.facade';
import { anonymizeImagingByPersonDetailed } from '@/handlers/dental-imaging/repos/imaging-erasure.facade';

/** The central PII record. Name → pseudonym, all other identifiers nulled. */
const personTarget: ErasureTarget = {
  entityType: 'person',
  async anonymize(db: DatabaseInstance, subjectPersonId: string) {
    const r = await anonymizePersonPii(db, subjectPersonId);
    return r.anonymized ? 1 : 0;
  },
};

/** Patient profile PII (emergency contact, provider/pharmacy, history, prefs). */
const patientTarget: ErasureTarget = {
  entityType: 'patient',
  async anonymize(db: DatabaseInstance, subjectPersonId: string) {
    return anonymizePatientPiiByPerson(db, subjectPersonId);
  },
};

/** Consent forms: redact signer identity (signature, name snapshot), keep state. */
const consentFormTarget: ErasureTarget = {
  entityType: 'consent_form',
  async anonymize(db: DatabaseInstance, subjectPersonId: string) {
    return anonymizeConsentFormsByPerson(db, subjectPersonId);
  },
};

/**
 * Imaging: null DICOM/finding/annotation identifiers + archive image rows, and
 * surface the storage `file` ids whose S3 objects still need a physical delete.
 * The engine aggregates these and the approve handler (which holds the storage
 * client) performs the physical S3 + storage-row delete after the anonymization
 * commits — see DATA_GOVERNANCE.md §3 "Delete S3 object (radiograph)".
 */
const imagingTarget: ErasureTarget = {
  entityType: 'imaging',
  async anonymize(db: DatabaseInstance, subjectPersonId: string) {
    const { rowsAnonymized, linksRemoved, fileIdsPendingS3Delete } =
      await anonymizeImagingByPersonDetailed(db, subjectPersonId);
    // linksRemoved (G6.3) are rows acted on — count them in the engine total.
    return { count: rowsAnonymized + linksRemoved, fileIdsPendingS3Delete };
  },
};

/**
 * Clinical attachments (x-ray/photo): null free-text PII (fileName, note), mark
 * the row deleted, and surface the backing storage `file` ids whose S3 objects
 * must be physically deleted — same orchestration as imaging (the approve
 * handler aggregates these and performs the S3 + storage-row delete after commit).
 */
const attachmentTarget: ErasureTarget = {
  entityType: 'attachment',
  async anonymize(db: DatabaseInstance, subjectPersonId: string) {
    const { rowsAnonymized, fileIdsPendingS3Delete } =
      await anonymizeAttachmentsByPersonDetailed(db, subjectPersonId);
    return { count: rowsAnonymized, fileIdsPendingS3Delete };
  },
};

/** Medical-history entries: scrub free-text systemic-health `notes`, keep codes. */
const medicalHistoryTarget: ErasureTarget = {
  entityType: 'medical_history',
  async anonymize(db: DatabaseInstance, subjectPersonId: string) {
    return anonymizeMedicalHistoryByPerson(db, subjectPersonId);
  },
};

/** Prescriptions: scrub free-text `instructions` sig, keep coded drug fields. */
const prescriptionTarget: ErasureTarget = {
  entityType: 'prescription',
  async anonymize(db: DatabaseInstance, subjectPersonId: string) {
    return anonymizePrescriptionsByPerson(db, subjectPersonId);
  },
};

export const ERASURE_TARGETS: ErasureTargetRegistry = {
  person: personTarget,
  patient: patientTarget,
  consent_form: consentFormTarget,
  medical_history: medicalHistoryTarget,
  prescription: prescriptionTarget,
  imaging: imagingTarget,
  attachment: attachmentTarget,
};
