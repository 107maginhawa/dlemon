/**
 * RLS P1a — Tier-1 per-table isolation matrix (ADR-010 pre-GA gate).
 *
 * The dental_visit Stage-0 test proved the MECHANISM. This file proves migration
 * 0105 actually armed EVERY other Tier-1 table with the correct tenant column, by
 * running the shared cross-tenant CRUD-denial matrix (registerRlsMatrix) against
 * each: a row in tenant A and a row in tenant B, then assert app_rls scoped to A
 * sees/writes only A, [A,B] sees both, an empty/unset scope sees neither, and a
 * write into the out-of-scope tenant is rejected by WITH CHECK.
 *
 * All rows are seeded as the postgres superuser (bypasses RLS), the production
 * write path today. Runs against its own cloned DB (scripts/test-with-db.ts),
 * which carries migrations 0104 + 0105.
 */

import { describe, beforeAll } from 'bun:test';
import { createDatabase, type DatabaseInstance } from '@/core/database';
import {
  seedRlsBaseFixture,
  BRANCH_A, BRANCH_B, ORG_A, ORG_B, MEMBER_A, MEMBER_B,
  PATIENT_A, PATIENT_B, VISIT_A, VISIT_B, OWNER_A, OWNER_B,
} from '@/tests/helpers/rls-fixtures';
import { registerRlsMatrix } from '@/tests/helpers/rls-matrix';

import { dentalInvoices } from '@/handlers/dental-billing/repos/dental-invoice.schema';
import { dentalPayments } from '@/handlers/dental-billing/repos/dental-payment.schema';
import { dentalPayerPayments } from '@/handlers/dental-billing/repos/dental-payer-payment.schema';
import { dentalInsuranceClaims } from '@/handlers/dental-billing/repos/dental-insurance-claim.schema';
import { dentalPerioCharts } from '@/handlers/dental-perio/repos/perio-chart.schema';
import { dentalAppointments } from '@/handlers/dental-scheduling/repos/dental-appointment.schema';
import { dentalAppointmentHolds } from '@/handlers/dental-scheduling/repos/appointment-hold.schema';
import { dentalQueueItems } from '@/handlers/dental-scheduling/repos/queue-item.schema';
import { dentalWaitlistEntries } from '@/handlers/dental-scheduling/repos/waitlist-entry.schema';
import { dentalOperatories } from '@/handlers/dental-scheduling/repos/operatory.schema';
import { dentalHouseholds } from '@/handlers/dental-patient/repos/household.schema';
import { dentalCoverageAuthorizations } from '@/handlers/dental-patient/repos/coverage-authorization.schema';
import { dentalInsuranceProfiles } from '@/handlers/dental-patient/repos/insurance-profile.schema';
import { imagingStudies, imagingStudyImages } from '@/handlers/dental-imaging/repos/imaging.schema';
import { imagingFindings } from '@/handlers/dental-imaging/repos/imaging_finding.schema';
import { dentalInventoryItems } from '@/handlers/dental-clinical/repos/inventory.schema';
import { dentalConsentTemplates } from '@/handlers/dental-org/repos/consent-template.schema';
import { dentalTreatmentTemplates } from '@/handlers/dental-visit/repos/treatment-template.schema';
import { dentalPostopTemplates } from '@/handlers/dental-clinical/repos/postop-template.schema';
import { dentalFeaturePermissions } from '@/handlers/dental-org/repos/feature-permission.schema';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';

