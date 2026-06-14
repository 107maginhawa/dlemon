/**
 * RLS P2 — Tier-2a visit-anchored per-table isolation matrix (ADR-010 pre-GA gate).
 *
 * Tier-2a tables carry NO direct branch_id; their tenancy is derived through the
 * parent dental_visit row. Migration 0106 arms each with an EXISTS-subquery policy:
 *
 *   USING / WITH CHECK (
 *     EXISTS (SELECT 1 FROM dental_visit v
 *             WHERE v.id = <table>.visit_id
 *               AND v.branch_id = ANY (app_current_branches())))
 *
 * Because dental_visit itself is RLS-armed (P0), the subquery is also subject to
 * dental_visit's own policy under app_rls — both filters use the same branch set,
 * so they compose consistently. The superuser baseline bypasses RLS entirely (the
 * EXISTS, including app_current_branches(), is never evaluated) → both rows visible
 * → zero runtime change, identical to P1a.
 *
 * This file reuses the shared registerRlsMatrix (7 assertions) against each table:
 * a row hung off VISIT_A (branch A) and a row off VISIT_B (branch B), then assert
 * app_rls scoped to branch A sees/writes only A, [A,B] sees both, an empty/unset
 * scope sees neither, and an insert anchored to the out-of-scope visit is rejected
 * by WITH CHECK. The scope key is still the BRANCH set (resolved via the visit), so
 * scopeKind stays the default 'branch'.
 *
 * All rows are seeded as the postgres superuser (bypasses RLS), the production
 * write path today. Runs against its own cloned DB (scripts/test-with-db.ts), which
 * carries migrations 0104 + 0105 + 0106.
 */

import { describe, beforeAll } from 'bun:test';
import { createDatabase, type DatabaseInstance } from '@/core/database';
import {
  seedRlsBaseFixture,
  BRANCH_A, BRANCH_B, MEMBER_A, MEMBER_B,
  PATIENT_A, PATIENT_B, VISIT_A, VISIT_B, OWNER_A, OWNER_B,
} from '@/tests/helpers/rls-fixtures';
import { registerRlsMatrix } from '@/tests/helpers/rls-matrix';

import { dentalCharts } from '@/handlers/dental-visit/repos/dental-chart.schema';
import { dentalTreatments } from '@/handlers/dental-visit/repos/treatment.schema';
import { dentalFindings } from '@/handlers/dental-visit/repos/dental-finding.schema';
import { prescriptions } from '@/handlers/dental-clinical/repos/prescription.schema';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { consentRefusals } from '@/handlers/dental-clinical/repos/consent-refusal.schema';
import { amendments } from '@/handlers/dental-clinical/repos/amendment.schema';
import { labOrders } from '@/handlers/dental-clinical/repos/lab-order.schema';
import { dentalAttachments } from '@/handlers/dental-clinical/repos/attachment.schema';

