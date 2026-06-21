/**
 * V-DG-002 / G3c — free-text clinical PHI scrub on erasure.
 *
 * DATA_GOVERNANCE.md §1.2 + §3 name `medical_history_entry.notes` and
 * `prescription.instructions` as free-text PII. Anonymizing the Person/Patient
 * FK does NOT remove a patient name/identifier typed INSIDE those free-text
 * columns, so approveErasure must scrub them. This proves the whole flow:
 * request → approve → both free-text columns null, coded clinical labels kept.
 *
 * (The broader residual free-text set — visit_notes/chief_complaint/perio/
 * consent_refusal/amendment/lab_order/etc. — is a documented ruling-pending
 * follow-up in DATA_GOVERNANCE.md §3; see that section.)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain } from '@/tests/fixtures/seed-clinical-chain';
import { medicalHistoryEntries } from '../dental-clinical/repos/medical-history.schema';
import { prescriptions } from '../dental-clinical/repos/prescription.schema';
import { requestErasure, approveErasure } from './erasure-service';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;
const TENANT = 'd2000000-0000-4000-8000-000000000077';
const REQUESTER = 'a2000000-0000-4000-8000-000000000077';
const REVIEWER = 'a2000000-0000-4000-8000-000000000078';

describe('erasure scrubs doc-named free-text clinical PHI (V-DG-002 / G3c)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;
  let ids: Awaited<ReturnType<typeof seedClinicalChain>>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    ids = await seedClinicalChain(db, { branches: 1, patients: 2, memberships: 1, visits: 1 });

    await db.insert(medicalHistoryEntries).values({
      patientId: ids.PATIENT_1,
      entryType: 'condition',
      displayName: 'Hypertension',
      notes: 'Patient John Smith — controlled with lisinopril 10mg',
    });
    // A SECOND, non-subject patient's note — must SURVIVE the subject's erasure.
    await db.insert(medicalHistoryEntries).values({
      patientId: ids.PATIENT_2,
      entryType: 'condition',
      displayName: 'Asthma',
      notes: 'Other patient — inhaler PRN',
    });
    await db.insert(prescriptions).values({
      visitId: ids.VISIT_1,
      patientId: ids.PATIENT_1,
      prescriberMemberId: ids.MEMBERSHIP_1,
      drugName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'TID',
      instructions: 'For John Smith — take with food until finished',
    });
  });

  afterEach(() => teardown());

  test('approve nulls medical_history.notes + prescription.instructions, retains coded labels', async () => {
    const req = await requestErasure(db, noopLogger, {
      subjectPersonId: ids.PERSON_1,
      tenantId: TENANT,
      reason: 'GDPR Art.17 subject request',
      requestedBy: REQUESTER,
    });
    const { request } = await approveErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER });
    expect(request.status).toBe('anonymized');

    const [mh] = await db
      .select()
      .from(medicalHistoryEntries)
      .where(eq(medicalHistoryEntries.patientId, ids.PATIENT_1));
    expect(mh!.notes).toBeNull(); // free-text PHI scrubbed
    expect(mh!.displayName).toBe('Hypertension'); // coded clinical label retained

    const [rx] = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.patientId, ids.PATIENT_1));
    expect(rx!.instructions).toBeNull(); // free-text PHI scrubbed
    expect(rx!.drugName).toBe('Amoxicillin'); // drug name retained
  });

  test('does NOT scrub another patient — erasing the subject leaves a second patient untouched', async () => {
    const req = await requestErasure(db, noopLogger, {
      subjectPersonId: ids.PERSON_1,
      tenantId: TENANT,
      reason: 'GDPR Art.17 subject request',
      requestedBy: REQUESTER,
    });
    await approveErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER });

    // The other patient's free-text note must be intact (scrub is scoped to the subject).
    const [other] = await db
      .select()
      .from(medicalHistoryEntries)
      .where(eq(medicalHistoryEntries.patientId, ids.PATIENT_2));
    expect(other!.notes).toBe('Other patient — inhaler PRN');
  });
});
