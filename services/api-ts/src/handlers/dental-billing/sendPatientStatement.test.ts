/**
 * sendPatientStatement (BR-050) — manual statement send.
 *
 * Pins: balance>0 enqueues email+push billing notifications to the patient's
 * person and reports the outstanding balance; zero balance is a no-op (sent
 * false, no notifications); an unknown patient is 404.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq, and } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { notifications } from '@/handlers/notifs/repos/notification.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const USER = { id: '00000000-0000-0000-0000-0000000bf101', email: 'stmt@clinic.com' };
const ORG_ID = 'ec000000-0000-1000-8000-0000000bf101';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000bf101';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000bf101';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000bf101';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000bf101';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000bf101';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Statement Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Stmt', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.delete(dentalInvoices).where(eq(dentalInvoices.patientId, PATIENT_ID));
  await db.delete(notifications).where(eq(notifications.relatedEntity, PATIENT_ID));
});

async function seedInvoice(status: string, total: number, paid: number, balance: number) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, invoiceNumber, status: status as 'issued',
    subtotalCents: total, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: total, paidCents: paid, balanceCents: balance,
    dueDate: new Date('2026-01-01T00:00:00Z'), issuedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: USER.id, updatedBy: USER.id,
  });
}

function send(patientId: string) {
  return buildTestApp({ db, user: USER }).request(`/dental/billing/patients/${patientId}/statement/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
}

async function billingNotifs() {
  return db.select().from(notifications).where(
    and(eq(notifications.relatedEntity, PATIENT_ID), eq(notifications.type, 'billing')),
  );
}

describe('sendPatientStatement (BR-050)', () => {
  test('outstanding balance → enqueues email+push billing notifs to the patient', async () => {
    await seedInvoice('partial', 8000, 5000, 3000);
    await seedInvoice('overdue', 2000, 0, 2000);

    const res = await send(PATIENT_ID);
    expect(res.status).toBe(200);
    const body = await res.json() as { sent: boolean; outstandingBalanceCents: number; channels: string[] };
    expect(body.sent).toBe(true);
    expect(body.outstandingBalanceCents).toBe(5000);
    expect(new Set(body.channels)).toEqual(new Set(['email', 'push']));

    const notifs = await billingNotifs();
    expect(notifs.length).toBe(2);
    expect(notifs.every((n) => n.recipient === PERSON_ID)).toBe(true);
  });

  test('zero balance → no-op (sent false, no notifications)', async () => {
    await seedInvoice('paid', 4000, 4000, 0);

    const res = await send(PATIENT_ID);
    expect(res.status).toBe(200);
    const body = await res.json() as { sent: boolean; outstandingBalanceCents: number };
    expect(body.sent).toBe(false);
    expect(body.outstandingBalanceCents).toBe(0);
    expect(await billingNotifs()).toHaveLength(0);
  });

  test('unknown patient → 404', async () => {
    const res = await send('aa000000-0000-1000-8000-00000000dead');
    expect(res.status).toBe(404);
  });
});