const db: DatabaseInstance = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Distinct deterministic ids (f… prefix → no collision with the e… base fixture
// or the d… dental_visit Stage-0 test). Parent rows double as test subjects where
// a table is both seeded-for-test and FK-referenced by another table.
const PROFILE_A = 'f0000001-0000-4000-8000-0000000000a0', PROFILE_B = 'f0000001-0000-4000-8000-0000000000b0';
const INVOICE_A = 'f0000002-0000-4000-8000-0000000000a0', INVOICE_B = 'f0000002-0000-4000-8000-0000000000b0';
const CLAIM_A = 'f0000003-0000-4000-8000-0000000000a0', CLAIM_B = 'f0000003-0000-4000-8000-0000000000b0';
const APPT_A = 'f0000004-0000-4000-8000-0000000000a0', APPT_B = 'f0000004-0000-4000-8000-0000000000b0';
const STUDY_A = 'f0000005-0000-4000-8000-0000000000a0', STUDY_B = 'f0000005-0000-4000-8000-0000000000b0';
const IMAGE_A = 'f0000006-0000-4000-8000-0000000000a0', IMAGE_B = 'f0000006-0000-4000-8000-0000000000b0';
const PAYMENT_A = 'f0000007-0000-4000-8000-0000000000a0', PAYMENT_B = 'f0000007-0000-4000-8000-0000000000b0';
const PAYER_A = 'f0000008-0000-4000-8000-0000000000a0', PAYER_B = 'f0000008-0000-4000-8000-0000000000b0';
const PERIO_A = 'f0000009-0000-4000-8000-0000000000a0', PERIO_B = 'f0000009-0000-4000-8000-0000000000b0';
const HOLD_A = 'f000000a-0000-4000-8000-0000000000a0', HOLD_B = 'f000000a-0000-4000-8000-0000000000b0';
const QUEUE_A = 'f000000b-0000-4000-8000-0000000000a0', QUEUE_B = 'f000000b-0000-4000-8000-0000000000b0';
const WAIT_A = 'f000000c-0000-4000-8000-0000000000a0', WAIT_B = 'f000000c-0000-4000-8000-0000000000b0';
const OPERATORY_A = 'f000000d-0000-4000-8000-0000000000a0', OPERATORY_B = 'f000000d-0000-4000-8000-0000000000b0';
const HOUSEHOLD_A = 'f000000e-0000-4000-8000-0000000000a0', HOUSEHOLD_B = 'f000000e-0000-4000-8000-0000000000b0';
const COVERAGE_A = 'f000000f-0000-4000-8000-0000000000a0', COVERAGE_B = 'f000000f-0000-4000-8000-0000000000b0';
const FINDING_A = 'f0000010-0000-4000-8000-0000000000a0', FINDING_B = 'f0000010-0000-4000-8000-0000000000b0';
const INVENTORY_A = 'f0000011-0000-4000-8000-0000000000a0', INVENTORY_B = 'f0000011-0000-4000-8000-0000000000b0';
const CONSENT_A = 'f0000012-0000-4000-8000-0000000000a0', CONSENT_B = 'f0000012-0000-4000-8000-0000000000b0';
const TTPL_A = 'f0000013-0000-4000-8000-0000000000a0', TTPL_B = 'f0000013-0000-4000-8000-0000000000b0';
const POSTOP_A = 'f0000014-0000-4000-8000-0000000000a0', POSTOP_B = 'f0000014-0000-4000-8000-0000000000b0';
const FEATPERM_A = 'f0000015-0000-4000-8000-0000000000a0', FEATPERM_B = 'f0000015-0000-4000-8000-0000000000b0';
const AUDIT_A = 'f0000016-0000-4000-8000-0000000000a0', AUDIT_B = 'f0000016-0000-4000-8000-0000000000b0';
// FK-less image file refs (cross-module loose-coupling; any uuid).
const FILE_A = 'f00000f1-0000-4000-8000-0000000000a0', FILE_B = 'f00000f1-0000-4000-8000-0000000000b0';

const rid = () => crypto.randomUUID();

beforeAll(async () => {
  await seedRlsBaseFixture(db);

  // Shared parents (FK targets that double as test subjects).
  await db.insert(dentalInsuranceProfiles).values([
    { id: PROFILE_A, patientId: PATIENT_A, insurerName: 'Maxicare', policyNumber: 'POL-A-0001', subscriberName: 'Owner A', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: PROFILE_B, patientId: PATIENT_B, insurerName: 'Intellicare', policyNumber: 'POL-B-0001', subscriberName: 'Owner B', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalInvoices).values([
    { id: INVOICE_A, branchId: BRANCH_A, patientId: PATIENT_A, dentistMemberId: MEMBER_A, visitId: VISIT_A, invoiceNumber: 'INV-A-0001', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: INVOICE_B, branchId: BRANCH_B, patientId: PATIENT_B, dentistMemberId: MEMBER_B, visitId: VISIT_B, invoiceNumber: 'INV-B-0001', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalInsuranceClaims).values([
    { id: CLAIM_A, branchId: BRANCH_A, patientId: PATIENT_A, insuranceProfileId: PROFILE_A, claimNumber: 'CLM-A-0001', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: CLAIM_B, branchId: BRANCH_B, patientId: PATIENT_B, insuranceProfileId: PROFILE_B, claimNumber: 'CLM-B-0001', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalAppointments).values([
    { id: APPT_A, branchId: BRANCH_A, patientId: PATIENT_A, dentistMemberId: MEMBER_A, scheduledAt: new Date('2026-07-01T09:00:00.000Z'), serviceType: 'cleaning', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: APPT_B, branchId: BRANCH_B, patientId: PATIENT_B, dentistMemberId: MEMBER_B, scheduledAt: new Date('2026-07-01T09:00:00.000Z'), serviceType: 'cleaning', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(imagingStudies).values([
    { id: STUDY_A, branchId: BRANCH_A, patientId: PATIENT_A, visitId: VISIT_A, acquiredBy: MEMBER_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: STUDY_B, branchId: BRANCH_B, patientId: PATIENT_B, visitId: VISIT_B, acquiredBy: MEMBER_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(imagingStudyImages).values([
    { id: IMAGE_A, studyId: STUDY_A, fileId: FILE_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: IMAGE_B, studyId: STUDY_B, fileId: FILE_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  // Per-table test subjects.
  await db.insert(dentalPayments).values([
    { id: PAYMENT_A, branchId: BRANCH_A, invoiceId: INVOICE_A, patientId: PATIENT_A, amountCents: 10000, method: 'cash', receiptNumber: 'RCPT-A-0001', recordedByMemberId: MEMBER_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: PAYMENT_B, branchId: BRANCH_B, invoiceId: INVOICE_B, patientId: PATIENT_B, amountCents: 10000, method: 'cash', receiptNumber: 'RCPT-B-0001', recordedByMemberId: MEMBER_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalPayerPayments).values([
    { id: PAYER_A, branchId: BRANCH_A, claimId: CLAIM_A, insuranceProfileId: PROFILE_A, amountCents: 10000, method: 'bank_transfer', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: PAYER_B, branchId: BRANCH_B, claimId: CLAIM_B, insuranceProfileId: PROFILE_B, amountCents: 10000, method: 'bank_transfer', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalPerioCharts).values([
    { id: PERIO_A, branchId: BRANCH_A, visitId: VISIT_A, patientId: PATIENT_A, examinerMemberId: MEMBER_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: PERIO_B, branchId: BRANCH_B, visitId: VISIT_B, patientId: PATIENT_B, examinerMemberId: MEMBER_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalAppointmentHolds).values([
    { id: HOLD_A, branchId: BRANCH_A, providerId: MEMBER_A, startAt: new Date('2026-07-01T09:00:00.000Z'), durationMinutes: 30, expiresAt: new Date('2026-07-01T09:10:00.000Z'), sessionToken: 'hold-token-a-0001', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: HOLD_B, branchId: BRANCH_B, providerId: MEMBER_B, startAt: new Date('2026-07-01T09:00:00.000Z'), durationMinutes: 30, expiresAt: new Date('2026-07-01T09:10:00.000Z'), sessionToken: 'hold-token-b-0001', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalQueueItems).values([
    { id: QUEUE_A, branchId: BRANCH_A, appointmentId: APPT_A, patientId: PATIENT_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: QUEUE_B, branchId: BRANCH_B, appointmentId: APPT_B, patientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalWaitlistEntries).values([
    { id: WAIT_A, branchId: BRANCH_A, patientId: PATIENT_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: WAIT_B, branchId: BRANCH_B, patientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalOperatories).values([
    { id: OPERATORY_A, branchId: BRANCH_A, name: 'Operatory 1 (A)', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: OPERATORY_B, branchId: BRANCH_B, name: 'Operatory 1 (B)', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalHouseholds).values([
    { id: HOUSEHOLD_A, branchId: BRANCH_A, name: 'Santos Family', guarantorPatientId: PATIENT_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: HOUSEHOLD_B, branchId: BRANCH_B, name: 'Cruz Family', guarantorPatientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalCoverageAuthorizations).values([
    { id: COVERAGE_A, branchId: BRANCH_A, patientId: PATIENT_A, insuranceProfileId: PROFILE_A, status: 'requested', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: COVERAGE_B, branchId: BRANCH_B, patientId: PATIENT_B, insuranceProfileId: PROFILE_B, status: 'requested', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(imagingFindings).values([
    { id: FINDING_A, branchId: BRANCH_A, imageId: IMAGE_A, patientId: PATIENT_A, type: 'caries', status: 'draft', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: FINDING_B, branchId: BRANCH_B, imageId: IMAGE_B, patientId: PATIENT_B, type: 'caries', status: 'draft', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalInventoryItems).values([
    { id: INVENTORY_A, branchId: BRANCH_A, name: 'Nitrile Gloves M', category: 'consumable', unit: 'box', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: INVENTORY_B, branchId: BRANCH_B, name: 'Nitrile Gloves M', category: 'consumable', unit: 'box', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalConsentTemplates).values([
    { id: CONSENT_A, branchId: BRANCH_A, name: 'Extraction Consent', body: 'I consent to the extraction procedure.', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: CONSENT_B, branchId: BRANCH_B, name: 'Extraction Consent', body: 'I consent to the extraction procedure.', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalTreatmentTemplates).values([
    { id: TTPL_A, branchId: BRANCH_A, name: 'Composite Filling Set', items: [{ cdtCode: 'D2391', description: 'Resin composite, posterior', priceCents: 18000, toothNumber: 19, surfaces: ['O'] }], createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: TTPL_B, branchId: BRANCH_B, name: 'Composite Filling Set', items: [{ cdtCode: 'D2391', description: 'Resin composite, posterior', priceCents: 18000, toothNumber: 30, surfaces: ['O'] }], createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalPostopTemplates).values([
    { id: POSTOP_A, branchId: BRANCH_A, category: 'extraction', title: 'Post-Extraction Care', content: 'Bite on gauze for 30 minutes.', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: POSTOP_B, branchId: BRANCH_B, category: 'extraction', title: 'Post-Extraction Care', content: 'Bite on gauze for 30 minutes.', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalFeaturePermissions).values([
    { id: FEATPERM_A, organizationId: ORG_A, role: 'dentist_owner', feature: 'billing.invoice.void', allowed: true, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: FEATPERM_B, organizationId: ORG_B, role: 'dentist_owner', feature: 'billing.invoice.void', allowed: true, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalAuditLog).values([
    { id: AUDIT_A, tenantId: BRANCH_A, branchId: BRANCH_A, actorId: OWNER_A, action: 'create', targetType: 'dental_visit', targetId: VISIT_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: AUDIT_B, tenantId: BRANCH_B, branchId: BRANCH_B, actorId: OWNER_B, action: 'create', targetType: 'dental_visit', targetId: VISIT_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
});

describe('dental_invoice', () => registerRlsMatrix({
  db, label: 'dental_invoice', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: INVOICE_A, idB: INVOICE_B,
  selectIds: (x) => x.select({ id: dentalInvoices.id }).from(dentalInvoices),
  insertIntoB: (x) => x.insert(dentalInvoices).values({ id: rid(), branchId: BRANCH_B, patientId: PATIENT_B, dentistMemberId: MEMBER_B, invoiceNumber: 'INV-CHK-' + rid(), createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_payment', () => registerRlsMatrix({
  db, label: 'dental_payment', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: PAYMENT_A, idB: PAYMENT_B,
  selectIds: (x) => x.select({ id: dentalPayments.id }).from(dentalPayments),
  insertIntoB: (x) => x.insert(dentalPayments).values({ id: rid(), branchId: BRANCH_B, invoiceId: INVOICE_B, patientId: PATIENT_B, amountCents: 5000, method: 'cash', receiptNumber: 'RCPT-CHK-' + rid(), recordedByMemberId: MEMBER_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_payer_payment', () => registerRlsMatrix({
  db, label: 'dental_payer_payment', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: PAYER_A, idB: PAYER_B,
  selectIds: (x) => x.select({ id: dentalPayerPayments.id }).from(dentalPayerPayments),
  insertIntoB: (x) => x.insert(dentalPayerPayments).values({ id: rid(), branchId: BRANCH_B, claimId: CLAIM_B, insuranceProfileId: PROFILE_B, amountCents: 5000, method: 'bank_transfer', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_insurance_claim', () => registerRlsMatrix({
  db, label: 'dental_insurance_claim', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: CLAIM_A, idB: CLAIM_B,
  selectIds: (x) => x.select({ id: dentalInsuranceClaims.id }).from(dentalInsuranceClaims),
  insertIntoB: (x) => x.insert(dentalInsuranceClaims).values({ id: rid(), branchId: BRANCH_B, patientId: PATIENT_B, insuranceProfileId: PROFILE_B, claimNumber: 'CLM-CHK-' + rid(), createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_perio_chart', () => registerRlsMatrix({
  db, label: 'dental_perio_chart', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: PERIO_A, idB: PERIO_B,
  selectIds: (x) => x.select({ id: dentalPerioCharts.id }).from(dentalPerioCharts),
  insertIntoB: (x) => x.insert(dentalPerioCharts).values({ id: rid(), branchId: BRANCH_B, visitId: VISIT_B, patientId: PATIENT_B, examinerMemberId: MEMBER_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_appointment', () => registerRlsMatrix({
  db, label: 'dental_appointment', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: APPT_A, idB: APPT_B,
  selectIds: (x) => x.select({ id: dentalAppointments.id }).from(dentalAppointments),
  insertIntoB: (x) => x.insert(dentalAppointments).values({ id: rid(), branchId: BRANCH_B, patientId: PATIENT_B, dentistMemberId: MEMBER_B, scheduledAt: new Date('2026-07-02T09:00:00.000Z'), serviceType: 'cleaning', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_appointment_hold', () => registerRlsMatrix({
  db, label: 'dental_appointment_hold', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: HOLD_A, idB: HOLD_B,
  selectIds: (x) => x.select({ id: dentalAppointmentHolds.id }).from(dentalAppointmentHolds),
  insertIntoB: (x) => x.insert(dentalAppointmentHolds).values({ id: rid(), branchId: BRANCH_B, providerId: MEMBER_B, startAt: new Date('2026-07-02T09:00:00.000Z'), durationMinutes: 30, expiresAt: new Date('2026-07-02T09:10:00.000Z'), sessionToken: 'hold-chk-' + rid(), createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_queue_item', () => registerRlsMatrix({
  db, label: 'dental_queue_item', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: QUEUE_A, idB: QUEUE_B,
  selectIds: (x) => x.select({ id: dentalQueueItems.id }).from(dentalQueueItems),
  insertIntoB: (x) => x.insert(dentalQueueItems).values({ id: rid(), branchId: BRANCH_B, appointmentId: APPT_B, patientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_waitlist_entry', () => registerRlsMatrix({
  db, label: 'dental_waitlist_entry', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: WAIT_A, idB: WAIT_B,
  selectIds: (x) => x.select({ id: dentalWaitlistEntries.id }).from(dentalWaitlistEntries),
  insertIntoB: (x) => x.insert(dentalWaitlistEntries).values({ id: rid(), branchId: BRANCH_B, patientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_operatory', () => registerRlsMatrix({
  db, label: 'dental_operatory', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: OPERATORY_A, idB: OPERATORY_B,
  selectIds: (x) => x.select({ id: dentalOperatories.id }).from(dentalOperatories),
  insertIntoB: (x) => x.insert(dentalOperatories).values({ id: rid(), branchId: BRANCH_B, name: 'Operatory 2 (B)', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_household', () => registerRlsMatrix({
  db, label: 'dental_household', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: HOUSEHOLD_A, idB: HOUSEHOLD_B,
  selectIds: (x) => x.select({ id: dentalHouseholds.id }).from(dentalHouseholds),
  insertIntoB: (x) => x.insert(dentalHouseholds).values({ id: rid(), branchId: BRANCH_B, name: 'Reyes Family', guarantorPatientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_coverage_authorization', () => registerRlsMatrix({
  db, label: 'dental_coverage_authorization', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: COVERAGE_A, idB: COVERAGE_B,
  selectIds: (x) => x.select({ id: dentalCoverageAuthorizations.id }).from(dentalCoverageAuthorizations),
  insertIntoB: (x) => x.insert(dentalCoverageAuthorizations).values({ id: rid(), branchId: BRANCH_B, patientId: PATIENT_B, insuranceProfileId: PROFILE_B, status: 'requested', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('imaging_study', () => registerRlsMatrix({
  db, label: 'imaging_study', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: STUDY_A, idB: STUDY_B,
  selectIds: (x) => x.select({ id: imagingStudies.id }).from(imagingStudies),
  insertIntoB: (x) => x.insert(imagingStudies).values({ id: rid(), branchId: BRANCH_B, patientId: PATIENT_B, acquiredBy: MEMBER_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('imaging_finding', () => registerRlsMatrix({
  db, label: 'imaging_finding', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: FINDING_A, idB: FINDING_B,
  selectIds: (x) => x.select({ id: imagingFindings.id }).from(imagingFindings),
  insertIntoB: (x) => x.insert(imagingFindings).values({ id: rid(), branchId: BRANCH_B, imageId: IMAGE_B, patientId: PATIENT_B, type: 'caries', status: 'draft', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_inventory_item', () => registerRlsMatrix({
  db, label: 'dental_inventory_item', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: INVENTORY_A, idB: INVENTORY_B,
  selectIds: (x) => x.select({ id: dentalInventoryItems.id }).from(dentalInventoryItems),
  insertIntoB: (x) => x.insert(dentalInventoryItems).values({ id: rid(), branchId: BRANCH_B, name: 'Masks', category: 'consumable', unit: 'box', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_consent_template', () => registerRlsMatrix({
  db, label: 'dental_consent_template', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: CONSENT_A, idB: CONSENT_B,
  selectIds: (x) => x.select({ id: dentalConsentTemplates.id }).from(dentalConsentTemplates),
  insertIntoB: (x) => x.insert(dentalConsentTemplates).values({ id: rid(), branchId: BRANCH_B, name: 'RCT Consent', body: 'I consent.', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_treatment_template', () => registerRlsMatrix({
  db, label: 'dental_treatment_template', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: TTPL_A, idB: TTPL_B,
  selectIds: (x) => x.select({ id: dentalTreatmentTemplates.id }).from(dentalTreatmentTemplates),
  insertIntoB: (x) => x.insert(dentalTreatmentTemplates).values({ id: rid(), branchId: BRANCH_B, name: 'Crown Prep', items: [{ cdtCode: 'D2740', description: 'Crown', priceCents: 50000 }], createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_postop_template', () => registerRlsMatrix({
  db, label: 'dental_postop_template', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: POSTOP_A, idB: POSTOP_B,
  selectIds: (x) => x.select({ id: dentalPostopTemplates.id }).from(dentalPostopTemplates),
  insertIntoB: (x) => x.insert(dentalPostopTemplates).values({ id: rid(), branchId: BRANCH_B, category: 'implant', title: 'Post-Implant Care', content: 'Apply ice.', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_feature_permission', () => registerRlsMatrix({
  db, label: 'dental_feature_permission', tenantA: ORG_A, tenantB: ORG_B, idA: FEATPERM_A, idB: FEATPERM_B, scopeKind: 'org',
  selectIds: (x) => x.select({ id: dentalFeaturePermissions.id }).from(dentalFeaturePermissions),
  insertIntoB: (x) => x.insert(dentalFeaturePermissions).values({ id: rid(), organizationId: ORG_B, role: 'dentist_owner', feature: 'billing.invoice.delete', allowed: true, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_audit_log', () => registerRlsMatrix({
  db, label: 'dental_audit_log', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: AUDIT_A, idB: AUDIT_B,
  selectIds: (x) => x.select({ id: dentalAuditLog.id }).from(dentalAuditLog),
  insertIntoB: (x) => x.insert(dentalAuditLog).values({ id: rid(), tenantId: BRANCH_B, branchId: BRANCH_B, actorId: OWNER_B, action: 'update', targetType: 'dental_visit', targetId: VISIT_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));
