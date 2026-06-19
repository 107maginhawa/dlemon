/**
 * dental-billing job registration + handler integration tests (AHA FIX-001/002).
 *
 * GAP-1: markOverdueInvoices and the plan-"Behind" re-evaluation were fully
 * tested at the repo layer but had ZERO production callers — no job ran them, so
 * the "overdue" filter/badges (FR4.8) and the FR4.3 "Behind" status could never
 * populate. These tests pin (1) the cron is registered, and (2) the registered
 * handler actually transitions a past-due invoice to `overdue` AND flips an
 * active plan with a 7+-day-overdue installment to `behind` — proving the sweep
 * fires from the job, not just that the repo methods work in isolation.
 */

import { describe, test, expect, beforeAll, afterEach, mock } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import type { JobScheduler, JobHandler, JobContext } from '@/core/jobs';
import { registerDentalBillingJobs, BILLING_SYSTEM_ACTOR } from './index';
import { DentalInvoiceRepository } from '../repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from '../repos/dental-payment-plan.repo';
import { dentalInvoices } from '../repos/dental-invoice.schema';
import { dentalPaymentPlans, dentalPaymentPlanInstallments } from '../repos/dental-payment-plan.schema';
import { dentalBillingReminderLog } from '../repos/dental-billing-reminder-log.schema';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';
import { notifications } from '@/handlers/notifs/repos/notification.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });
const noopLogger = { info() {}, warn() {}, error() {}, debug() {}, child() { return noopLogger; } } as any;

const STAFF = { id: '00000000-0000-0000-0000-0000000b1101' };
const ORG_ID = 'ec000000-0000-1000-8000-0000000b1101';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000b1101';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000b1101';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000b1101';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000b1101';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000b1101';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Billing Jobs Clinic', tier: 'solo', ownerPersonId: STAFF.id, countryCode: 'PH', createdBy: STAFF.id, updatedBy: STAFF.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: STAFF.id, updatedBy: STAFF.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: STAFF.id, displayName: 'Staff', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: STAFF.id, updatedBy: STAFF.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Jobs', lastName: 'Patient', createdBy: STAFF.id, updatedBy: STAFF.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: STAFF.id, updatedBy: STAFF.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: STAFF.id, updatedBy: STAFF.id }).onConflictDoNothing();
});

afterEach(async () => {
  // dental_audit_log is append-only (row UPDATE/DELETE blocked); reset via TRUNCATE.
  await db.execute(sql`TRUNCATE TABLE dental_audit_log`);
  await db.execute(sql`DELETE FROM dental_billing_reminder_log`);
  await db.execute(sql`DELETE FROM notification`);
  await db.execute(sql`DELETE FROM dental_payment_plan_installment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_invoice`);
  // Reset branch settings any reminder-cadence test mutated.
  await db.update(dentalBranches).set({ settings: {} }).where(eq(dentalBranches.id, BRANCH_ID));
});

const DAY = 24 * 60 * 60 * 1000;

async function seedIssuedInvoicePastDue(daysOverdue = 1, balanceCents = 10000) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(),
    visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    invoiceNumber, status: 'issued', subtotalCents: 10000, discountCents: 0, taxCents: 0,
    taxRate: '0', totalCents: 10000, paidCents: 10000 - balanceCents, balanceCents,
    issuedAt: new Date(Date.now() - daysOverdue * DAY - DAY), dueDate: new Date(Date.now() - daysOverdue * DAY),
    createdBy: STAFF.id, updatedBy: STAFF.id,
  }).returning();
  return row!;
}

async function seedActivePlanWithOverdueInstallment() {
  const invoice = await seedIssuedInvoicePastDue();
  const [plan] = await db.insert(dentalPaymentPlans).values({
    id: crypto.randomUUID(), invoiceId: invoice.id, patientId: PATIENT_ID,
    totalCents: 10000, numberOfInstallments: 2, frequency: 'monthly',
    startDate: new Date(Date.now() - 30 * DAY), amountPerInstallmentCents: 5000,
    status: 'on_track', createdBy: STAFF.id, updatedBy: STAFF.id,
  }).returning();
  await db.insert(dentalPaymentPlanInstallments).values({
    id: crypto.randomUUID(), planId: plan!.id, installmentNumber: 1,
    dueDate: new Date(Date.now() - 8 * DAY), amountCents: 5000, paidCents: 0, status: 'pending',
    createdBy: STAFF.id, updatedBy: STAFF.id,
  });
  return plan!;
}

/** Capture the handler the module registers under a cron. */
function captureHandler(): { handler: JobHandler; registrations: Array<{ name: string; pattern: string }> } {
  const registrations: Array<{ name: string; pattern: string }> = [];
  let handler: JobHandler | undefined;
  const scheduler: Partial<JobScheduler> = {
    registerCron: mock((name: string, pattern: string, h: JobHandler) => {
      registrations.push({ name, pattern });
      handler = h;
    }),
  };
  registerDentalBillingJobs(scheduler as JobScheduler);
  return { handler: handler!, registrations };
}

