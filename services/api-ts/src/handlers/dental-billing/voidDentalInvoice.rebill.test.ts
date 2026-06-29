/**
 * voidDentalInvoice.rebill.test.ts — G-01 (prod-readiness audit)
 *
 * Bug: voiding an invoice flipped only invoice.status to 'voided' but never
 * reset the billed treatments' billedInvoiceId. Those treatments stayed
 * permanently "billed" → createDentalInvoice's TREATMENT_ALREADY_BILLED guard
 * (createDentalInvoice.ts:86) made re-invoicing impossible (422) and the visit
 * un-discardable (discardVisit.ts:57). Voiding a billing mistake must release
 * the treatments so they can be correctly re-billed.
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalTreatments } from '@/handlers/dental-visit/repos/treatment.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const STAFF_USER = { id: '00000000-0000-0000-0000-0000000000a1', email: 'rebill-staff@clinic.com' };
const PATIENT_ID = 'aa000000-0000-1000-8000-0000000000a1';
const PERSON_ID = 'ee000000-0000-1000-8000-0000000000a1';
const BRANCH_ID = 'bb000000-0000-1000-8000-0000000000a2';
const MEMBER_ID = 'cc000000-0000-1000-8000-0000000000a3';
const VISIT_ID = 'dd000000-0000-1000-8000-0000000000a4';
const ORG_ID = 'ec000000-0000-1000-8000-0000000000a1';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Rebill Clinic', tier: 'solo', ownerPersonId: STAFF_USER.id, countryCode: 'PH', createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: MEMBER_ID, branchId: BRANCH_ID, personId: STAFF_USER.id, displayName: 'Owner', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON_ID, firstName: 'Re', lastName: 'Bill', createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
  await db.insert(dentalVisits).values({ id: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed', createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_treatment WHERE visit_id = ${VISIT_ID}`);
  await db.execute(sql`DELETE FROM dental_invoice WHERE branch_id = ${BRANCH_ID}`);
});

async function seedBilledTreatmentAndInvoice() {
  const invoiceRepo = new DentalInvoiceRepository(db);
  const [invoice] = await db.insert(dentalInvoices).values({
    id: crypto.randomUUID(),
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    branchId: BRANCH_ID,
    dentistMemberId: MEMBER_ID,
    invoiceNumber: await invoiceRepo.generateInvoiceNumber(),
    status: 'issued',
    subtotalCents: 5000,
    discountCents: 0,
    taxCents: 0,
    taxRate: '0',
    totalCents: 5000,
    paidCents: 0,
    balanceCents: 5000,
    issuedAt: new Date(),
    createdBy: STAFF_USER.id,
    updatedBy: STAFF_USER.id,
  }).returning();

  const [treatment] = await db.insert(dentalTreatments).values({
    id: crypto.randomUUID(),
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    cdtCode: 'D2150',
    description: 'Amalgam — two surface',
    status: 'performed',
    priceCents: 5000,
    billedInvoiceId: invoice!.id,
    performedAt: new Date(),
    createdBy: STAFF_USER.id,
    updatedBy: STAFF_USER.id,
  }).returning();

  return { invoice: invoice!, treatment: treatment! };
}

describe('G-01: voiding an invoice releases its treatments for re-billing', () => {
  test('void clears billedInvoiceId on the invoice’s treatments', async () => {
    const { invoice, treatment } = await seedBilledTreatmentAndInvoice();
    const treatmentRepo = new TreatmentRepository(db);

    // sanity: treatment starts billed to this invoice
    expect((await treatmentRepo.findOneById(treatment.id))!.billedInvoiceId).toBe(invoice.id);

    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request(`/dental/billing/invoices/${invoice.id}/void`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Duplicate invoice — correcting' }),
    });
    expect(res.status).toBe(200);

    // invoice is voided AND the treatment is released (billable again)
    expect((await new DentalInvoiceRepository(db).findOneById(invoice.id))!.status).toBe('voided');
    expect((await treatmentRepo.findOneById(treatment.id))!.billedInvoiceId).toBeNull();
  });

  test('void leaves treatments billed to OTHER invoices untouched', async () => {
    const { invoice: invoiceA } = await seedBilledTreatmentAndInvoice();
    // a second treatment billed to a different (still-live) invoice
    const invoiceRepo = new DentalInvoiceRepository(db);
    const [invoiceB] = await db.insert(dentalInvoices).values({
      id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID,
      invoiceNumber: await invoiceRepo.generateInvoiceNumber(), status: 'issued', subtotalCents: 3000, discountCents: 0,
      taxCents: 0, taxRate: '0', totalCents: 3000, paidCents: 0, balanceCents: 3000, issuedAt: new Date(),
      createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id,
    }).returning();
    const [treatmentB] = await db.insert(dentalTreatments).values({
      id: crypto.randomUUID(), visitId: VISIT_ID, patientId: PATIENT_ID, cdtCode: 'D1110', description: 'Prophylaxis',
      status: 'performed', priceCents: 3000, billedInvoiceId: invoiceB!.id, performedAt: new Date(),
      createdBy: STAFF_USER.id, updatedBy: STAFF_USER.id,
    }).returning();

    const app = buildTestApp({ db, user: STAFF_USER });
    const res = await app.request(`/dental/billing/invoices/${invoiceA.id}/void`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Correcting invoice A only' }),
    });
    expect(res.status).toBe(200);

    // treatmentB stays billed to the untouched invoice B
    expect((await new TreatmentRepository(db).findOneById(treatmentB!.id))!.billedInvoiceId).toBe(invoiceB!.id);
  });
});
