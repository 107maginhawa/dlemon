/**
 * Collections worklist + outreach log (BR-051, Phase 2.4).
 *
 * Pins: the worklist surfaces overdue patients (overdue balance, open-invoice
 * count, oldest days overdue, active-plan flag) and enriches them with the last
 * logged contact; createCollectionNote persists an audited note; a patient with
 * no overdue balance is absent.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalCollectionNotes } from './repos/dental-collection-note.schema';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const USER = { id: '00000000-0000-0000-0000-0000000cf101', email: 'cw@clinic.com' };
const ORG_ID = 'ec000000-0000-1000-8000-0000000cf101';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000cf101';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000cf101';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000cf101';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000cf101';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000cf101';
// Second patient: no overdue balance (paid only) — must be absent from worklist.
const PERSON_2 = 'ee000000-0000-1000-8000-0000000cf102';
const PATIENT_2 = 'aa000000-0000-1000-8000-0000000cf102';

const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Collections Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values([
    { id: PERSON_ID, firstName: 'Coll', lastName: 'Ections', createdBy: USER.id, updatedBy: USER.id },
    { id: PERSON_2, firstName: 'Paid', lastName: 'Up', createdBy: USER.id, updatedBy: USER.id },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: USER.id, updatedBy: USER.id },
    { id: PATIENT_2, person: PERSON_2, preferredBranchId: BRANCH_ID, createdBy: USER.id, updatedBy: USER.id },
  ]).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
  await db.delete(dentalCollectionNotes).where(eq(dentalCollectionNotes.branchId, BRANCH_ID));
  await db.delete(dentalInvoices).where(eq(dentalInvoices.branchId, BRANCH_ID));
});

async function seedInvoice(patientId: string, status: string, balance: number, daysOverdue: number) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const due = new Date(Date.now() - daysOverdue * DAY);
  await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: patientId === PATIENT_ID ? VISIT_ID : null,
    patientId, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, invoiceNumber, status: status as 'overdue',
    subtotalCents: 10000, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: 10000, paidCents: 10000 - balance, balanceCents: balance,
    dueDate: due, issuedAt: due, createdBy: USER.id, updatedBy: USER.id,
  });
}

function app() {
  return buildTestApp({ db, user: USER });
}

describe('getCollectionsWorklist (BR-051)', () => {
  test('surfaces an overdue patient with overdue total, open count, and oldest days', async () => {
    await seedInvoice(PATIENT_ID, 'overdue', 6000, 40);
    await seedInvoice(PATIENT_ID, 'issued', 2000, -5);  // not yet due → open but not overdue
    await seedInvoice(PATIENT_2, 'paid', 0, 90);         // settled → absent

    const res = await app().request(`/dental/billing/collections/worklist?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: Array<{ patientId: string; totalOverdueCents: number; openInvoiceCount: number; oldestDaysOverdue: number; noteCount: number; lastContactedAt?: string; lastContactChannel?: string }> };

    const row = body.rows.find((r) => r.patientId === PATIENT_ID);
    expect(row).toBeDefined();
    expect(row!.totalOverdueCents).toBe(6000);
    expect(row!.openInvoiceCount).toBe(2);          // overdue + not-yet-due both open
    expect(row!.oldestDaysOverdue).toBe(40);
    expect(row!.noteCount).toBe(0);
    expect(row!.lastContactedAt).toBeUndefined();

    expect(body.rows.find((r) => r.patientId === PATIENT_2)).toBeUndefined();
  });

  test('createCollectionNote persists an audited note, then enriches the worklist', async () => {
    await seedInvoice(PATIENT_ID, 'overdue', 6000, 40);

    const createRes = await app().request('/dental/billing/collections/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patientId: PATIENT_ID, note: 'Called, left voicemail', contactChannel: 'phone' }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as { id: string; contactChannel: string };
    expect(created.contactChannel).toBe('phone');

    const auditRows = await db.select().from(dentalAuditLog).where(
      and(eq(dentalAuditLog.targetId, created.id), eq(dentalAuditLog.action, 'collection_note.created')),
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.actorId).toBe(USER.id);

    const res = await app().request(`/dental/billing/collections/worklist?branchId=${BRANCH_ID}`);
    const body = await res.json() as { rows: Array<{ patientId: string; totalOverdueCents: number; openInvoiceCount: number; oldestDaysOverdue: number; noteCount: number; lastContactedAt?: string; lastContactChannel?: string }> };
    const row = body.rows.find((r) => r.patientId === PATIENT_ID)!;
    expect(row.noteCount).toBe(1);
    expect(row.lastContactChannel).toBe('phone');
    expect(row.lastContactedAt).toBeDefined();
  });

  test('createCollectionNote on an unknown patient → 404', async () => {
    const res = await app().request('/dental/billing/collections/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patientId: 'aa000000-0000-1000-8000-00000000dead', note: 'x', contactChannel: 'email' }),
    });
    expect(res.status).toBe(404);
  });
});