function makeContext(): JobContext {
  return { db, logger: noopLogger, jobId: 'test-job', jobName: 'dental-billing.status-sweep' };
}

describe('registerDentalBillingJobs — registration', () => {
  test('registers a single dental-billing.* daily cron', () => {
    const { registrations } = captureHandler();
    expect(registrations).toHaveLength(1);
    expect(registrations[0]!.name).toBe('dental-billing.status-sweep');
    // valid 5-field cron pattern
    expect(registrations[0]!.pattern.split(' ')).toHaveLength(5);
  });
});

describe('dental-billing status sweep handler — overdue invoices (FIX-001)', () => {
  test('transitions a past-due issued invoice to overdue', async () => {
    const invoice = await seedIssuedInvoicePastDue();
    const invoiceRepo = new DentalInvoiceRepository(db);

    const { handler } = captureHandler();
    await handler(makeContext());

    const updated = await invoiceRepo.findOneById(invoice.id);
    expect(updated!.status).toBe('overdue');
  });

  test('is idempotent: a second run makes no further change', async () => {
    const invoice = await seedIssuedInvoicePastDue();
    const invoiceRepo = new DentalInvoiceRepository(db);
    const { handler } = captureHandler();

    await handler(makeContext());
    await handler(makeContext()); // must not throw, invoice stays overdue

    const updated = await invoiceRepo.findOneById(invoice.id);
    expect(updated!.status).toBe('overdue');
  });
});

describe('dental-billing status sweep — overdue audit trail (BR-049)', () => {
  async function overdueAuditRows(invoiceId: string) {
    return db.select().from(dentalAuditLog).where(
      and(eq(dentalAuditLog.targetId, invoiceId), eq(dentalAuditLog.action, 'invoice.overdue')),
    );
  }

  test('writes one invoice.overdue audit row (actor=system) per flipped invoice', async () => {
    const invoice = await seedIssuedInvoicePastDue();
    const { handler } = captureHandler();
    await handler(makeContext());

    const rows = await overdueAuditRows(invoice.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actorId).toBe(BILLING_SYSTEM_ACTOR);
    expect(rows[0]!.targetType).toBe('dental_invoice');
    expect(rows[0]!.branchId).toBe(BRANCH_ID);
    expect(rows[0]!.tenantId).toBe(ORG_ID);
  });

  test('idempotent: a second sweep writes no further overdue audit row', async () => {
    const invoice = await seedIssuedInvoicePastDue();
    const { handler } = captureHandler();
    await handler(makeContext());
    await handler(makeContext());

    const rows = await overdueAuditRows(invoice.id);
    expect(rows).toHaveLength(1); // only the first transition is audited
  });
});

describe('dental-billing status sweep handler — plan Behind (FIX-002)', () => {
  test('flips an active plan with a 7+-day overdue installment to behind', async () => {
    const plan = await seedActivePlanWithOverdueInstallment();
    const planRepo = new DentalPaymentPlanRepository(db);

    const { handler } = captureHandler();
    await handler(makeContext());

    const updated = await planRepo.findOneById(plan.id);
    expect(updated!.status).toBe('behind');
  });

  test('leaves a current (not-yet-overdue) plan on_track', async () => {
    const invoice = await seedIssuedInvoicePastDue();
    const [plan] = await db.insert(dentalPaymentPlans).values({
      id: crypto.randomUUID(), invoiceId: invoice.id, patientId: PATIENT_ID,
      totalCents: 10000, numberOfInstallments: 2, frequency: 'monthly',
      startDate: new Date(Date.now() - 2 * DAY), amountPerInstallmentCents: 5000,
      status: 'on_track', createdBy: STAFF.id, updatedBy: STAFF.id,
    }).returning();
    await db.insert(dentalPaymentPlanInstallments).values({
      id: crypto.randomUUID(), planId: plan!.id, installmentNumber: 1,
      dueDate: new Date(Date.now() + 5 * DAY), amountCents: 5000, paidCents: 0, status: 'pending',
      createdBy: STAFF.id, updatedBy: STAFF.id,
    });
    const planRepo = new DentalPaymentPlanRepository(db);

    const { handler } = captureHandler();
    await handler(makeContext());

    const updated = await planRepo.findOneById(plan!.id);
    expect(updated!.status).toBe('on_track');
  });
});

