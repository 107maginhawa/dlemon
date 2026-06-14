/**
 * RLS P3a — patient + patient-anchored per-table isolation matrix (ADR-010 gate).
 *
 * `patient` carries its tenant on the EXISTING `preferred_branch_id` column; its
 * ~13 child tables carry NO tenant column and derive tenancy through the parent
 * patient row. Migration 0107 arms `patient` with a direct policy and each child
 * with an EXISTS-subquery policy:
 *
 *   patient:        USING/WITH CHECK (preferred_branch_id = ANY (app_current_branches()))
 *   child tables:   USING/WITH CHECK (EXISTS (SELECT 1 FROM patient p
 *                     WHERE p.id = <table>.patient_id
 *                       AND p.preferred_branch_id = ANY (app_current_branches())))
 *
 * Because `patient` is itself RLS-armed, the child subquery is also subject to
 * patient's own policy under app_rls — both key off the same branch set, so they
 * compose consistently. `dental_household` + `dental_coverage_authorization`
 * already carry a direct branch_id and use the simple Tier-1 policy.
 *
 * The superuser baseline bypasses RLS entirely (both rows visible → zero runtime
 * change). This file reuses the shared registerRlsMatrix (7 assertions per table):
 * a row hung off PATIENT_A (branch A) and PATIENT_B (branch B), then assert app_rls
 * scoped to branch A sees/writes only A, [A,B] sees both, empty/unset scope sees
 * neither, and an insert anchored to the out-of-scope patient/branch is rejected by
 * WITH CHECK. Scope key is the BRANCH set (resolved via patient), so scopeKind
 * stays the default 'branch'.
 *
 * All rows seeded as the postgres superuser (bypasses RLS), the production write
 * path today. Runs against its own cloned DB (scripts/test-with-db.ts), which
 * carries migrations 0104 + 0105 + 0106 + 0107.
 */

import { describe, beforeAll } from 'bun:test';
import { createDatabase, type DatabaseInstance } from '@/core/database';
import {
  seedRlsBaseFixture,
  BRANCH_A, BRANCH_B, MEMBER_A, MEMBER_B,
  PATIENT_A, PATIENT_B, OWNER_A, OWNER_B,
} from '@/tests/helpers/rls-fixtures';
import { registerRlsMatrix } from '@/tests/helpers/rls-matrix';

import { patients } from '@/handlers/patient/repos/patient.schema';
import { medicalHistoryEntries } from '@/handlers/dental-clinical/repos/medical-history.schema';
import { medicalHistoryReviews } from '@/handlers/dental-clinical/repos/medical-history-review.schema';
import { dentalOcclusionScreenings } from '@/handlers/dental-clinical/repos/occlusion-screening.schema';
import { dentalAlerts } from '@/handlers/dental-patient/repos/dental-alert.schema';
import { dentalRecalls } from '@/handlers/dental-patient/repos/recall.schema';
import { dentalTasks } from '@/handlers/dental-patient/repos/task.schema';
import { dentalPatientContacts } from '@/handlers/dental-patient/repos/patient-contact.schema';
import { dentalInsuranceProfiles } from '@/handlers/dental-patient/repos/insurance-profile.schema';
import { dentalClaimDrafts } from '@/handlers/dental-patient/repos/claim-draft.schema';
import { dentalCasePresentations } from '@/handlers/dental-patient/repos/case-presentation.schema';
import { dentalTreatmentPlans } from '@/handlers/dental-patient/repos/treatment-plan.schema';
import { treatmentPlanVersions } from '@/handlers/dental-visit/repos/treatment-plan-version.schema';
import { dentalPatientChartBaselines } from '@/handlers/dental-visit/repos/dental-chart-baseline.schema';

