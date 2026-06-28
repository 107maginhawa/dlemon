/**
 * Payment refunds (BR-053, Phase 4.2).
 *
 * Money movement → adversarial coverage: refund reverses the invoice, partial +
 * multi-refund are capped at the payment's un-refunded remainder, refund-to-
 * credit books patient credit, voided payment/invoice reject, owner-only.
 */
import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalPayments } from './repos/dental-payment.schema';
import { dentalPaymentRefunds } from './repos/dental-payment-refund.schema';
import { dentalPatientCredits } from './repos/dental-patient-credit.schema';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-00000000fb01', email: 'owner@clinic.com' };
const ASSOC = { id: '00000000-0000-0000-0000-00000000fb02', email: 'assoc@clinic.com' };
const ORG_ID = 'ec000000-0000-1000-8000-00000000fb01';
const BRANCH_ID = 'bb000000-0000-1000-8000-00000000fb01';
const OWNER_MEMBER = 'cc000000-0000-1000-8000-00000000fb01';
const ASSOC_MEMBER = 'cc000000-0000-1000-8000-00000000fb02';
const PERSON_ID = 'ee000000-0000-1000-8000-00000000fb01';
const PATIENT_ID = 'aa000000-0000-1000-8000-00000000fb01';
const VISIT_ID = 'dd000000-0000-1000-8000-00000000fb01';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Refund Clinic', tier: 'solo', ownerPersonId: OWNER.id, countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values([
    { id: OWNER_MEMBER, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id },
    { id: ASSOC_MEMBER, branchId: BRANCH_ID, personId: ASSOC.id, displayName: 'Assoc', role: 'dentist_associate', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id },
  ]).onConflictDoNothing();
  await db.insert(persons).values([
    { id: PERSON_ID, firstName: 'Ref', lastName: 'Und', createdBy: OWNER.id, updatedBy: OWNER.id },
  ]).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: OWNER_MEMBER, status: 'completed', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
  await db.delete(dentalPaymentRefunds).where(eq(dentalPaymentRefunds.branchId, BRANCH_ID));
  await db.delete(dentalPatientCredits).where(eq(dentalPatientCredits.patientId, PATIENT_ID));
  await db.delete(dentalPayments).where(eq(dentalPayments.patientId, PATIENT_ID));
  await db.delete(dentalInvoices).where(eq(dentalInvoices.patientId, PATIENT_ID));
});

let receiptSeq = 0;
/** Seed an invoice with a recorded (paid) payment; returns ids. */
async function seedPaidInvoice(total: number, paidAmount: number, invoiceStatus = 'paid', paymentVoid = false) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const [invoice] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: OWNER_MEMBER, invoiceNumber, status: invoiceStatus as 'paid',
    subtotalCents: total, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: total, paidCents: paidAmount, balanceCents: total - paidAmount,
    dueDate: new Date(), issuedAt: new Date(), createdBy: OWNER.id, updatedBy: OWNER.id,
  }).returning();
  receiptSeq += 1;
  const [payment] = await db.insert(dentalPayments).values({
    id: crypto.randomUUID(), invoiceId: invoice!.id, patientId: PATIENT_ID, branchId: BRANCH_ID,
    amountCents: paidAmount, method: 'cash', receiptNumber: `RF-${receiptSeq}-${Date.now()}`,
    recordedByMemberId: OWNER_MEMBER, isVoid: paymentVoid,
    createdBy: OWNER.id, updatedBy: OWNER.id,
  }).returning();
  return { invoice: invoice!, payment: payment! };
}

function refund(user: { id: string; email: string }, paymentId: string, amountCents: number, extra: Record<string, unknown> = {}) {
  return buildTestApp({ db, user }).request(`/dental/billing/payments/${paymentId}/refund`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents, reason: 'Patient overpaid', ...extra }),
  });
}

