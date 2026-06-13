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
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import type { JobScheduler, JobHandler, JobContext } from '@/core/jobs';
import { registerDentalBillingJobs } from './index';
import { DentalInvoiceRepository } from '../repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from '../repos/dental-payment-plan.repo';
import { dentalInvoices } from '../repos/dental-invoice.schema';
import { dentalPaymentPlans, dentalPaymentPlanInstallments } from '../repos/dental-payment-plan.schema';

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
  await db.execute(sql`DELETE FROM dental_payment_plan_installment`);
  await db.execute(sql`DELETE FROM dental_payment_plan`);
  await db.execute(sql`DELETE FROM dental_invoice`);
});

const DAY = 24 * 60 * 60 * 1000;

async function seedIssuedInvoicePastDue() {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const [row] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(),
    visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    invoiceNumber, status: 'issued', subtotalCents: 10000, discountCents: 0, taxCents: 0,
    taxRate: '0', totalCents: 10000, paidCents: 0, balanceCents: 10000,
    issuedAt: new Date(), dueDate: new Date(Date.now() - DAY),
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
