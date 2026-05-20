/**
 * AUDIT FIXTURE — Workspace Clinical Workflow Audit (2026-05-19)
 *
 * P0-001 means the UI cannot organically create treatments past status
 * 'diagnosed' (status is not an accepted create input; the only "Mark Done"
 * affordance issues an illegal single-step PATCH that 422s). Live Playwright
 * walks of J4/J5/J6/J10/Completion therefore need DB-direct seeded state that
 * the UI cannot produce.
 *
 * This fixture inserts that state directly (bypassing the broken create→
 * transition path), using patient-id FKs (NOT person-id — the known seed bug
 * put person ids `d0…` into patient_id columns; correct linkage is
 * dental_visit.patient_id → patient.id `d1…`).
 *
 * Idempotent: stable UUIDs + onConflictDoNothing. Safe to run repeatedly.
 *
 * NOT a production seed. Audit-only. Invoke via the co-located smoke test or
 * import { seedAuditWorkspace } into a Playwright global-setup.
 */

import { sql } from 'drizzle-orm';
import type { createDatabase } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalTreatments } from '@/handlers/dental-visit/repos/treatment.schema';
import { dentalCharts } from '@/handlers/dental-visit/repos/dental-chart.schema';
import { visitNotes } from '@/handlers/dental-visit/repos/treatment.schema';

type Db = ReturnType<typeof createDatabase>;

export const AUDIT_IDS = {
  user:    '0a000000-0000-1000-8000-0000000000d1',
  org:     'ad000000-0000-1000-8000-000000000001',
  branch:  'ad000000-0000-1000-8000-000000000002',
  member:  'ad000000-0000-1000-8000-000000000003',
  person:  'd0000000-0000-1000-8000-000000000001',
  patient: 'd1000000-0000-1000-8000-000000000001', // patient-id FK target
  visitActive:    'ad000000-0000-1000-8000-000000000010',
  visitCompleted: 'ad000000-0000-1000-8000-000000000011',
  txDiagnosed: 'ad000000-0000-1000-8000-000000000020',
  txPlanned:   'ad000000-0000-1000-8000-000000000021',
  txPerformed: 'ad000000-0000-1000-8000-000000000022',
  txVerified:  'ad000000-0000-1000-8000-000000000023',
} as const;

/**
 * Seeds the full post-`diagnosed` audit state for one known patient.
 * Returns the stable IDs so Playwright walks can navigate deterministically.
 */
export async function seedAuditWorkspace(db: Db) {
  const a = AUDIT_IDS;
  const by = { createdBy: a.user, updatedBy: a.user };

  await db.insert(dentalOrganizations).values({
    id: a.org, name: 'Audit Workspace Clinic', tier: 'clinic',
    ownerPersonId: a.user, countryCode: 'PH', ...by,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: a.branch, organizationId: a.org, name: 'Audit Branch',
    timezone: 'Asia/Manila', ...by,
  }).onConflictDoNothing();

  await db.execute(
    sql`DELETE FROM dental_membership WHERE person_id = ${a.user} AND branch_id = ${a.branch} AND id != ${a.member}`,
  );
  await db.insert(dentalMemberships).values({
    id: a.member, branchId: a.branch, personId: a.user,
    displayName: 'Audit Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, ...by,
  }).onConflictDoNothing();

  await db.insert(persons).values({
    id: a.person, firstName: 'Audit', lastName: 'Patient', ...by,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: a.patient, person: a.person, preferredBranchId: a.branch, ...by,
  }).onConflictDoNothing();

  // Completed + locked visit (J10 amend/void, Completion walk)
  await db.insert(dentalVisits).values({
    id: a.visitCompleted, patientId: a.patient, branchId: a.branch,
    dentistMemberId: a.member, status: 'completed',
    activatedAt: new Date('2026-05-01T09:00:00Z'),
    completedAt: new Date('2026-05-01T10:00:00Z'),
    chiefComplaint: 'Completed visit for audit (J10/Completion)', ...by,
  }).onConflictDoNothing();

  // Active visit carrying treatments at every status (J4/J5/J6)
  await db.insert(dentalVisits).values({
    id: a.visitActive, patientId: a.patient, branchId: a.branch,
    dentistMemberId: a.member, status: 'active',
    activatedAt: new Date('2026-05-18T09:00:00Z'),
    chiefComplaint: 'Active visit with seeded treatment statuses', ...by,
  }).onConflictDoNothing();

  // Treatments inserted directly at each status (UI cannot produce these).
  const tx = (id: string, status: string, cdt: string, desc: string, tooth: number) => ({
    id, visitId: a.visitActive, patientId: a.patient, toothNumber: tooth,
    cdtCode: cdt, description: desc, status: status as any,
    priceCents: 12000, carriedOver: false, ...by,
  });
  await db.insert(dentalTreatments).values([
    tx(a.txDiagnosed, 'diagnosed', 'D2391', 'Resin one surface — diagnosed', 14),
    tx(a.txPlanned,   'planned',   'D2392', 'Resin two surface — planned',   15),
    tx(a.txPerformed, 'performed', 'D2740', 'Crown — performed',             19),
    tx(a.txVerified,  'verified',  'D7140', 'Extraction — verified',         32),
  ]).onConflictDoNothing();

  // Chart with extracted / existing-restoration / completed-restoration teeth (J5).
  await db.insert(dentalCharts).values({
    id: 'ad000000-0000-1000-8000-000000000030',
    visitId: a.visitActive, patientId: a.patient,
    teeth: [
      { toothNumber: 32, state: 'extracted' },
      { toothNumber: 3,  state: 'filled', surfaces: ['occlusal'] },   // existing restoration
      { toothNumber: 19, state: 'crown' },                            // completed restoration
      { toothNumber: 8,  state: 'healthy' },
    ],
    ...by,
  }).onConflictDoNothing();

  // Visit note (NOTE: visit_notes has no signed/locked column — see audit finding).
  await db.insert(visitNotes).values({
    id: 'ad000000-0000-1000-8000-000000000040',
    visitId: a.visitCompleted, authorMemberId: a.member,
    subjective: 'Audit S', objective: 'Audit O',
    assessment: 'Audit A', plan: 'Audit P', ...by,
  }).onConflictDoNothing();

  return AUDIT_IDS;
}