describe('refundDentalPayment (BR-053)', () => {
  test('full refund reverses the invoice (paid → re-opened) + records the refund', async () => {
    const { invoice, payment } = await seedPaidInvoice(5000, 5000, 'paid');
    const res = await refund(OWNER, payment.id, 5000);
    expect(res.status).toBe(200);
    const body = await res.json() as { invoiceBalanceCents: number; invoiceStatus: string; bookedAsCredit: boolean };
    expect(body.invoiceBalanceCents).toBe(5000);
    expect(body.invoiceStatus).toBe('issued'); // re-opened, not paid
    expect(body.bookedAsCredit).toBe(false);

    const inv = await new DentalInvoiceRepository(db).findOneById(invoice.id);
    expect(inv!.balanceCents).toBe(5000);
    const refunds = await db.select().from(dentalPaymentRefunds).where(eq(dentalPaymentRefunds.paymentId, payment.id));
    expect(refunds).toHaveLength(1);
  });

  test('partial refund leaves the rest refundable; a second refund is capped at the remainder', async () => {
    const { payment } = await seedPaidInvoice(5000, 5000, 'paid');
    expect((await refund(OWNER, payment.id, 2000)).status).toBe(200);
    // 3000 remains refundable → 3000 ok, 3001 rejected.
    expect((await refund(OWNER, payment.id, 3001)).status).toBe(422);
    expect((await refund(OWNER, payment.id, 3000)).status).toBe(200);
    // Now fully refunded → any further refund rejected.
    expect((await refund(OWNER, payment.id, 1)).status).toBe(422);
  });

  test('refund-to-credit books patient credit instead of cash', async () => {
    const { payment } = await seedPaidInvoice(4000, 4000, 'paid');
    const res = await refund(OWNER, payment.id, 4000, { bookAsCredit: true });
    expect(res.status).toBe(200);
    const body = await res.json() as { bookedAsCredit: boolean; creditBalanceCents: number };
    expect(body.bookedAsCredit).toBe(true);
    expect(body.creditBalanceCents).toBe(4000);

    const credits = await db.select().from(dentalPatientCredits).where(eq(dentalPatientCredits.patientId, PATIENT_ID));
    expect(credits).toHaveLength(1);
    expect(credits[0]!.amountCents).toBe(4000);
    expect(credits[0]!.source).toBe('refund');
    // A positive (non-consuming) row carries NO invoiceId — that column is reserved
    // for consuming (negative) rows naming the invoice the credit was drawn against.
    expect(credits[0]!.invoiceId).toBeNull();
  });

  test('BR-053: refund > paid amount → 422, invoice untouched', async () => {
    const { invoice, payment } = await seedPaidInvoice(3000, 3000, 'paid');
    expect((await refund(OWNER, payment.id, 5000)).status).toBe(422);
    const inv = await new DentalInvoiceRepository(db).findOneById(invoice.id);
    expect(inv!.balanceCents).toBe(0); // unchanged
  });

  test('refunding a voided payment → 422', async () => {
    const { payment } = await seedPaidInvoice(3000, 3000, 'paid', true);
    expect((await refund(OWNER, payment.id, 1000)).status).toBe(422);
  });

  test('refunding against a voided invoice → 422', async () => {
    const { payment } = await seedPaidInvoice(3000, 3000, 'voided');
    expect((await refund(OWNER, payment.id, 1000)).status).toBe(422);
  });

  test('owner-only: a non-owner (associate) is forbidden', async () => {
    const { payment } = await seedPaidInvoice(3000, 3000, 'paid');
    expect((await refund(ASSOC, payment.id, 1000)).status).toBe(403);
  });

  test('BR-053 concurrency: two simultaneous refunds cannot exceed the payment', async () => {
    const { payment } = await seedPaidInvoice(5000, 5000, 'paid');
    // Both try to refund the full 5000. The per-payment advisory lock serializes
    // them: exactly one wins, and total refunds never exceed the payment.
    const [a, b] = await Promise.all([refund(OWNER, payment.id, 5000), refund(OWNER, payment.id, 5000)]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    const refunds = await db.select().from(dentalPaymentRefunds).where(eq(dentalPaymentRefunds.paymentId, payment.id));
    expect(refunds.reduce((s, r) => s + r.amountCents, 0)).toBe(5000);
  });
});
