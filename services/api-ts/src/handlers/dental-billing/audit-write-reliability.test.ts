/**
 * audit-write-reliability.test.ts — dental-audit P1-C + P2-A (Batch 2)
 *
 * P1-C (fail-closed): a money mutation must NOT report success when its audit row
 * cannot be persisted. Before the fix, `logAuditEvent` swallowed non-security
 * write failures, so voiding a payment returned 200 even though no
 * `dental_audit_log` row was written — a silent compliance gap. After the fix the
 * void must surface a 5xx (the mutation does not silently commit without an audit
 * trail).
 *
 * P2-A (AUD-BR-004): the void audit row must carry sanitized before/after
 * snapshots + the void reason (previously never populated).
 *
 * RED-proof: with the P1-C `failClosed` flag absent, the fail-closed test returns
 * 200 (audit error swallowed); with the P2-A snapshots absent, the before/after
 * assertions are undefined.
 */

import { describe, test, expect, afterEach, beforeAll, spyOn } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { voidDentalPayment } from './voidDentalPayment';
import { voidDentalInvoice } from './voidDentalInvoice';
import { VoidDentalPaymentParams, VoidDentalPaymentBody, VoidDentalInvoiceParams, VoidDentalInvoiceBody } from '@/generated/openapi/validators';
import { AuditLogRepository } from '@/handlers/dental-audit/repos/audit-log.repo';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: a47 — avoids membership unique-index collisions with sibling suites.
const TEST_USER  = { id: '00000000-0000-0000-0000-000000a47001', email: 'awr@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000a47001';
const PERSON_ID  = 'e0000000-0000-1000-8000-000000a47001';
const BRANCH_ID  = '7b000000-0000-4000-8000-000000a47001';
const MEMBER_ID  = '7c000000-0000-4000-8000-000000a47001';
const VISIT_ID   = 'b0000000-0000-4000-8000-000000a47001';
const ORG_ID     = 'ef000000-0000-1000-8000-000000a47001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches }      = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships }   = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'AWR Clinic', tier: 'solo', ownerPersonId: TEST_USER.id,
    countryCode: 'PH', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'AWR Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'AWR Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'AWR', lastName: 'Patient',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
  await db.insert(dentalVisits).values({
    id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, status: 'completed',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_payment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_invoice_line_item`);
  await db.execute(sql`DELETE FROM dental_invoice`);
  // dental_audit_log is append-only (DELETE blocked by V-AUD-IMM-001); TRUNCATE is
  // the sanctioned reset (P3-A carve-out). Safe under per-file DB isolation.
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', TEST_USER);
    ctx.set('session', { id: 'awr-session', userId: TEST_USER.id });
    await next();
  });
  app.post(
    '/dental/billing/invoices/:invoiceId/payments/:paymentId/void',
    zValidator('param', VoidDentalPaymentParams, ve),
    zValidator('json', VoidDentalPaymentBody, ve),
    voidDentalPayment as any,
  );
  app.post(
    '/dental/billing/invoices/:invoiceId/void',
    zValidator('param', VoidDentalInvoiceParams, ve),
    zValidator('json', VoidDentalInvoiceBody, ve),
    voidDentalInvoice as any,
  );
  return app;
}

async function seedIssuedInvoice() {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const [invoice] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, invoiceNumber, status: 'issued' as any,
    subtotalCents: 10000, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: 10000, paidCents: 0, balanceCents: 10000,
    issuedAt: new Date('2025-01-15T10:00:00.000Z'),
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  return invoice!;
}

async function seedInvoiceWithPayment() {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const [invoice] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID, invoiceNumber, status: 'issued' as any,
    subtotalCents: 10000, discountCents: 0, taxCents: 0, taxRate: '0',
    totalCents: 10000, paidCents: 3000, balanceCents: 7000,
    issuedAt: new Date('2025-01-15T10:00:00.000Z'),
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).returning();
  const paymentRepo = new DentalPaymentRepository(db);
  const payment = await paymentRepo.createOne({
    invoiceId: invoice!.id, patientId: PATIENT_ID, branchId: BRANCH_ID,
    amountCents: 3000, method: 'cash', receiptNumber: `AWR-${Date.now()}`,
    recordedByMemberId: MEMBER_ID,
  });
  return { invoice: invoice!, payment };
}

describe('audit write reliability (P1-C fail-closed) + AUD-BR-004 snapshots (P2-A)', () => {
  // -------------------------------------------------------------------------
  // P1-C: a void must NOT report success when the audit row cannot be written.
  // -------------------------------------------------------------------------
  test('voiding a payment returns 5xx when the audit sink is unavailable (no silent gap)', async () => {
    const { invoice, payment } = await seedInvoiceWithPayment();
    const app = buildApp();

    // Force ONLY the authoritative dental_audit_log write to fail. The mutation
    // repos are untouched, so without fail-closed the void would commit and the
    // swallowed audit error would still return 200 — the silent gap we are closing.
    const spy = spyOn(AuditLogRepository.prototype, 'insert').mockImplementation(async () => {
      throw new Error('audit sink unavailable');
    });
    try {
      const res = await app.request(
        `/dental/billing/invoices/${invoice.id}/payments/${payment.id}/void`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voidReason: 'Posted in error' }) },
      );
      expect(res.status).toBeGreaterThanOrEqual(500);
    } finally {
      spy.mockRestore();
    }
  });

  // -------------------------------------------------------------------------
  // P2-A: the void audit row carries before/after + reason (AUD-BR-004).
  // -------------------------------------------------------------------------
  test('voiding a payment persists before/after snapshots + reason on the audit row', async () => {
    const { invoice, payment } = await seedInvoiceWithPayment();
    const app = buildApp();

    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/payments/${payment.id}/void`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voidReason: 'Duplicate charge' }) },
    );
    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.targetId, payment.id), eq(dentalAuditLog.action, 'payment.void')));

    expect(row).toBeTruthy();
    expect(row!.reason).toBe('Duplicate charge');
    expect(row!.eventType).toBe('data-modification');
    expect((row!.beforeSnapshot as any)?.isVoid).toBe(false);
    expect((row!.afterSnapshot as any)?.isVoid).toBe(true);
  });
});

