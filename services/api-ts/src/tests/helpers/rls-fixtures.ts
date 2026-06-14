/**
 * Shared two-tenant fixture for RLS isolation tests (ADR-010 P1a+).
 *
 * Seeds two fully independent tenants — organization A and organization B, each
 * with one branch, one owner membership, one person+patient, and one visit — so
 * any Tier-1 table test can hang a branch-A row and a branch-B row off them and
 * assert cross-tenant isolation. Everything is seeded as the postgres superuser
 * (which bypasses RLS), exactly the production write path today.
 *
 * Each test file runs against its own cloned database (scripts/test-with-db.ts),
 * so the fixture owns the clone; the inserts are still idempotent
 * (onConflictDoNothing) to be safe under any future shared-clone batching.
 *
 * UUIDs use an `e…` prefix to stay distinct from the dental_visit Stage-0 test's
 * `d…` ids, so the two can never collide.
 */

import type { DatabaseInstance } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

export const OWNER_A = 'e0000000-0000-4000-8000-0000000000a1';
export const OWNER_B = 'e0000000-0000-4000-8000-0000000000b1';
export const ORG_A = 'e1000000-0000-4000-8000-0000000000a0';
export const ORG_B = 'e1000000-0000-4000-8000-0000000000b0';
export const BRANCH_A = 'e2000000-0000-4000-8000-0000000000a0';
export const BRANCH_B = 'e2000000-0000-4000-8000-0000000000b0';
export const MEMBER_A = 'e3000000-0000-4000-8000-0000000000a1';
export const MEMBER_B = 'e3000000-0000-4000-8000-0000000000b1';
export const PERSON_PA = 'e5000000-0000-4000-8000-0000000000a0';
export const PERSON_PB = 'e5000000-0000-4000-8000-0000000000b0';
export const PATIENT_A = 'e4000000-0000-4000-8000-0000000000a0';
export const PATIENT_B = 'e4000000-0000-4000-8000-0000000000b0';
export const VISIT_A = 'e6000000-0000-4000-8000-0000000000a0';
export const VISIT_B = 'e6000000-0000-4000-8000-0000000000b0';

/**
 * Idempotently seed the two-tenant base fixture. Safe to call in any RLS test's
 * beforeAll. Returns nothing — import the exported id constants.
 */
export async function seedRlsBaseFixture(db: DatabaseInstance): Promise<void> {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  const { dentalVisits } = await import('@/handlers/dental-visit/repos/visit.schema');

  await db.insert(persons).values([
    { id: OWNER_A, firstName: 'Owner', lastName: 'A', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: OWNER_B, firstName: 'Owner', lastName: 'B', createdBy: OWNER_B, updatedBy: OWNER_B },
    { id: PERSON_PA, firstName: 'Pat', lastName: 'A', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: PERSON_PB, firstName: 'Pat', lastName: 'B', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalOrganizations).values([
    { id: ORG_A, name: 'RLS Org A', tier: 'solo', ownerPersonId: OWNER_A, countryCode: 'PH', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: ORG_B, name: 'RLS Org B', tier: 'solo', ownerPersonId: OWNER_B, countryCode: 'PH', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalBranches).values([
    { id: BRANCH_A, organizationId: ORG_A, name: 'A Main', timezone: 'Asia/Manila', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: BRANCH_B, organizationId: ORG_B, name: 'B Main', timezone: 'Asia/Manila', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalMemberships).values([
    { id: MEMBER_A, branchId: BRANCH_A, personId: OWNER_A, displayName: 'Owner A', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: MEMBER_B, branchId: BRANCH_B, personId: OWNER_B, displayName: 'Owner B', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(patients).values([
    { id: PATIENT_A, person: PERSON_PA, preferredBranchId: BRANCH_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: PATIENT_B, person: PERSON_PB, preferredBranchId: BRANCH_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalVisits).values([
    { id: VISIT_A, patientId: PATIENT_A, branchId: BRANCH_A, dentistMemberId: MEMBER_A, status: 'draft', createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: VISIT_B, patientId: PATIENT_B, branchId: BRANCH_B, dentistMemberId: MEMBER_B, status: 'draft', createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
}
