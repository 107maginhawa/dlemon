/**
 * Patient credit ledger + apply-credit (BR-052, Phase 4.1).
 *
 * Money movement → adversarial coverage of the atomic constraint: applied
 * credit must be > 0, <= invoice balance, AND <= available credit; a rejected
 * apply must leave BOTH the invoice and the ledger untouched.
 */
import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalPatientCredits } from './repos/dental-patient-credit.schema';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const USER = { id: '00000000-0000-0000-0000-00000000c401', email: 'cr@clinic.com' };
const ORG_ID = 'ec000000-0000-1000-8000-00000000c401';
const BRANCH_ID = 'bb000000-0000-1000-8000-00000000c401';
const MEMBER_ID = 'cc000000-0000-1000-8000-00000000c401';
const PERSON_ID = 'ee000000-0000-1000-8000-00000000c401';
const PATIENT_ID = 'aa000000-0000-1000-8000-00000000c401';
const VISIT_ID = 'dd000000-0000-1000-8000-00000000c401';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Credit Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Cred', lastName: 'It', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
  await db.delete(dentalPatientCredits).where(eq(dentalPatientCredits.patientId, PATIENT_ID));
  await db.delete(dentalInvoices).where(eq(dentalInvoices.patientId, PATIENT_ID));
});

function app() { return buildTestApp({ db, user: USER }); }

async function seedInvoice(total: number, paid: number, balance: number, status = 'issued') {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, invoiceNumber, status: status as 'issued',
    subtotalCents: total, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: total, paidCents: paid, balanceCents: balance,
    dueDate: new Date(), issuedAt: new Date(), createdBy: USER.id, updatedBy: USER.id,
  }).returning();
  return row!;
}

function addCredit(amountCents: number, source = 'manual') {
  return app().request(`/dental/billing/patients/${PATIENT_ID}/credits`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents, source }),
  });
}
function applyCredit(invoiceId: string, amountCents: number) {
  return app().request(`/dental/billing/invoices/${invoiceId}/apply-credit`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents }),
  });
}

describe('patient credit ledger (BR-052)', () => {
  test('addPatientCredit adds a positive row + getPatientCredits reports the balance', async () => {
    expect((await addCredit(5000)).status).toBe(201);
    expect((await addCredit(2500, 'overpayment')).status).toBe(201);

    const res = await app().request(`/dental/billing/patients/${PATIENT_ID}/credits`);
    const body = await res.json() as { balanceCents: number; credits: unknown[] };
    expect(body.balanceCents).toBe(7500);
    expect(body.credits).toHaveLength(2);
  });

  test('apply-credit reduces the invoice balance + leaves the correct remaining credit', async () => {
    await addCredit(10000);
    const invoice = await seedInvoice(8000, 0, 8000);

    const res = await applyCredit(invoice.id, 5000);
    expect(res.status).toBe(200);
    const body = await res.json() as { appliedCents: number; invoiceBalanceCents: number; invoiceStatus: string; remainingCreditCents: number };
    expect(body.appliedCents).toBe(5000);
    expect(body.invoiceBalanceCents).toBe(3000);
    expect(body.invoiceStatus).toBe('partial');
    expect(body.remainingCreditCents).toBe(5000);

    // Ledger now nets to 5000 (10000 added − 5000 consumed).
    const ledger = await app().request(`/dental/billing/patients/${PATIENT_ID}/credits`);
    expect((await ledger.json() as { balanceCents: number }).balanceCents).toBe(5000);
  });

  test('applying the full balance marks the invoice paid', async () => {
    await addCredit(8000);
    const invoice = await seedInvoice(8000, 0, 8000);
    const res = await applyCredit(invoice.id, 8000);
    const body = await res.json() as { invoiceBalanceCents: number; invoiceStatus: string };
    expect(body.invoiceBalanceCents).toBe(0);
    expect(body.invoiceStatus).toBe('paid');
  });

  test('BR-052: apply > invoice balance → 422, ledger + invoice untouched', async () => {
    await addCredit(10000);
    const invoice = await seedInvoice(3000, 0, 3000);

    const res = await applyCredit(invoice.id, 5000); // > balance 3000
    expect(res.status).toBe(422);

    // No consuming row; credit balance still 10000; invoice still 3000.
    const ledger = await app().request(`/dental/billing/patients/${PATIENT_ID}/credits`);
    expect((await ledger.json() as { balanceCents: number }).balanceCents).toBe(10000);
    const inv = await new DentalInvoiceRepository(db).findOneById(invoice.id);
    expect(inv!.balanceCents).toBe(3000);
  });

  test('BR-052: apply > available credit → 422, nothing applied', async () => {
    await addCredit(2000);
    const invoice = await seedInvoice(9000, 0, 9000);

    const res = await applyCredit(invoice.id, 5000); // > available 2000
    expect(res.status).toBe(422);

    const ledger = await app().request(`/dental/billing/patients/${PATIENT_ID}/credits`);
    expect((await ledger.json() as { balanceCents: number }).balanceCents).toBe(2000);
    const inv = await new DentalInvoiceRepository(db).findOneById(invoice.id);
    expect(inv!.balanceCents).toBe(9000);
  });

  test('apply to a voided invoice → 422', async () => {
    await addCredit(5000);
    const invoice = await seedInvoice(4000, 0, 4000, 'voided');
    expect((await applyCredit(invoice.id, 1000)).status).toBe(422);
  });

  test('apply with no available credit → 422', async () => {
    const invoice = await seedInvoice(4000, 0, 4000);
    expect((await applyCredit(invoice.id, 1000)).status).toBe(422);
  });

  test('BR-052 concurrency: two simultaneous applies cannot over-draw the ledger', async () => {
    await addCredit(5000);
    const invoice = await seedInvoice(8000, 0, 8000);
    // Both try to draw the full 5000; together that would over-draw. The
    // per-patient advisory lock serializes them: exactly one wins.
    const [a, b] = await Promise.all([applyCredit(invoice.id, 5000), applyCredit(invoice.id, 5000)]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    const ledger = await app().request(`/dental/billing/patients/${PATIENT_ID}/credits`);
    expect((await ledger.json() as { balanceCents: number }).balanceCents).toBe(0); // never negative
  });
});
