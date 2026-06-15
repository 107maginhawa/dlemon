/**
 * FIX-010 — patient-balance dual-source equality pin
 *
 * The FE sums per-invoice balanceCents (use-patient-billing.ts) while the
 * getPatientBalance endpoint computes its own outstandingBalanceCents. They must
 * AGREE: Σ (non-voided invoice.balanceCents) == endpoint.outstandingBalanceCents,
 * with voided invoices excluded on BOTH sides. This pin closes the dual-source
 * drift class without FE rework (the endpoint is otherwise a 0-consumer orphan).
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { assertEndpointTotalEqualsRepoSum } from '@/tests/helpers/coherence';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const USER = { id: '00000000-0000-0000-0000-0000000ba101', email: 'bal@clinic.com' };
const ORG_ID = 'ec000000-0000-1000-8000-0000000ba101';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000ba101';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000ba101';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000ba101';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000ba101';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000ba101';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Balance Clinic', tier: 'solo', ownerPersonId: USER.id, countryCode: 'PH', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Bal', lastName: 'Ance', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.delete(dentalInvoices).where(eq(dentalInvoices.patientId, PATIENT_ID));
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

describe('FIX-010 — getPatientBalance equals Σ per-invoice balanceCents (non-voided)', () => {
  test('mixed paid/partial/issued/overdue sum to the endpoint balance; voided is excluded on both sides', async () => {
    // The FE sums these per-invoice balances; voided (9999) must NOT count.
    await seedInvoice('paid', 4000, 4000, 0);
    await seedInvoice('partial', 8000, 5000, 3000);
    await seedInvoice('issued', 5000, 0, 5000);
    await seedInvoice('overdue', 2000, 0, 2000);
    await seedInvoice('voided', 9999, 0, 9999);

    // The FE's source of truth: Σ non-voided invoice.balanceCents.
    const invoiceRepo = new DentalInvoiceRepository(db);
    const invoices = await invoiceRepo.findMany({ patientId: PATIENT_ID });
    const clientVisibleBalance = invoices
      .filter((inv) => inv.status !== 'voided')
      .reduce((sum, inv) => sum + inv.balanceCents, 0);
    expect(clientVisibleBalance).toBe(10000); // 0 + 3000 + 5000 + 2000

    const res = await buildTestApp({ db, user: USER }).request(`/dental/billing/patients/${PATIENT_ID}/balance`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;

    // EQUALITY: the endpoint and the FE's per-invoice sum must agree.
    expect(body.outstandingBalanceCents).toBe(clientVisibleBalance);
    // And the voided invoice's 9999 leaked into neither source.
    expect(body.outstandingBalanceCents).toBe(10000);
    expect(body.overdueAmountCents).toBe(2000);
  });
});

/**
 * Backend coherence-oracle wiring (EM-BIL-002 class).
 *
 * getArAging returns BOTH an aggregate `summary.totalOutstandingCents` AND the
 * itemised `patients[]` rows it was computed over. The leak incident was a
 * report whose summary was summed across a DIFFERENT (wider) scope than the
 * rows it shipped. `assertEndpointTotalEqualsRepoSum` pins the invariant
 * against the RESPONSE: the summary must equal Σ of the rows THIS response
 * returned. We seed two patients with overdue balances so the summary genuinely
 * aggregates multiple rows — a single-row case could pass vacuously.
 */
describe('EM-BIL-002 coherence — getArAging summary equals Σ of its returned patient rows', () => {
  // Second patient (same branch) so the aging summary aggregates >1 row.
  const PERSON_2 = 'ee000000-0000-1000-8000-0000000ba102';
  const PATIENT_2 = 'aa000000-0000-1000-8000-0000000ba102';
  const VISIT_2 = 'dd000000-0000-1000-8000-0000000ba102';

  beforeAll(async () => {
    await db.insert(persons).values({ id: PERSON_2, firstName: 'Ar', lastName: 'Aging', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
    await db.insert(patients).values({ id: PATIENT_2, person: PERSON_2, preferredBranchId: BRANCH_ID, createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
    await db.insert(dentalVisits).values({ id: VISIT_2, patientId: PATIENT_2, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: USER.id, updatedBy: USER.id }).onConflictDoNothing();
  });

  async function seedOverdueInvoiceFor(patientId: string, total: number, balance: number, ageDays: number) {
    const invoiceRepo = new DentalInvoiceRepository(db);
    const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
    const due = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
    await db.insert(dentalInvoices).values({
      id: crypto.randomUUID(), patientId, branchId: BRANCH_ID,
      dentistMemberId: MEMBER_ID, invoiceNumber, status: 'overdue',
      subtotalCents: total, discountCents: 0, taxCents: 0, taxRate: '0',
      totalCents: total, paidCents: total - balance, balanceCents: balance,
      dueDate: due, issuedAt: due, createdBy: USER.id, updatedBy: USER.id,
    });
  }

  afterEach(async () => {
    await db.delete(dentalInvoices).where(eq(dentalInvoices.patientId, PATIENT_2));
  });

  test('the practice-wide AR summary is fully explained by the rows the same response returns', async () => {
    // Two patients, three overdue invoices across different aging buckets.
    await seedOverdueInvoiceFor(PATIENT_ID, 5000, 5000, 40);   // patient 1: 5000
    await seedOverdueInvoiceFor(PATIENT_ID, 3000, 3000, 95);   // patient 1: +3000
    await seedOverdueInvoiceFor(PATIENT_2, 7000, 7000, 200);   // patient 2: 7000

    const res = await buildTestApp({ db, user: USER }).request('/dental/billing/collections/aging');
    expect(res.status).toBe(200);
    const body = await res.json() as any;

    // Sanity: the rows we seeded actually surfaced (≥2 patients, non-zero summary).
    expect(body.patients.length).toBeGreaterThanOrEqual(2);
    expect(body.summary.totalOutstandingCents).toBeGreaterThan(0);

    // THE ORACLE: the summary total must equal Σ over the response's OWN rows.
    // Drizzle numerics arrive as numbers here (computed in the handler), but coerce
    // defensively — a summary summed from a different/wider scope than these rows
    // (the EM-BIL-002 leak) would make this throw.
    assertEndpointTotalEqualsRepoSum({
      total: Number(body.summary.totalOutstandingCents),
      rowAmounts: body.patients.map((p: any) => Number(p.totalOutstandingCents)),
      label: 'AR aging summary.totalOutstandingCents',
    });
  });
});
