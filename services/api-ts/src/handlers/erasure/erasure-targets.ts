/**
 * Built-in erasure targets (V-DG-002).
 *
 * Each target binds an entity type to its PII-anonymization op, accessed ONLY
 * through the owning module's `*-erasure.facade.ts` (Phase 10 boundary lint) —
 * never the other module's repos/schemas directly. Targets only anonymize;
 * none touches the audit trail.
 *
 * Per DATA_GOVERNANCE.md §3 more entity types (visit/treatment/prescription/
 * imaging/invoice patient-reference anonymization) are in scope — add a facade
 * + target for each as those slices land. Today: person + patient.
 */

import type { DatabaseInstance } from '@/core/database';
import type { ErasureTarget, ErasureTargetRegistry } from './erasure-engine';
import { anonymizePersonPii } from '@/handlers/person/repos/person-erasure.facade';
import { anonymizePatientPiiByPerson } from '@/handlers/patient/repos/patient-erasure.facade';

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

export const ERASURE_TARGETS: ErasureTargetRegistry = {
  person: personTarget,
  patient: patientTarget,
};
