/**
 * getCollectionsKpis (Phase 3.1) — AR KPI dashboard endpoint.
 *
 * Pins the HTTP shape + branch scoping over seeded invoices; the KPI math is
 * unit-tested in utils/kpis.test.ts.
 */
import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const USER = { id: '00000000-0000-0000-0000-0000000fa101', email: 'kp@clinic.com' };
const ORG_ID = 'ec000000-0000-1000-8000-0000000fa101';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000fa101';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000fa101';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000fa101';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000fa101';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000fa101';
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'KPI Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Kpi', lastName: 'Patient', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.delete(dentalInvoices).where(eq(dentalInvoices.branchId, BRANCH_ID));
});

async function seedInvoice(status: string, total: number, paid: number, balance: number, ageDays: number) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const d = new Date(Date.now() - ageDays * DAY);
  await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, invoiceNumber, status: status as 'issued',
    subtotalCents: total, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: total, paidCents: paid, balanceCents: balance,
    dueDate: d, issuedAt: d, createdBy: USER.id, updatedBy: USER.id,
  });
}

describe('getCollectionsKpis (Phase 3.1)', () => {
  test('returns AR / billed / collected / write-off / rate + aging series', async () => {
    await seedInvoice('partial', 10000, 4000, 6000, 45);   // active AR 6000, days30 bucket
    await seedInvoice('paid', 5000, 5000, 0, 10);
    await seedInvoice('uncollectible', 3000, 0, 3000, 200); // write-off

    const res = await buildTestApp({ db, user: USER }).request(`/dental/billing/collections/kpis?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      outstandingArCents: number; writeOffCents: number; billedTotalCents: number;
      collectedTotalCents: number; collectionRate: number; dsoDays: number;
      agingSeries: Array<{ bucket: string; amountCents: number }>;
    };

    expect(body.outstandingArCents).toBe(6000);
    expect(body.writeOffCents).toBe(3000);
    expect(body.billedTotalCents).toBe(18000);
    expect(body.collectedTotalCents).toBe(9000);
    expect(body.collectionRate).toBeCloseTo(0.5, 4);
    expect(body.agingSeries).toHaveLength(4);
    const days30 = body.agingSeries.find((p) => p.bucket === 'days30');
    expect(days30!.amountCents).toBe(6000);
  });

  test('voided invoices are excluded from every KPI', async () => {
    await seedInvoice('voided', 99999, 0, 99999, 30);
    const res = await buildTestApp({ db, user: USER }).request(`/dental/billing/collections/kpis?branchId=${BRANCH_ID}`);
    const body = await res.json() as { billedTotalCents: number; outstandingArCents: number };
    expect(body.billedTotalCents).toBe(0);
    expect(body.outstandingArCents).toBe(0);
  });
});
