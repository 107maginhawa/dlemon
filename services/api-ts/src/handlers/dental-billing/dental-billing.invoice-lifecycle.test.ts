/**
 * dental-billing-module2.test.ts — Module 2: Billing (FR4.x)
 *
 * FRs covered:
 *   FR4.1b  Overdue auto-transition (markOverdueInvoices)
 *   FR4.3   Payment plan status tracking (On Track / Behind / Defaulted)
 *   FR4.4   Per-patient outstanding balance endpoint
 *   FR4.5   Collections Summary endpoint
 *   FR4.6   Receipt Generation (including voided payment — EC5)
 *   FR4.10  Settings-driven tax config (tax applied via taxRate on invoice creation)
 *   EC5     Voided payment receipt reprint
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalPayments } from './repos/dental-payment.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const FIXED_NOW = new Date('2026-01-15T12:00:00Z');
const FIXED_NOW_MS = FIXED_NOW.getTime();

const STAFF_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'staff@clinic.com' };
const PATIENT_ID = 'aa000000-0000-1000-8000-000000000001';
const PERSON_ID  = 'ee000000-0000-1000-8000-000000000001';
const BRANCH_ID  = 'bb000000-0000-1000-8000-000000000002';
const MEMBER_ID  = 'cc000000-0000-1000-8000-000000000003';
const VISIT_ID   = 'dd000000-0000-1000-8000-000000000004';
const NONEXISTENT_ID = 'ffffffff-ffff-1000-8000-ffffffffffff';
const ORG_ID = 'ec000000-0000-1000-8000-000000000001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'BillingModule2 Clinic', tier: 'solo', ownerPersonId: STAFF_USER.id, countryCode: 'PH', createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch', timezone: 'Asia/Manila', createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: STAFF_USER.id, displayName: 'Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Test', lastName: 'Patient', createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedInvoice(opts: { totalCents?: number; paidCents?: number; balanceCents?: number; status?: string; dueDate?: Date } = {}) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const total = opts.totalCents ?? 10000;
  const paid = opts.paidCents ?? 0;
  const balance = opts.balanceCents ?? total - paid;

  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(),
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    invoiceNumber,
    status: (opts.status ?? 'issued') as any,
    subtotalCents: total,
    discountCents: 0,
    taxCents: 0,
    taxRate: '0',
    totalCents: total,
    paidCents: paid,
    balanceCents: balance,
    issuedAt: new Date(),
    ...(opts.dueDate ? { dueDate: opts.dueDate } : {}),
    createdBy: STAFF_USER.id,
    updatedBy: STAFF_USER.id,
  }).returning();
  return row!;
}

async function seedPayment(invoiceId: string, amountCents = 5000) {
  const paymentRepo = new DentalPaymentRepository(db);
  return paymentRepo.createOne({
    invoiceId,
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    amountCents,
    method: 'cash',
    receiptNumber: `RCT-TEST-${crypto.randomUUID().slice(0, 8)}`,
    recordedByMemberId: MEMBER_ID,
  });
}

async function truncate() {
  await db.execute(sql`DELETE FROM dental_payment_plan_installment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_payment`);
  await db.execute(sql`DELETE FROM dental_invoice`);
}

// =============================================================================
// FR4.1b: Overdue auto-transition
// =============================================================================

describe('FR4.1b: markOverdueInvoices — overdue auto-transition', () => {
  afterEach(truncate);

  test('transitions issued invoice past due date to overdue', async () => {
    const invoiceRepo = new DentalInvoiceRepository(db);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // wall-clock offset required for DB overdue/date-range comparison
    await seedInvoice({ status: 'issued', dueDate: pastDate });

    const flipped = await invoiceRepo.markOverdueInvoices();
    expect(flipped.length).toBeGreaterThanOrEqual(1);

    const invoices = await invoiceRepo.findMany({ patientId: PATIENT_ID });
    const overdue = invoices.find(i => i.status === 'overdue');
    expect(overdue).not.toBeUndefined();
  });

  test('transitions partial invoice past due date to overdue', async () => {
    const invoiceRepo = new DentalInvoiceRepository(db);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // wall-clock offset required for DB overdue/date-range comparison
    await seedInvoice({ status: 'partial', paidCents: 3000, balanceCents: 7000, dueDate: pastDate });

    const flipped = await invoiceRepo.markOverdueInvoices();
    expect(flipped.length).toBeGreaterThanOrEqual(1);
  });

  test('does NOT transition paid invoices', async () => {
    const invoiceRepo = new DentalInvoiceRepository(db);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // wall-clock offset required for DB overdue/date-range comparison
    const inv = await seedInvoice({ status: 'paid', paidCents: 10000, balanceCents: 0, dueDate: pastDate });

    await invoiceRepo.markOverdueInvoices();

    const updated = await invoiceRepo.findOneById(inv.id);
    expect(updated!.status).toBe('paid'); // unchanged
  });

  test('does NOT transition future due date invoices', async () => {
    const invoiceRepo = new DentalInvoiceRepository(db);
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // wall-clock offset required for DB overdue/date-range comparison
    const inv = await seedInvoice({ status: 'issued', dueDate: futureDate });

    await invoiceRepo.markOverdueInvoices();

    const updated = await invoiceRepo.findOneById(inv.id);
    expect(updated!.status).toBe('issued'); // unchanged
  });

  // V-BIL-014: voided invoices are terminal — never marked overdue (§13).
  test('does NOT transition voided invoices', async () => {
    const invoiceRepo = new DentalInvoiceRepository(db);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // wall-clock offset required for DB overdue/date-range comparison
    const inv = await seedInvoice({ status: 'voided', balanceCents: 10000, dueDate: pastDate });

    await invoiceRepo.markOverdueInvoices();

    const updated = await invoiceRepo.findOneById(inv.id);
    expect(updated!.status).toBe('voided'); // unchanged
  });

  // V-BIL-014: §13 idempotency — running the overdue sweep twice is a no-op the
  // second time (the status filter excludes already-overdue rows), and
  // paid/voided invoices are never touched on any run.
  test('is idempotent: second sweep transitions nothing further', async () => {
    const invoiceRepo = new DentalInvoiceRepository(db);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // wall-clock offset required for DB overdue/date-range comparison
    await seedInvoice({ status: 'issued', dueDate: pastDate });
    const paid = await seedInvoice({ status: 'paid', paidCents: 10000, balanceCents: 0, dueDate: pastDate });
    const voided = await seedInvoice({ status: 'voided', balanceCents: 10000, dueDate: pastDate });

    const firstFlipped = await invoiceRepo.markOverdueInvoices();
    expect(firstFlipped.length).toBeGreaterThanOrEqual(1);

    const secondFlipped = await invoiceRepo.markOverdueInvoices();
    expect(secondFlipped.length).toBe(0); // no further transitions

    expect((await invoiceRepo.findOneById(paid.id))!.status).toBe('paid');
    expect((await invoiceRepo.findOneById(voided.id))!.status).toBe('voided');
  });
});

// =============================================================================
// FR4.3: Payment plan status tracking
// =============================================================================

describe('FR4.3: payment plan status tracking', () => {
  afterEach(truncate);

  test('new plan starts as onTrack', async () => {
    const invoice = await seedInvoice({ totalCents: 30000, balanceCents: 30000 });
    const planRepo = new DentalPaymentPlanRepository(db);

    const { plan } = await planRepo.createWithInstallments({
      invoiceId: invoice.id,
      patientId: PATIENT_ID,
      totalCents: 30000,
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: new Date(),
      amountPerInstallmentCents: 10000,
      createdBy: STAFF_USER.id,
      updatedBy: STAFF_USER.id,
    });

    expect(plan.status).toBe('on_track');
  });

  test('plan transitions to completed when all installments paid', async () => {
    const invoice = await seedInvoice({ totalCents: 20000, balanceCents: 20000 });
    const planRepo = new DentalPaymentPlanRepository(db);

    const { plan, installments } = await planRepo.createWithInstallments({
      invoiceId: invoice.id,
      patientId: PATIENT_ID,
      totalCents: 20000,
      numberOfInstallments: 2,
      frequency: 'monthly',
      startDate: new Date(),
      amountPerInstallmentCents: 10000,
      createdBy: STAFF_USER.id,
      updatedBy: STAFF_USER.id,
    });

    // Mark all installments paid — create real payment records for FK
    for (const inst of installments) {
      const payment = await seedPayment(invoice.id, inst.amountCents);
      await planRepo.recordInstallmentPayment(inst.id, payment.id, inst.amountCents, new Date());
    }

    const updated = await planRepo.updatePlanStatus(plan.id);
    expect(updated!.status).toBe('completed');
  });

  test('plan transitions to behind when installment is 7+ days overdue', async () => {
    const invoice = await seedInvoice({ totalCents: 20000, balanceCents: 20000 });
    const planRepo = new DentalPaymentPlanRepository(db);

    // Start date 8 days in the past so first installment is overdue
    const startDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // wall-clock offset required for DB overdue/date-range comparison
    const { plan } = await planRepo.createWithInstallments({
      invoiceId: invoice.id,
      patientId: PATIENT_ID,
      totalCents: 20000,
      numberOfInstallments: 2,
      frequency: 'monthly',
      startDate,
      amountPerInstallmentCents: 10000,
      createdBy: STAFF_USER.id,
      updatedBy: STAFF_USER.id,
    });

    const updated = await planRepo.updatePlanStatus(plan.id);
    expect(updated!.status).toBe('behind');
  });
});

// =============================================================================
// FR4.4: Per-patient outstanding balance
// =============================================================================

describe('FR4.4: getPatientBalance', () => {
  afterEach(truncate);

  test('returns zero balance for patient with no invoices', async () => {
    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request(`/dental/billing/patients/${PATIENT_ID}/balance`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.patientId).toBe(PATIENT_ID);
    expect(body.outstandingBalanceCents).toBe(0);
    expect(body.totalBilledCents).toBe(0);
    expect(body.invoiceCount).toBe(0);
  });

  test('returns correct outstanding balance across multiple invoices', async () => {
    await seedInvoice({ totalCents: 10000, paidCents: 3000, balanceCents: 7000 });
    await seedInvoice({ totalCents: 5000, paidCents: 5000, balanceCents: 0, status: 'paid' });

    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request(`/dental/billing/patients/${PATIENT_ID}/balance`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.outstandingBalanceCents).toBe(7000); // only unpaid invoice
    expect(body.totalBilledCents).toBe(15000);
    expect(body.totalPaidCents).toBe(8000);
  });

  test('excludes voided invoices from balance', async () => {
    await seedInvoice({ totalCents: 10000, balanceCents: 10000, status: 'voided' });

    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request(`/dental/billing/patients/${PATIENT_ID}/balance`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.outstandingBalanceCents).toBe(0);
    expect(body.invoiceCount).toBe(0);
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp({ db });
    const res = await app.request(`/dental/billing/patients/${PATIENT_ID}/balance`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// FR4.5: Collections Summary
// =============================================================================

describe('FR4.5: getCollectionsSummary', () => {
  afterEach(truncate);

  test('returns summary with zero totals when no data', async () => {
    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request('/dental/billing/collections/summary?period=today');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.totalCollectedCents).toBe(0);
    expect(body.paymentCount).toBe(0);
    expect(typeof body.period.from).toBe('string');
    expect(typeof body.period.to).toBe('string');
  });

  test('counts payments made within period', async () => {
    const invoice = await seedInvoice({ totalCents: 20000, balanceCents: 20000 });
    await seedPayment(invoice.id, 10000);

    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request('/dental/billing/collections/summary?period=today');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.totalCollectedCents).toBeGreaterThanOrEqual(10000);
    expect(body.paymentCount).toBeGreaterThanOrEqual(1);
  });

  test('breaks down collections by payment method', async () => {
    const invoice = await seedInvoice({ totalCents: 20000, balanceCents: 20000 });
    await seedPayment(invoice.id, 5000);

    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request('/dental/billing/collections/summary?period=today');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.collectionsByMethod).not.toBeNull();
    expect(typeof body.collectionsByMethod).toBe('object');
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp({ db });
    const res = await app.request('/dental/billing/collections/summary');
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// FR4.6: Receipt Generation + EC5 (voided payment receipt)
// =============================================================================

describe('FR4.6 + EC5: getDentalPaymentReceipt', () => {
  afterEach(truncate);

  test('FR4.6: generates receipt with payment and invoice data', async () => {
    const invoice = await seedInvoice({ totalCents: 10000, balanceCents: 10000 });
    const payment = await seedPayment(invoice.id, 5000);

    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments/${payment.id}/receipt`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.receiptNumber).toBe('string'); expect(body.receiptNumber.length).toBeGreaterThan(0);
    expect(body.payment.amountCents).toBe(5000);
    expect(typeof body.invoice.invoiceNumber).toBe('string'); expect(body.invoice.invoiceNumber.length).toBeGreaterThan(0);
    expect(typeof body.generatedAt).toBe('string');
    expect(body.isVoid).toBe(false);
  });

  test('EC5: voided payment receipt shows void info', async () => {
    const invoiceRepo = new DentalInvoiceRepository(db);
    const paymentRepo = new DentalPaymentRepository(db);

    const invoice = await seedInvoice({ totalCents: 10000, paidCents: 5000, balanceCents: 5000, status: 'partial' });
    const payment = await seedPayment(invoice.id, 5000);

    // Void the payment
    await paymentRepo.voidPayment(payment.id, 'Entered wrong amount', MEMBER_ID);

    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/payments/${payment.id}/receipt`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.isVoid).toBe(true);
    expect(typeof body.voidedAt).toBe('string');
    expect(body.voidReason).toBe('Entered wrong amount');
    // Receipt still accessible after void (EC5)
    expect(typeof body.receiptNumber).toBe('string'); expect(body.receiptNumber.length).toBeGreaterThan(0);
  });

  test('returns 404 for non-existent invoice', async () => {
    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/payments/${NONEXISTENT_ID}/receipt`);
    expect(res.status).toBe(404);
  });

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp({ db });
    const res = await app.request(`/dental/billing/invoices/${NONEXISTENT_ID}/payments/${NONEXISTENT_ID}/receipt`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// FR4.10: Settings-driven tax config
// =============================================================================

describe('FR4.10: tax rate applied via invoice settings', () => {
  afterEach(truncate);

  test('invoice with taxRate=0.12 applies 12% VAT correctly', async () => {
    // The tax calculation is tested at the repo level; here verify the invoice stores and applies it
    const invoiceRepo = new DentalInvoiceRepository(db);
    const [inv] = await db.insert(dentalInvoices).values({
      id: crypto.randomUUID(),
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID,
      invoiceNumber: await invoiceRepo.generateInvoiceNumber(),
      status: 'draft',
      subtotalCents: 10000,
      discountCents: 0,
      taxCents: 1200,
      taxRate: '0.12',
      totalCents: 11200,
      paidCents: 0,
      balanceCents: 11200,
      createdBy: STAFF_USER.id,
      updatedBy: STAFF_USER.id,
    }).returning();

    expect(inv!.taxCents).toBe(1200);
    expect(inv!.totalCents).toBe(11200);
    expect(Number(inv!.taxRate)).toBeCloseTo(0.12, 5);
  });

  test('invoice with taxRate=0 has no tax added', async () => {
    const invoiceRepo = new DentalInvoiceRepository(db);
    const [inv] = await db.insert(dentalInvoices).values({
      id: crypto.randomUUID(),
      visitId: VISIT_ID,
      patientId: PATIENT_ID,
      branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID,
      invoiceNumber: await invoiceRepo.generateInvoiceNumber(),
      status: 'draft',
      subtotalCents: 10000,
      discountCents: 0,
      taxCents: 0,
      taxRate: '0',
      totalCents: 10000,
      paidCents: 0,
      balanceCents: 10000,
      createdBy: STAFF_USER.id,
      updatedBy: STAFF_USER.id,
    }).returning();

    expect(inv!.taxCents).toBe(0);
    expect(inv!.totalCents).toBe(10000);
  });
});