describe('dental-billing status sweep — dunning reminders (BR-050)', () => {
  async function reminderRows(invoiceId: string) {
    return db.select().from(dentalBillingReminderLog)
      .where(eq(dentalBillingReminderLog.invoiceId, invoiceId));
  }
  async function billingNotifs(invoiceId: string) {
    return db.select().from(notifications).where(
      and(eq(notifications.relatedEntity, invoiceId), eq(notifications.type, 'billing')),
    );
  }

  test('fires the first offset (default [3,7,14]) and logs one row + enqueues billing notifs', async () => {
    const invoice = await seedIssuedInvoicePastDue(4); // 4 days overdue → offset 3 only
    const { handler } = captureHandler();
    await handler(makeContext());

    const rows = await reminderRows(invoice.id);
    expect(rows.map((r) => r.offsetDay)).toEqual([3]);
    expect(rows[0]!.status).toBe('sent');
    expect(rows[0]!.branchId).toBe(BRANCH_ID);

    const notifs = await billingNotifs(invoice.id);
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs.every((n) => n.recipient === PERSON_ID)).toBe(true);
    expect(new Set(notifs.map((n) => n.channel))).toEqual(new Set(['email', 'push']));
  });

  test('idempotent: a second sweep writes no further reminder row for the same offset', async () => {
    const invoice = await seedIssuedInvoicePastDue(4);
    const { handler } = captureHandler();
    await handler(makeContext());
    await handler(makeContext());

    const rows = await reminderRows(invoice.id);
    expect(rows.map((r) => r.offsetDay)).toEqual([3]);
  });

  test('fires every elapsed offset: 8 days overdue → offsets 3 and 7, not 14', async () => {
    const invoice = await seedIssuedInvoicePastDue(8);
    const { handler } = captureHandler();
    await handler(makeContext());

    const rows = await reminderRows(invoice.id);
    expect(rows.map((r) => r.offsetDay).sort((a, b) => a - b)).toEqual([3, 7]);
  });

  test('does not remind before the first offset (2 days overdue, default [3,…])', async () => {
    const invoice = await seedIssuedInvoicePastDue(2);
    const { handler } = captureHandler();
    await handler(makeContext());

    expect(await reminderRows(invoice.id)).toHaveLength(0);
    expect(await billingNotifs(invoice.id)).toHaveLength(0);
  });

  test('respects branch-configured offsets', async () => {
    await db.update(dentalBranches).set({ settings: { billingReminderOffsetDays: [5] } })
      .where(eq(dentalBranches.id, BRANCH_ID));
    const invoice = await seedIssuedInvoicePastDue(6); // ≥5
    const { handler } = captureHandler();
    await handler(makeContext());

    const rows = await reminderRows(invoice.id);
    expect(rows.map((r) => r.offsetDay)).toEqual([5]);
  });

  test('never reminds a zero-balance invoice (settled — markOverdue skips it)', async () => {
    const invoice = await seedIssuedInvoicePastDue(10, 0); // balance 0
    const { handler } = captureHandler();
    await handler(makeContext());

    expect(await reminderRows(invoice.id)).toHaveLength(0);
  });

  const HOUR = 60 * 60 * 1000;

  test('reclaims a stale pending reminder (crashed prior sweep) and re-sends', async () => {
    const invoice = await seedIssuedInvoicePastDue(4); // offset 3 elapsed
    // Simulate a sweep that claimed offset 3 then crashed before dispatch:
    // the row is stuck 'pending', sent_at well past the reclaim window.
    await db.insert(dentalBillingReminderLog).values({
      id: crypto.randomUUID(), invoiceId: invoice.id, branchId: BRANCH_ID,
      offsetDay: 3, channel: '', status: 'pending',
      sentAt: new Date(Date.now() - 2 * HOUR),
      createdBy: STAFF.id, updatedBy: STAFF.id,
    });

    const { handler } = captureHandler();
    await handler(makeContext());

    const rows = await reminderRows(invoice.id);
    expect(rows).toHaveLength(1); // reclaimed in place, not duplicated
    expect(rows[0]!.status).toBe('sent');
    expect((await billingNotifs(invoice.id)).length).toBeGreaterThanOrEqual(1);
  });

  test('does NOT reclaim a fresh pending reminder (in-flight claim from a concurrent run)', async () => {
    const invoice = await seedIssuedInvoicePastDue(4);
    await db.insert(dentalBillingReminderLog).values({
      id: crypto.randomUUID(), invoiceId: invoice.id, branchId: BRANCH_ID,
      offsetDay: 3, channel: '', status: 'pending',
      sentAt: new Date(), // fresh — inside the reclaim window
      createdBy: STAFF.id, updatedBy: STAFF.id,
    });

    const { handler } = captureHandler();
    await handler(makeContext());

    const rows = await reminderRows(invoice.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('pending'); // left untouched
    expect(await billingNotifs(invoice.id)).toHaveLength(0); // no duplicate send
  });
});
