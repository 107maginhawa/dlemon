/**
 * BR-055 — BIR receipt fields + wording (PH).
 *
 * The payment receipt (the PH Official Receipt, issued on payment) carries the
 * BIR-required header from branch settings (registered name, business style,
 * TIN, address), the OR number, a VAT breakdown, and the correct non-VAT vs
 * VAT statement. Fields/wording only — no ATP/CAS e-accreditation.
 */
import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-0000000be055', email: 'owner@bir.com' };
const PERSON_ID = 'ee000000-0000-1000-8000-0000000be055';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000be055';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000be055';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000be055';
const ORG_ID = 'ec000000-0000-1000-8000-0000000be055';

const BIR_SETTINGS = {
  registeredName: 'Dela Cruz Dental Clinic',
  businessStyle: 'Dentalemon',
  tin: '123-456-789-000',
  clinicAddress: '12 Mabini St, Makati City',
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'BIR Clinic', tier: 'solo', ownerPersonId: OWNER.id, countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'BIR Branch', timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Bir', lastName: 'Patient', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
});

async function setBranchSettings(settings: Record<string, unknown>) {
  await db.update(dentalBranches).set({ settings }).where(eq(dentalBranches.id, BRANCH_ID));
}

async function seedInvoiceWithTax(opts: { taxCents: number; taxRate: string }) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    invoiceNumber, status: 'paid', subtotalCents: 100000, discountCents: 0,
    taxCents: opts.taxCents, taxRate: opts.taxRate, totalCents: 100000, paidCents: 100000, balanceCents: 0,
    issuedAt: new Date(), createdBy: OWNER.id, updatedBy: OWNER.id,
  }).returning();
  return row!;
}

async function seedPayment(invoiceId: string) {
  return new DentalPaymentRepository(db).createOne({
    invoiceId, patientId: PATIENT_ID, branchId: BRANCH_ID, amountCents: 100000,
    method: 'cash', receiptNumber: `OR-${crypto.randomUUID().slice(0, 8)}`, recordedByMemberId: MEMBER_ID,
  });
}

async function getReceipt(invoiceId: string, paymentId: string) {
  const app = buildTestApp({ db, user: OWNER });
  return app.request(new Request(`http://localhost/dental/billing/invoices/${invoiceId}/payments/${paymentId}/receipt`));
}

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_payment`);
  await db.execute(sql`DELETE FROM dental_invoice`);
  await setBranchSettings({});
});

describe('BR-055: BIR receipt fields + wording', () => {
  test('receipt carries the BIR clinic header + OR number from branch settings', async () => {
    await setBranchSettings({ taxMode: 'non_vat', ...BIR_SETTINGS });
    const inv = await seedInvoiceWithTax({ taxCents: 0, taxRate: '0' });
    const pay = await seedPayment(inv.id);
    const res = await getReceipt(inv.id, pay.id);
    expect(res.status).toBe(200);
    const r = await res.json() as any;
    expect(r.clinic.registeredName).toBe('Dela Cruz Dental Clinic');
    expect(r.clinic.businessStyle).toBe('Dentalemon');
    expect(r.clinic.tin).toBe('123-456-789-000');
    expect(r.clinic.address).toBe('12 Mabini St, Makati City');
    expect(r.orNumber).toBe(r.receiptNumber);
    expect(r.orNumber.length).toBeGreaterThan(0);
  });

  test('non-VAT clinic → VAT breakdown zero + non-VAT statement', async () => {
    await setBranchSettings({ taxMode: 'non_vat', ...BIR_SETTINGS });
    const inv = await seedInvoiceWithTax({ taxCents: 0, taxRate: '0' });
    const pay = await seedPayment(inv.id);
    const r = await (await getReceipt(inv.id, pay.id)).json() as any;
    expect(r.clinic.isVatRegistered).toBe(false);
    expect(r.tax.vatCents).toBe(0);
    expect(r.tax.vatableCents).toBe(0);
    expect(r.tax.vatExemptCents).toBe(100000);
    expect(r.taxStatement).toMatch(/NOT VALID FOR CLAIM OF INPUT TAX/i);
  });

  test('VAT-registered clinic → 12% VAT broken out + VAT statement', async () => {
    await setBranchSettings({ taxMode: 'vat_registered', ...BIR_SETTINGS });
    const inv = await seedInvoiceWithTax({ taxCents: 10714, taxRate: '0.12' });
    const pay = await seedPayment(inv.id);
    const r = await (await getReceipt(inv.id, pay.id)).json() as any;
    expect(r.clinic.isVatRegistered).toBe(true);
    expect(r.tax.vatCents).toBe(10714);
    expect(r.tax.vatableCents).toBe(89286); // 100000 - 10714
    expect(r.tax.vatExemptCents).toBe(0);
    expect(r.tax.vatRate).toBeCloseTo(0.12, 5);
    expect(r.taxStatement).toMatch(/VAT/i);
    expect(r.taxStatement).not.toMatch(/NOT VALID FOR CLAIM OF INPUT TAX/i);
  });
});
