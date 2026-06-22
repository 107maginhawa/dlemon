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
import { labOrders } from '../dental-clinical/repos/lab-order.schema';
import { dentalVisits } from '../dental-visit/repos/visit.schema';
import { dentalTreatments, visitNotes } from '../dental-visit/repos/treatment.schema';
import { dentalFindings } from '../dental-visit/repos/dental-finding.schema';
import { dentalPerioCharts } from '../dental-perio/repos/perio-chart.schema';
import { dentalPerioToothReadings } from '../dental-perio/repos/perio-reading.schema';
import { dentalTreatmentPlans } from '../dental-patient/repos/treatment-plan.schema';
import { dentalCasePresentations } from '../dental-patient/repos/case-presentation.schema';
import { patients } from '../patient/repos/patient.schema';
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

// ───────────────────────────────────────────────────────────────────────────
// PR-B: the §3.1(a) "likely-scrub" residual set — clinical free-text that can
// embed a patient name/identifier inline and is NOT medico-legal-immutable.
// (consent_refusal / amendment stay UNSCRUBBED — see DATA_GOVERNANCE §3.1(b).)
// ───────────────────────────────────────────────────────────────────────────
describe('erasure scrubs the §3.1(a) clinical free-text residual set (PR-B)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;
  let ids: Awaited<ReturnType<typeof seedClinicalChain>>;
  let chartId: string;
  let readingId: string;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    ids = await seedClinicalChain(db, { branches: 1, patients: 2, memberships: 1, visits: 1 });

    await db.update(dentalVisits)
      .set({ chiefComplaint: 'John Smith complains of pain on #14' })
      .where(eq(dentalVisits.id, ids.VISIT_1));

    await db.insert(dentalTreatments).values({
      visitId: ids.VISIT_1, patientId: ids.PATIENT_1,
      cdtCode: 'D2740', description: 'Crown for John Smith, upper left',
      priceCents: 50000,
      dismissReason: 'John declined for now', refusalReason: 'cost (per John)',
      clinicalNotes: 'patient John Smith — prep #14, shade A2',
    });

    await db.insert(visitNotes).values({
      visitId: ids.VISIT_1, authorMemberId: ids.MEMBERSHIP_1,
      subjective: 'John Smith reports pain', objective: 'caries #14',
      assessment: 'irreversible pulpitis', plan: 'RCT + crown', notes: 'see John next week',
    });

    await db.insert(dentalFindings).values({
      visitId: ids.VISIT_1, patientId: ids.PATIENT_1,
      toothNumber: 14, conditionCode: 'caries', note: 'John Smith — deep caries distal',
    });

    const [chart] = await db.insert(dentalPerioCharts).values({
      visitId: ids.VISIT_1, patientId: ids.PATIENT_1, branchId: ids.BRANCH_1,
      examinerMemberId: ids.MEMBERSHIP_1, notes: 'John Smith — generalized bleeding',
    }).returning({ id: dentalPerioCharts.id });
    chartId = chart!.id;
    const [reading] = await db.insert(dentalPerioToothReadings).values({
      chartId, toothNumber: 14, notes: 'John Smith — 6mm pocket DB',
    }).returning({ id: dentalPerioToothReadings.id });
    readingId = reading!.id;

    await db.insert(labOrders).values({
      visitId: ids.VISIT_1, patientId: ids.PATIENT_1,
      labName: 'Acme Dental Lab', description: 'PFM crown for John Smith #14',
      cancelReason: 'John rescheduled',
    });

    const [plan] = await db.insert(dentalTreatmentPlans).values({
      patientId: ids.PATIENT_1, providerId: ids.MEMBERSHIP_1,
    }).returning({ id: dentalTreatmentPlans.id });
    await db.insert(dentalCasePresentations).values({
      patientId: ids.PATIENT_1, treatmentPlanId: plan!.id,
      signerName: 'John Smith', signatureData: 'data:image/png;base64,AAAA',
    });

    await db.update(patients)
      .set({ followUpNotes: [{ note: 'call John Smith re: crown', at: '2026-01-01' }] as any })
      .where(eq(patients.id, ids.PATIENT_1));
  });

  afterEach(() => teardown());

  test('approve scrubs every §3.1(a) free-text column for the subject', async () => {
    const req = await requestErasure(db, noopLogger, {
      subjectPersonId: ids.PERSON_1, tenantId: TENANT,
      reason: 'GDPR Art.17 subject request', requestedBy: REQUESTER,
    });
    const { request } = await approveErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER });
    expect(request.status).toBe('anonymized');

    const [v] = await db.select().from(dentalVisits).where(eq(dentalVisits.id, ids.VISIT_1));
    expect(v!.chiefComplaint).toBeNull();

    const [tx] = await db.select().from(dentalTreatments).where(eq(dentalTreatments.patientId, ids.PATIENT_1));
    expect(tx!.clinicalNotes).toBeNull();
    expect(tx!.dismissReason).toBeNull();
    expect(tx!.refusalReason).toBeNull();
    expect(tx!.description).toBe('[ERASED]'); // NOT NULL column → marker
    expect(tx!.cdtCode).toBe('D2740'); // coded clinical field retained

    const [vn] = await db.select().from(visitNotes).where(eq(visitNotes.visitId, ids.VISIT_1));
    expect(vn!.subjective).toBeNull();
    expect(vn!.objective).toBeNull();
    expect(vn!.assessment).toBeNull();
    expect(vn!.plan).toBeNull();
    expect(vn!.notes).toBeNull();

    const [find] = await db.select().from(dentalFindings).where(eq(dentalFindings.patientId, ids.PATIENT_1));
    expect(find!.note).toBeNull();

    const [pc] = await db.select().from(dentalPerioCharts).where(eq(dentalPerioCharts.id, chartId));
    expect(pc!.notes).toBeNull();
    const [pr] = await db.select().from(dentalPerioToothReadings).where(eq(dentalPerioToothReadings.id, readingId));
    expect(pr!.notes).toBeNull();

    const [lab] = await db.select().from(labOrders).where(eq(labOrders.patientId, ids.PATIENT_1));
    expect(lab!.description).toBe('[ERASED]'); // NOT NULL column → marker
    expect(lab!.cancelReason).toBeNull();
    expect(lab!.labName).toBe('Acme Dental Lab'); // operational, non-PII — retained

    const [cp] = await db.select().from(dentalCasePresentations).where(eq(dentalCasePresentations.patientId, ids.PATIENT_1));
    expect(cp!.signerName).toBeNull();
    expect(cp!.signatureData).toBeNull();

    const [pt] = await db.select().from(patients).where(eq(patients.id, ids.PATIENT_1));
    expect(pt!.followUpNotes).toEqual([]);
  });

  test('does NOT scrub another patient — case presentation of a second patient survives', async () => {
    const [plan2] = await db.insert(dentalTreatmentPlans).values({
      patientId: ids.PATIENT_2, providerId: ids.MEMBERSHIP_1,
    }).returning({ id: dentalTreatmentPlans.id });
    await db.insert(dentalCasePresentations).values({
      patientId: ids.PATIENT_2, treatmentPlanId: plan2!.id,
      signerName: 'Jane Doe', signatureData: 'data:image/png;base64,BBBB',
    });

    const req = await requestErasure(db, noopLogger, {
      subjectPersonId: ids.PERSON_1, tenantId: TENANT,
      reason: 'GDPR Art.17 subject request', requestedBy: REQUESTER,
    });
    await approveErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER });

    const [cp2] = await db.select().from(dentalCasePresentations).where(eq(dentalCasePresentations.patientId, ids.PATIENT_2));
    expect(cp2!.signerName).toBe('Jane Doe'); // scrub is scoped to the subject
  });
});