describe('SL-05 / E-NEW-02 — invoice void is fail-closed + snapshotted', () => {
  // -------------------------------------------------------------------------
  // P1-C: voiding an INVOICE must NOT report success when its audit row cannot
  // be persisted. The MASTER-GAP-MATRIX P1-C entry claimed fail-closed covered
  // void/discount/payment, but the INVOICE-void path was missed (only the
  // PAYMENT-void path had it). RED before the fix: the void returns 200 even
  // though no `dental_audit_log` row was written.
  // -------------------------------------------------------------------------
  test('voiding an invoice returns 5xx when the audit sink is unavailable (no silent gap)', async () => {
    const invoice = await seedIssuedInvoice();
    const app = buildApp();

    const spy = spyOn(AuditLogRepository.prototype, 'insert').mockImplementation(async () => {
      throw new Error('audit sink unavailable');
    });
    try {
      const res = await app.request(
        `/dental/billing/invoices/${invoice.id}/void`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Issued in error' }) },
      );
      expect(res.status).toBeGreaterThanOrEqual(500);
    } finally {
      spy.mockRestore();
    }
  });

  // -------------------------------------------------------------------------
  // P2-A (AUD-BR-004): the invoice.voided audit row carries before/after status
  // snapshots + the void reason (parity with payment-void).
  // -------------------------------------------------------------------------
  test('voiding an invoice persists before/after status snapshots + reason on the audit row', async () => {
    const invoice = await seedIssuedInvoice();
    const app = buildApp();

    const res = await app.request(
      `/dental/billing/invoices/${invoice.id}/void`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Billing error correction' }) },
    );
    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.targetId, invoice.id), eq(dentalAuditLog.action, 'invoice.voided')));

    expect(row).toBeTruthy();
    expect(row!.reason).toBe('Billing error correction');
    expect(row!.eventType).toBe('data-modification');
    expect((row!.beforeSnapshot as any)?.status).toBe('issued');
    expect((row!.afterSnapshot as any)?.status).toBe('voided');
  });
});
