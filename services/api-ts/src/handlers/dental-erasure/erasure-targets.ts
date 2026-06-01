/**
 * Built-in erasure targets (V-DG-002).
 *
 * Each target binds an entity type to its PII-anonymization op, accessed ONLY
 * through the owning module's `*-erasure.facade.ts` (Phase 10 boundary lint) —
 * never the other module's repos/schemas directly. Targets only anonymize;
 * none touches the audit trail.
 *
 * Coverage per DATA_GOVERNANCE.md §3:
 *  - person / patient : the PII records (name→pseudonym, identifiers nulled).
 *  - consent_form     : signer-identity PII (signature, name snapshot, revokedBy).
 *  - imaging          : DICOM/finding/annotation identifiers + image S3-delete handles.
 *  - visit / treatment / prescription / invoice : NO row-level PII to anonymize —
 *    they only reference patientId (which resolves to the anonymized Person) and
 *    otherwise hold retained clinical/billing codes, so Person+Patient
 *    anonymization fully covers them (verified per-module; no target needed).
 */

import type { DatabaseInstance } from '@/core/database';
import type { ErasureTarget, ErasureTargetRegistry } from './erasure-engine';
import { anonymizePersonPii } from '@/handlers/person/repos/person-erasure.facade';
import { anonymizePatientPiiByPerson } from '@/handlers/patient/repos/patient-erasure.facade';
import { anonymizeConsentFormsByPerson } from '@/handlers/dental-clinical/repos/clinical-erasure.facade';
import { anonymizeImagingByPerson } from '@/handlers/dental-imaging/repos/imaging-erasure.facade';

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
 * Imaging: null DICOM/finding/annotation identifiers + archive image rows.
 * NOTE: physical S3 radiograph deletion is a storage-service follow-up — the
 * facade surfaces the stored-file ids that must be deleted out-of-band.
 */
const imagingTarget: ErasureTarget = {
  entityType: 'imaging',
  async anonymize(db: DatabaseInstance, subjectPersonId: string) {
    return anonymizeImagingByPerson(db, subjectPersonId);
  },
};

export const ERASURE_TARGETS: ErasureTargetRegistry = {
  person: personTarget,
  patient: patientTarget,
  consent_form: consentFormTarget,
  imaging: imagingTarget,
};
