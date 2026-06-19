/**
 * BR-054 — invoice tax derived from the branch tax mode (PH).
 *
 * Tax is server-derived, NEVER caller-supplied (closes BR-010 / EM-BILL-001):
 *   - non_vat (default): taxCents 0, total = subtotal.
 *   - vat_registered: 12% VAT carved out of the gross (VAT-inclusive); total
 *     stays = subtotal, taxCents holds the VAT portion.
 *
 * End-to-end handler behavior; the carve math is unit-tested in utils/tax.test.ts.
 */
import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-0000000be054', email: 'owner@tax.com' };
const PERSON_ID = 'ee000000-0000-1000-8000-0000000be054';
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000be054';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000be054';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000be054';
const ORG_ID = 'ec000000-0000-1000-8000-0000000be054';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Tax Clinic', tier: 'solo', ownerPersonId: OWNER.id, countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Tax Branch', timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Tax', lastName: 'Patient', createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: OWNER.id, updatedBy: OWNER.id }).onConflictDoNothing();
});

async function setBranchTaxMode(settings: Record<string, unknown> | null) {
  await db.update(dentalBranches).set({ settings: settings ?? {} }).where(eq(dentalBranches.id, BRANCH_ID));
}

async function seedBillableVisit(priceCents = 100000) {
  const visitRepo = new VisitRepository(db);
  const created = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID });
  const visit = await visitRepo.activate(created.id);
  await new TreatmentRepository(db).createOne({
    visitId: visit!.id, patientId: PATIENT_ID, cdtCode: 'D0120',
    description: 'Periodic oral evaluation', priceCents, carriedOver: false, status: 'performed' as any,
  });
  await db.insert(consentForms).values({
    id: crypto.randomUUID(), visitId: visit!.id, patientId: PATIENT_ID,
    templateId: 'general-consent-v1', templateName: 'General Treatment Consent',
    signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,test',
    createdBy: OWNER.id, updatedBy: OWNER.id,
  });
  return visit!;
}

async function createInvoice(visitId: string) {
  const app = buildTestApp({ db, user: OWNER });
  const res = await app.request(new Request('http://localhost/dental/billing/invoices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID }),
  }));
  return res;
}

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_invoice_line_item`);
  await db.execute(sql`DELETE FROM dental_invoice`);
  await db.execute(sql`DELETE FROM dental_treatment`);
  await db.execute(sql`DELETE FROM consent_form`);
  await db.execute(sql`DELETE FROM dental_visit`);
  await setBranchTaxMode(null);
});

describe('BR-054: invoice tax derived from branch tax mode', () => {
  test('non_vat branch (default) → zero tax, total = subtotal', async () => {
    await setBranchTaxMode(null); // no taxMode set → defaults to non_vat
    const visit = await seedBillableVisit(100000);
    const res = await createInvoice(visit.id);
    expect(res.status).toBe(201);
    const inv = await res.json() as { subtotalCents: number; taxCents: number; taxRate: string; totalCents: number };
    expect(inv.taxCents).toBe(0);
    expect(Number(inv.taxRate)).toBe(0);
    expect(inv.totalCents).toBe(inv.subtotalCents);
    expect(inv.subtotalCents).toBe(100000);
  });

  test('vat_registered branch → 12% VAT carved out of the gross; total unchanged', async () => {
    await setBranchTaxMode({ taxMode: 'vat_registered' });
    const visit = await seedBillableVisit(100000);
    const res = await createInvoice(visit.id);
    expect(res.status).toBe(201);
    const inv = await res.json() as { subtotalCents: number; taxCents: number; taxRate: string; totalCents: number };
    expect(inv.taxCents).toBe(10714); // 100000 * 12/112
    expect(Number(inv.taxRate)).toBe(0.12);
    expect(inv.totalCents).toBe(100000); // VAT-inclusive: carved out, total unchanged
  });

  test('BR-010: tax is branch-derived, not caller-derived — same body, different branch mode, different tax', async () => {
    const visit1 = await seedBillableVisit(100000);
    await setBranchTaxMode(null);
    const nonVat = await (await createInvoice(visit1.id)).json() as { taxCents: number };
    expect(nonVat.taxCents).toBe(0);

    // identical request body, only the branch setting changed
    await db.execute(sql`DELETE FROM dental_invoice_line_item`);
    await db.execute(sql`DELETE FROM dental_invoice`);
    await db.execute(sql`DELETE FROM dental_treatment`);
    await db.execute(sql`DELETE FROM consent_form`);
    await db.execute(sql`DELETE FROM dental_visit`);
    await setBranchTaxMode({ taxMode: 'vat_registered' });
    const visit2 = await seedBillableVisit(100000);
    const vat = await (await createInvoice(visit2.id)).json() as { taxCents: number };
    expect(vat.taxCents).toBe(10714);
  });
});
