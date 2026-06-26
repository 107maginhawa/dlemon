/**
 * treatment.lifecycle.characterization.test.ts
 *
 * Pins the REAL treatment carry-over / perform row mechanics so the as-of layer
 * derivation (deriveLayerSetsAsOf, Slice 1 Task 2) is built on observed facts, not
 * guesses. These three facts are the contract the cumulative timeline relies on:
 *
 *   FACT 1 (visitId stability): performing a treatment is an in-place row update
 *     (status='performed' + performedAt=now). It NEVER re-points visitId. A row's
 *     visitId is the visit it was recorded in (or carried into), permanently.
 *
 *   FACT 2 (performedAt): the perform mutation sets performedAt to the perform
 *     timestamp. This is the only exact lifecycle timestamp; Planned/Declined have
 *     no dedicated transition column, so as-of derivation approximates those via the
 *     owning visit's date (sound: a treatment can only be planned/declined on its
 *     own non-locked visit).
 *
 *   FACT 3 (carry-over): carrying work forward creates a NEW row in the target visit
 *     with visitId=target, sourceVisitId=origin, carriedOver=true, status='planned'.
 *     The origin row is untouched. So per-visit findByVisit returns the carried row
 *     under the TARGET visit only — which is exactly why a per-visit (findByVisit)
 *     carousel loses cross-visit continuity (the headline bug this feature fixes).
 *
 * The perform mutation here uses repo.update({status:'performed', performedAt}) — the
 * exact row mutation updateDentalTreatment.ts applies (the HTTP path adds consent
 * gating + audit around it, but the persisted row change is identical).
 */
import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { VisitRepository } from './visit.repo';
import { TreatmentRepository } from './treatment.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test' });

const OWNER = { id: '00000000-0000-0000-0000-0000c8b5c001', email: 'lifecycle@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-0000c8b5c001';
const PERSON_ID = 'e0000000-0000-1000-8000-0000c8b5c001';
const BRANCH_ID = 'b0000000-0000-1000-8000-0000c8b5c001';
const ORG_ID = 'd0000000-0000-1000-8000-0000c8b5c001';
const MEMBER_ID = 'c0000000-0000-1000-8000-0000c8b5c001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Lifecycle Clinic', tier: 'clinic', ownerPersonId: OWNER.id,
    countryCode: 'PH', createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Lifecycle Branch',
    timezone: 'Asia/Manila', createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: MEMBER_ID, branchId: BRANCH_ID, personId: OWNER.id, displayName: 'Dr Lifecycle',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0,
    createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Lifecycle', lastName: 'Patient',
    createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID,
    createdBy: OWNER.id, updatedBy: OWNER.id,
  }).onConflictDoNothing();
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_visit CASCADE`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_membership WHERE branch_id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_patient WHERE id = ${PATIENT_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM person WHERE id = ${PERSON_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_branch WHERE id = ${BRANCH_ID}`).catch(() => {});
  await db.execute(sql`DELETE FROM dental_organization WHERE id = ${ORG_ID}`).catch(() => {});
});

describe('treatment lifecycle characterization', () => {
  test('FACT 1+2: performing a treatment keeps its visitId and sets performedAt + status=performed', async () => {
    const visitRepo = new VisitRepository(db);
    const treatRepo = new TreatmentRepository(db);
    const v1 = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed' });

    const t = await treatRepo.createOne({
      visitId: v1.id, patientId: PATIENT_ID, toothNumber: 36,
      cdtCode: 'D2392', description: 'Composite filling', status: 'planned',
      priceCents: 1200, createdBy: OWNER.id, updatedBy: OWNER.id,
    });

    // Real perform mutation (mirrors updateDentalTreatment.ts patch).
    const performedAt = new Date('2026-03-05T09:00:00Z');
    await treatRepo.update(t.id, { status: 'performed', performedAt });

    const after = await treatRepo.findOneById(t.id);
    expect(after?.status).toBe('performed');
    expect(after?.performedAt).not.toBeNull();        // FACT 2: performedAt set on perform
    expect(after?.visitId).toBe(v1.id);               // FACT 1: visitId unchanged by perform
    expect(after?.sourceVisitId).toBeNull();          // not a carry-over
    expect(after?.carriedOver).toBe(false);
  });

  test('FACT 3: carry-over creates a new row under the TARGET visit referencing the origin', async () => {
    const visitRepo = new VisitRepository(db);
    const treatRepo = new TreatmentRepository(db);
    const v1 = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'completed' });
    const v2 = await visitRepo.createOne({ patientId: PATIENT_ID, branchId: BRANCH_ID, dentistMemberId: MEMBER_ID, status: 'active' });

    // Origin diagnosis in V1.
    const origin = await treatRepo.createOne({
      visitId: v1.id, patientId: PATIENT_ID, toothNumber: 16,
      cdtCode: 'D2750', description: 'Crown', status: 'planned',
      priceCents: 60000, createdBy: OWNER.id, updatedBy: OWNER.id,
    });

    // Carry it forward into V2 (real repo path).
    const carried = await treatRepo.createCarryOver({
      sourceVisitId: v1.id, targetVisitId: v2.id, patientId: PATIENT_ID,
      cdtCode: 'D2750', description: 'Crown', toothNumber: 16, priceCents: 60000,
    });

    expect(carried.visitId).toBe(v2.id);              // FACT 3: lives under the target visit
    expect(carried.sourceVisitId).toBe(v1.id);        // references the origin
    expect(carried.carriedOver).toBe(true);
    expect(carried.status).toBe('planned');

    // Per-visit findByVisit splits the story across rows: origin under V1, carried under V2.
    const byV1 = await treatRepo.findByVisit(v1.id);
    const byV2 = await treatRepo.findByVisit(v2.id);
    expect(byV1.map((r) => r.id)).toContain(origin.id);
    expect(byV1.map((r) => r.id)).not.toContain(carried.id);
    expect(byV2.map((r) => r.id)).toContain(carried.id);
    expect(byV2.map((r) => r.id)).not.toContain(origin.id);
  });
});
