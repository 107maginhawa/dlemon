/**
 * BR-048 — payment terms → dueDate at issue (Phase 2.1).
 *
 * At issue, dueDate derives from payment terms with precedence:
 *   invoice override → MAX of line-item service terms → clinic default → 0,
 * UNLESS the caller supplied an explicit dueDate at create (that wins).
 * dueDate = issuedAt + resolvedDays. Net-0 = due on receipt.
 *
 * These assert the END-TO-END handler behavior; the precedence/bounds math is
 * unit-tested in utils/payment-terms.test.ts.
 */
import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { dentalInvoices, dentalInvoiceLineItems } from './repos/dental-invoice.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalProcedureCodes } from '@/handlers/dental-visit/repos/procedure-code.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-0000000be048', email: 'owner@terms.com' };
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000be048';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000be048';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000be048';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000be048';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000be048';
const ORG_ID = 'ec000000-0000-1000-8000-0000000be048';
const TERMS_CDT = 'D-TERMS-60'; // a synthetic catalog entry carrying 60-day terms

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Terms Clinic', tier: 'solo', ownerPersonId: OWNER.id, countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Terms Branch', timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Terms', lastName: 'Patient', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalProcedureCodes).values({ cdtCode: TERMS_CDT, description: '60-day terms svc', category: 'restorative', defaultFeePhp: 5000, paymentTermsDays: 60, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoUpdate({ target: dentalProcedureCodes.cdtCode, set: { paymentTermsDays: 60 } });
});

async function setBranchDefaultTerms(days: number | null) {
  await db.update(dentalBranches).set({ settings: days == null ? {} : { defaultPaymentTermsDays: days } }).where(eq(dentalBranches.id, BRANCH_ID));
}

async function seedDraftInvoice(opts: { paymentTermsDays?: number; dueDate?: Date; cdtCode?: string } = {}) {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
  const [inv] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
    invoiceNumber, status: 'draft', subtotalCents: 5000, totalCents: 5000, balanceCents: 5000,
    ...(opts.paymentTermsDays != null ? { paymentTermsDays: opts.paymentTermsDays } : {}),
    ...(opts.dueDate ? { dueDate: opts.dueDate } : {}),
    createdBy: OWNER.id, updatedBy: OWNER.id,
  }).returning();
  await db.insert(dentalInvoiceLineItems).values({
    invoiceId: inv!.id, cdtCode: opts.cdtCode ?? 'D0120', description: 'Exam', unitPriceCents: 5000, amountCents: 5000,
    createdBy: OWNER.id, updatedBy: OWNER.id,
  });
  return inv!;
}

async function issue(invoiceId: string) {
  const app = buildTestApp({ db, user: OWNER });
  const res = await app.request(new Request(`http://localhost/dental/billing/invoices/${invoiceId}/issue`, { method: 'PATCH' }));
  return res;
}

/** Whole-day gap between dueDate and issuedAt on the returned invoice. */
function dueInDays(inv: { issuedAt: string | Date; dueDate: string | Date }): number {
  return Math.round((new Date(inv.dueDate).getTime() - new Date(inv.issuedAt).getTime()) / 86_400_000);
}

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_invoice_line_item`);
  await db.execute(sql`DELETE FROM dental_invoice`);
  await setBranchDefaultTerms(null);
});

describe('BR-048: payment terms → dueDate at issue', () => {
  test('uses the clinic default when no override and no service terms', async () => {
    await setBranchDefaultTerms(30);
    const inv = await seedDraftInvoice(); // line item D0120 has no procedure terms
    const res = await issue(inv.id);
    expect(res.status).toBe(200);
    const issued = await res.json() as { issuedAt: string; dueDate: string };
    expect(issued.dueDate).toBeTruthy();
    expect(dueInDays(issued)).toBe(30);
  });

  test('invoice override wins over the clinic default', async () => {
    await setBranchDefaultTerms(30);
    const inv = await seedDraftInvoice({ paymentTermsDays: 7 });
    const res = await issue(inv.id);
    const issued = await res.json() as { issuedAt: string; dueDate: string };
    expect(dueInDays(issued)).toBe(7);
  });

  test('line-item service terms apply when there is no invoice override', async () => {
    await setBranchDefaultTerms(30);
    const inv = await seedDraftInvoice({ cdtCode: TERMS_CDT }); // 60-day service terms > 30 default
    const res = await issue(inv.id);
    const issued = await res.json() as { issuedAt: string; dueDate: string };
    expect(dueInDays(issued)).toBe(60);
  });

  test('a caller-supplied dueDate is preserved (not overwritten) at issue', async () => {
    await setBranchDefaultTerms(30);
    const explicit = new Date('2026-09-01T00:00:00Z');
    const inv = await seedDraftInvoice({ dueDate: explicit });
    const res = await issue(inv.id);
    const issued = await res.json() as { dueDate: string };
    expect(new Date(issued.dueDate).toISOString()).toBe(explicit.toISOString());
  });

  test('defaults to due-on-receipt (dueDate == issuedAt) when nothing is configured', async () => {
    const inv = await seedDraftInvoice(); // no branch default, no override, no service terms
    const res = await issue(inv.id);
    const issued = await res.json() as { issuedAt: string; dueDate: string };
    expect(dueInDays(issued)).toBe(0);
  });
});