const db: DatabaseInstance = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Distinct deterministic ids (c… prefix → no collision with the e… base fixture,
// the d… dental_visit Stage-0 test, or the f… Tier-1 test). Each test file runs
// against its own clone, so cross-file collision is impossible regardless.
const CHART_A = 'c0000001-0000-4000-8000-0000000000a0', CHART_B = 'c0000001-0000-4000-8000-0000000000b0';
const TREATMENT_A = 'c0000002-0000-4000-8000-0000000000a0', TREATMENT_B = 'c0000002-0000-4000-8000-0000000000b0';
const FINDING_A = 'c0000003-0000-4000-8000-0000000000a0', FINDING_B = 'c0000003-0000-4000-8000-0000000000b0';
const RX_A = 'c0000004-0000-4000-8000-0000000000a0', RX_B = 'c0000004-0000-4000-8000-0000000000b0';
const CONSENT_A = 'c0000005-0000-4000-8000-0000000000a0', CONSENT_B = 'c0000005-0000-4000-8000-0000000000b0';
const REFUSAL_A = 'c0000006-0000-4000-8000-0000000000a0', REFUSAL_B = 'c0000006-0000-4000-8000-0000000000b0';
const AMENDMENT_A = 'c0000007-0000-4000-8000-0000000000a0', AMENDMENT_B = 'c0000007-0000-4000-8000-0000000000b0';
const LABORDER_A = 'c0000008-0000-4000-8000-0000000000a0', LABORDER_B = 'c0000008-0000-4000-8000-0000000000b0';
const ATTACHMENT_A = 'c0000009-0000-4000-8000-0000000000a0', ATTACHMENT_B = 'c0000009-0000-4000-8000-0000000000b0';

const rid = () => crypto.randomUUID();

beforeAll(async () => {
  await seedRlsBaseFixture(db);

  await db.insert(dentalCharts).values([
    { id: CHART_A, visitId: VISIT_A, patientId: PATIENT_A, teeth: [], createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: CHART_B, visitId: VISIT_B, patientId: PATIENT_B, teeth: [], createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalTreatments).values([
    { id: TREATMENT_A, visitId: VISIT_A, patientId: PATIENT_A, cdtCode: 'D2391', description: 'Resin composite, posterior', priceCents: 18000, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: TREATMENT_B, visitId: VISIT_B, patientId: PATIENT_B, cdtCode: 'D2391', description: 'Resin composite, posterior', priceCents: 18000, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalFindings).values([
    { id: FINDING_A, visitId: VISIT_A, patientId: PATIENT_A, toothNumber: 19, conditionCode: 'caries', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: FINDING_B, visitId: VISIT_B, patientId: PATIENT_B, toothNumber: 30, conditionCode: 'caries', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(prescriptions).values([
    { id: RX_A, visitId: VISIT_A, patientId: PATIENT_A, prescriberMemberId: MEMBER_A, drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: RX_B, visitId: VISIT_B, patientId: PATIENT_B, prescriberMemberId: MEMBER_B, drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(consentForms).values([
    { id: CONSENT_A, visitId: VISIT_A, patientId: PATIENT_A, templateId: 'tpl-extraction', templateName: 'Extraction Consent', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: CONSENT_B, visitId: VISIT_B, patientId: PATIENT_B, templateId: 'tpl-extraction', templateName: 'Extraction Consent', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(consentRefusals).values([
    { id: REFUSAL_A, visitId: VISIT_A, patientId: PATIENT_A, refusingMemberId: MEMBER_A, procedureDescription: 'Root canal #19', refusalReason: 'Cost', patientAcknowledgement: 'I understand the risks.', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: REFUSAL_B, visitId: VISIT_B, patientId: PATIENT_B, refusingMemberId: MEMBER_B, procedureDescription: 'Root canal #30', refusalReason: 'Cost', patientAcknowledgement: 'I understand the risks.', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(amendments).values([
    { id: AMENDMENT_A, visitId: VISIT_A, patientId: PATIENT_A, authorMemberId: MEMBER_A, originalRecordType: 'visit_note', originalRecordId: VISIT_A, reason: 'Typo correction', content: 'Corrected tooth number.', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: AMENDMENT_B, visitId: VISIT_B, patientId: PATIENT_B, authorMemberId: MEMBER_B, originalRecordType: 'visit_note', originalRecordId: VISIT_B, reason: 'Typo correction', content: 'Corrected tooth number.', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(labOrders).values([
    { id: LABORDER_A, visitId: VISIT_A, patientId: PATIENT_A, labName: 'Premier Dental Lab', description: 'PFM crown #19', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: LABORDER_B, visitId: VISIT_B, patientId: PATIENT_B, labName: 'Premier Dental Lab', description: 'PFM crown #30', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalAttachments).values([
    { id: ATTACHMENT_A, visitId: VISIT_A, patientId: PATIENT_A, imageType: 'xray', fileName: 'pa-19.png', filePath: '/a/pa-19.png', fileSizeBytes: 20480, mimeType: 'image/png', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: ATTACHMENT_B, visitId: VISIT_B, patientId: PATIENT_B, imageType: 'xray', fileName: 'pa-30.png', filePath: '/b/pa-30.png', fileSizeBytes: 20480, mimeType: 'image/png', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
});

describe('dental_chart', () => registerRlsMatrix({
  db, label: 'dental_chart', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: CHART_A, idB: CHART_B,
  selectIds: (x) => x.select({ id: dentalCharts.id }).from(dentalCharts),
  insertIntoB: (x) => x.insert(dentalCharts).values({ id: rid(), visitId: VISIT_B, patientId: PATIENT_B, teeth: [], createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_treatment', () => registerRlsMatrix({
  db, label: 'dental_treatment', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: TREATMENT_A, idB: TREATMENT_B,
  selectIds: (x) => x.select({ id: dentalTreatments.id }).from(dentalTreatments),
  insertIntoB: (x) => x.insert(dentalTreatments).values({ id: rid(), visitId: VISIT_B, patientId: PATIENT_B, cdtCode: 'D2740', description: 'Crown', priceCents: 50000, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_finding', () => registerRlsMatrix({
  db, label: 'dental_finding', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: FINDING_A, idB: FINDING_B,
  selectIds: (x) => x.select({ id: dentalFindings.id }).from(dentalFindings),
  insertIntoB: (x) => x.insert(dentalFindings).values({ id: rid(), visitId: VISIT_B, patientId: PATIENT_B, toothNumber: 14, conditionCode: 'abscess', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('prescription', () => registerRlsMatrix({
  db, label: 'prescription', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: RX_A, idB: RX_B,
  selectIds: (x) => x.select({ id: prescriptions.id }).from(prescriptions),
  insertIntoB: (x) => x.insert(prescriptions).values({ id: rid(), visitId: VISIT_B, patientId: PATIENT_B, prescriberMemberId: MEMBER_B, drugName: 'Ibuprofen', dosage: '400mg', frequency: 'QID', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('consent_form', () => registerRlsMatrix({
  db, label: 'consent_form', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: CONSENT_A, idB: CONSENT_B,
  selectIds: (x) => x.select({ id: consentForms.id }).from(consentForms),
  insertIntoB: (x) => x.insert(consentForms).values({ id: rid(), visitId: VISIT_B, patientId: PATIENT_B, templateId: 'tpl-rct', templateName: 'RCT Consent', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('consent_refusal', () => registerRlsMatrix({
  db, label: 'consent_refusal', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: REFUSAL_A, idB: REFUSAL_B,
  selectIds: (x) => x.select({ id: consentRefusals.id }).from(consentRefusals),
  insertIntoB: (x) => x.insert(consentRefusals).values({ id: rid(), visitId: VISIT_B, patientId: PATIENT_B, refusingMemberId: MEMBER_B, procedureDescription: 'Extraction #30', refusalReason: 'Fear', patientAcknowledgement: 'Understood.', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('amendment', () => registerRlsMatrix({
  db, label: 'amendment', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: AMENDMENT_A, idB: AMENDMENT_B,
  selectIds: (x) => x.select({ id: amendments.id }).from(amendments),
  insertIntoB: (x) => x.insert(amendments).values({ id: rid(), visitId: VISIT_B, patientId: PATIENT_B, authorMemberId: MEMBER_B, originalRecordType: 'treatment', originalRecordId: VISIT_B, reason: 'Addendum', content: 'Added detail.', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('lab_order', () => registerRlsMatrix({
  db, label: 'lab_order', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: LABORDER_A, idB: LABORDER_B,
  selectIds: (x) => x.select({ id: labOrders.id }).from(labOrders),
  insertIntoB: (x) => x.insert(labOrders).values({ id: rid(), visitId: VISIT_B, patientId: PATIENT_B, labName: 'Premier Dental Lab', description: 'Night guard', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_attachment', () => registerRlsMatrix({
  db, label: 'dental_attachment', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: ATTACHMENT_A, idB: ATTACHMENT_B,
  selectIds: (x) => x.select({ id: dentalAttachments.id }).from(dentalAttachments),
  insertIntoB: (x) => x.insert(dentalAttachments).values({ id: rid(), visitId: VISIT_B, patientId: PATIENT_B, imageType: 'photo', fileName: 'intraoral.jpg', filePath: '/b/intraoral.jpg', fileSizeBytes: 40960, mimeType: 'image/jpeg', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));