const db: DatabaseInstance = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Distinct deterministic ids (c1… prefix → no collision with the e… base fixture,
// the d… Stage-0 test, the f… Tier-1 test, or the c0… Tier-2a test). Each test file
// runs against its own clone, so cross-file collision is impossible regardless.
const INSPROF_A = 'c1000001-0000-4000-8000-0000000000a0', INSPROF_B = 'c1000001-0000-4000-8000-0000000000b0';
const MEDHIST_A = 'c1000002-0000-4000-8000-0000000000a0', MEDHIST_B = 'c1000002-0000-4000-8000-0000000000b0';
const MEDREV_A = 'c1000003-0000-4000-8000-0000000000a0', MEDREV_B = 'c1000003-0000-4000-8000-0000000000b0';
const ALERT_A = 'c1000004-0000-4000-8000-0000000000a0', ALERT_B = 'c1000004-0000-4000-8000-0000000000b0';
const RECALL_A = 'c1000005-0000-4000-8000-0000000000a0', RECALL_B = 'c1000005-0000-4000-8000-0000000000b0';
const TASK_A = 'c1000006-0000-4000-8000-0000000000a0', TASK_B = 'c1000006-0000-4000-8000-0000000000b0';
const CONTACT_A = 'c1000007-0000-4000-8000-0000000000a0', CONTACT_B = 'c1000007-0000-4000-8000-0000000000b0';
const CLAIMDRAFT_A = 'c1000008-0000-4000-8000-0000000000a0', CLAIMDRAFT_B = 'c1000008-0000-4000-8000-0000000000b0';
const TPLAN_A = 'c1000009-0000-4000-8000-0000000000a0', TPLAN_B = 'c1000009-0000-4000-8000-0000000000b0';
const CASEPRES_A = 'c1000010-0000-4000-8000-0000000000a0', CASEPRES_B = 'c1000010-0000-4000-8000-0000000000b0';
const TPVERSION_A = 'c1000011-0000-4000-8000-0000000000a0', TPVERSION_B = 'c1000011-0000-4000-8000-0000000000b0';
const BASELINE_A = 'c1000012-0000-4000-8000-0000000000a0', BASELINE_B = 'c1000012-0000-4000-8000-0000000000b0';
const OCCLUSION_A = 'c1000013-0000-4000-8000-0000000000a0', OCCLUSION_B = 'c1000013-0000-4000-8000-0000000000b0';

const rid = () => crypto.randomUUID();

beforeAll(async () => {
  await seedRlsBaseFixture(db); // orgs, branches, members, persons, PATIENT_A/B (preferred_branch_id = BRANCH_A/B)

  await db.insert(dentalInsuranceProfiles).values([
    { id: INSPROF_A, patientId: PATIENT_A, insurerName: 'Acme Health', policyNumber: 'POL-A', subscriberName: 'Pat A', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: INSPROF_B, patientId: PATIENT_B, insurerName: 'Acme Health', policyNumber: 'POL-B', subscriberName: 'Pat B', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(medicalHistoryEntries).values([
    { id: MEDHIST_A, patientId: PATIENT_A, entryType: 'condition', displayName: 'Hypertension', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: MEDHIST_B, patientId: PATIENT_B, entryType: 'condition', displayName: 'Hypertension', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(medicalHistoryReviews).values([
    { id: MEDREV_A, patientId: PATIENT_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: MEDREV_B, patientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalAlerts).values([
    { id: ALERT_A, patientId: PATIENT_A, alertType: 'latex_allergy', description: 'Penicillin allergy', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: ALERT_B, patientId: PATIENT_B, alertType: 'latex_allergy', description: 'Penicillin allergy', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalRecalls).values([
    { id: RECALL_A, patientId: PATIENT_A, type: 'checkup', dueDate: '2030-01-01', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: RECALL_B, patientId: PATIENT_B, type: 'checkup', dueDate: '2030-01-01', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalTasks).values([
    { id: TASK_A, patientId: PATIENT_A, title: 'Call patient', taskType: 'follow_up', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: TASK_B, patientId: PATIENT_B, title: 'Call patient', taskType: 'follow_up', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalPatientContacts).values([
    { id: CONTACT_A, patientId: PATIENT_A, name: 'Jane Doe', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: CONTACT_B, patientId: PATIENT_B, name: 'Jane Doe', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalClaimDrafts).values([
    { id: CLAIMDRAFT_A, patientId: PATIENT_A, insuranceProfileId: INSPROF_A, cdtCode: 'D0120', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: CLAIMDRAFT_B, patientId: PATIENT_B, insuranceProfileId: INSPROF_B, cdtCode: 'D0120', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalTreatmentPlans).values([
    { id: TPLAN_A, patientId: PATIENT_A, providerId: MEMBER_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: TPLAN_B, patientId: PATIENT_B, providerId: MEMBER_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalCasePresentations).values([
    { id: CASEPRES_A, patientId: PATIENT_A, treatmentPlanId: TPLAN_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: CASEPRES_B, patientId: PATIENT_B, treatmentPlanId: TPLAN_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(treatmentPlanVersions).values([
    { id: TPVERSION_A, patientId: PATIENT_A, version: 1, snapshot: {}, createdBy: OWNER_A },
    { id: TPVERSION_B, patientId: PATIENT_B, version: 1, snapshot: {}, createdBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalPatientChartBaselines).values([
    { id: BASELINE_A, patientId: PATIENT_A, teeth: [], createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: BASELINE_B, patientId: PATIENT_B, teeth: [], createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalOcclusionScreenings).values([
    { id: OCCLUSION_A, patientId: PATIENT_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: OCCLUSION_B, patientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
});

// patient — direct policy on the existing preferred_branch_id column. idA/idB are
// the base-fixture patients (preferred_branch_id = BRANCH_A/B). insertIntoB hangs a
// new patient off the existing OWNER_B person in branch B → WITH CHECK rejects under [A].
describe('patient', () => registerRlsMatrix({
  db, label: 'patient', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: PATIENT_A, idB: PATIENT_B,
  selectIds: (x) => x.select({ id: patients.id }).from(patients),
  insertIntoB: (x) => x.insert(patients).values({ id: rid(), person: OWNER_B, preferredBranchId: BRANCH_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('medical_history_entry', () => registerRlsMatrix({
  db, label: 'medical_history_entry', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: MEDHIST_A, idB: MEDHIST_B,
  selectIds: (x) => x.select({ id: medicalHistoryEntries.id }).from(medicalHistoryEntries),
  insertIntoB: (x) => x.insert(medicalHistoryEntries).values({ id: rid(), patientId: PATIENT_B, entryType: 'allergy', displayName: 'Latex', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('medical_history_review', () => registerRlsMatrix({
  db, label: 'medical_history_review', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: MEDREV_A, idB: MEDREV_B,
  selectIds: (x) => x.select({ id: medicalHistoryReviews.id }).from(medicalHistoryReviews),
  insertIntoB: (x) => x.insert(medicalHistoryReviews).values({ id: rid(), patientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_alert', () => registerRlsMatrix({
  db, label: 'dental_alert', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: ALERT_A, idB: ALERT_B,
  selectIds: (x) => x.select({ id: dentalAlerts.id }).from(dentalAlerts),
  insertIntoB: (x) => x.insert(dentalAlerts).values({ id: rid(), patientId: PATIENT_B, alertType: 'other', description: 'Latex allergy', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_recall', () => registerRlsMatrix({
  db, label: 'dental_recall', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: RECALL_A, idB: RECALL_B,
  selectIds: (x) => x.select({ id: dentalRecalls.id }).from(dentalRecalls),
  insertIntoB: (x) => x.insert(dentalRecalls).values({ id: rid(), patientId: PATIENT_B, type: 'cleaning', dueDate: '2031-06-01', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_task', () => registerRlsMatrix({
  db, label: 'dental_task', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: TASK_A, idB: TASK_B,
  selectIds: (x) => x.select({ id: dentalTasks.id }).from(dentalTasks),
  insertIntoB: (x) => x.insert(dentalTasks).values({ id: rid(), patientId: PATIENT_B, title: 'Send reminder', taskType: 'other', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_patient_contact', () => registerRlsMatrix({
  db, label: 'dental_patient_contact', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: CONTACT_A, idB: CONTACT_B,
  selectIds: (x) => x.select({ id: dentalPatientContacts.id }).from(dentalPatientContacts),
  insertIntoB: (x) => x.insert(dentalPatientContacts).values({ id: rid(), patientId: PATIENT_B, name: 'John Roe', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_insurance_profile', () => registerRlsMatrix({
  db, label: 'dental_insurance_profile', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: INSPROF_A, idB: INSPROF_B,
  selectIds: (x) => x.select({ id: dentalInsuranceProfiles.id }).from(dentalInsuranceProfiles),
  insertIntoB: (x) => x.insert(dentalInsuranceProfiles).values({ id: rid(), patientId: PATIENT_B, insurerName: 'Beta Ins', policyNumber: 'POL-X', subscriberName: 'Pat B', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_claim_draft', () => registerRlsMatrix({
  db, label: 'dental_claim_draft', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: CLAIMDRAFT_A, idB: CLAIMDRAFT_B,
  selectIds: (x) => x.select({ id: dentalClaimDrafts.id }).from(dentalClaimDrafts),
  insertIntoB: (x) => x.insert(dentalClaimDrafts).values({ id: rid(), patientId: PATIENT_B, insuranceProfileId: INSPROF_B, cdtCode: 'D0150', createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_case_presentation', () => registerRlsMatrix({
  db, label: 'dental_case_presentation', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: CASEPRES_A, idB: CASEPRES_B,
  selectIds: (x) => x.select({ id: dentalCasePresentations.id }).from(dentalCasePresentations),
  insertIntoB: (x) => x.insert(dentalCasePresentations).values({ id: rid(), patientId: PATIENT_B, treatmentPlanId: TPLAN_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_treatment_plan', () => registerRlsMatrix({
  db, label: 'dental_treatment_plan', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: TPLAN_A, idB: TPLAN_B,
  selectIds: (x) => x.select({ id: dentalTreatmentPlans.id }).from(dentalTreatmentPlans),
  insertIntoB: (x) => x.insert(dentalTreatmentPlans).values({ id: rid(), patientId: PATIENT_B, providerId: MEMBER_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('treatment_plan_version', () => registerRlsMatrix({
  db, label: 'treatment_plan_version', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: TPVERSION_A, idB: TPVERSION_B,
  selectIds: (x) => x.select({ id: treatmentPlanVersions.id }).from(treatmentPlanVersions),
  insertIntoB: (x) => x.insert(treatmentPlanVersions).values({ id: rid(), patientId: PATIENT_B, version: 99, snapshot: {}, createdBy: OWNER_B }),
}));

describe('dental_patient_chart_baseline', () => registerRlsMatrix({
  db, label: 'dental_patient_chart_baseline', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: BASELINE_A, idB: BASELINE_B,
  selectIds: (x) => x.select({ id: dentalPatientChartBaselines.id }).from(dentalPatientChartBaselines),
  // patient B already has a baseline (unique per patient); the WITH CHECK fires before
  // the unique constraint under app_rls, so this still proves cross-tenant rejection.
  insertIntoB: (x) => x.insert(dentalPatientChartBaselines).values({ id: rid(), patientId: PATIENT_B, teeth: [], createdBy: OWNER_B, updatedBy: OWNER_B }),
}));

describe('dental_occlusion_screening', () => registerRlsMatrix({
  db, label: 'dental_occlusion_screening', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: OCCLUSION_A, idB: OCCLUSION_B,
  selectIds: (x) => x.select({ id: dentalOcclusionScreenings.id }).from(dentalOcclusionScreenings),
  insertIntoB: (x) => x.insert(dentalOcclusionScreenings).values({ id: rid(), patientId: PATIENT_B, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));
