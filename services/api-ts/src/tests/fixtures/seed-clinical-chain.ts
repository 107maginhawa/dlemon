/**
 * Shared FK-parent seeding fixture for dental repo tests.
 *
 * All repo tests run inside openTestTx() (BEGIN/ROLLBACK), so FK parents must
 * be seeded within the same transaction. This helper seeds the full dental
 * clinical chain: Org → Branch(1-2) → Membership(0-2) ; Person → Patient(1-3) ;
 * Visit(0-2) → Patient_1 + Branch_1 + Membership_1.
 *
 * Pattern follows audit-workspace-fixtures.ts: direct db.insert + onConflictDoNothing.
 *
 * Layout:
 *   MEMBERSHIP_1 on BRANCH_1 (personId = OWNER_PERSON, dentist_owner)
 *   MEMBERSHIP_2 on BRANCH_2 (personId = null, dentist_owner)
 *   VISIT_1 + VISIT_2 both → PATIENT_1, BRANCH_1, MEMBERSHIP_1
 *
 * Usage:
 *   const ids = await seedClinicalChain(db);               // default: 2 branches, 2 patients, 2 memberships, 1 visit
 *   const ids = await seedClinicalChain(db, { visits: 2 }); // also seeds VISIT_2
 *   const ids = await seedClinicalChain(db, { branches: 1, memberships: 0, visits: 0 }); // patient-only
 */

import { type createDatabase } from '@/core/database';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

type Db = ReturnType<typeof createDatabase>;

export const CHAIN_IDS = {
  ORG:          'c1000000-0000-4000-8000-000000000001',
  OWNER_PERSON: 'c1000000-0000-4000-8000-00000000000a', // not a persons row — only used as ownerPersonId (no FK)
  BRANCH_1:     'c1000000-0000-4000-8000-000000000002',
  BRANCH_2:     'c1000000-0000-4000-8000-000000000003',
  MEMBERSHIP_1: 'c1000000-0000-4000-8000-000000000004', // dentist_owner on BRANCH_1
  MEMBERSHIP_2: 'c1000000-0000-4000-8000-000000000005', // dentist_owner on BRANCH_2 (personId null)
  PERSON_1:     'c1000000-0000-4000-8000-000000000006',
  PERSON_2:     'c1000000-0000-4000-8000-000000000007',
  PERSON_3:     'c1000000-0000-4000-8000-000000000008',
  PATIENT_1:    'c1000000-0000-4000-8000-000000000009',
  PATIENT_2:    'c1000000-0000-4000-8000-00000000000b',
  PATIENT_3:    'c1000000-0000-4000-8000-00000000000c',
  VISIT_1:      'c1000000-0000-4000-8000-00000000000d', // → PATIENT_1, BRANCH_1, MEMBERSHIP_1
  VISIT_2:      'c1000000-0000-4000-8000-00000000000e', // → PATIENT_1, BRANCH_1, MEMBERSHIP_1
} as const;

export interface SeedOpts {
  /** Number of branches to seed (default 2) */
  branches?: 1 | 2;
  /** Number of patient+person pairs to seed (default 2; use 3 for pmd-document tests) */
  patients?: 1 | 2 | 3;
  /** Number of memberships to seed (default 2; use 0 for patient-only tests) */
  memberships?: 0 | 1 | 2;
  /** Number of visits to seed (default 1; use 2 for treatment/prescription/lab/pmd tests) */
  visits?: 0 | 1 | 2;
}

export async function seedClinicalChain(db: Db, opts: SeedOpts = {}): Promise<typeof CHAIN_IDS> {
  const numBranches = opts.branches ?? 2;
  const numPatients = opts.patients ?? 2;
  const numMemberships = opts.memberships ?? 2;
  const numVisits = opts.visits ?? 1;

  // 1. Organization (ownerPersonId has no FK constraint — OWNER_PERSON need not exist in persons)
  await db.insert(dentalOrganizations).values({
    id: CHAIN_IDS.ORG,
    name: 'Clinical Chain Test Org',
    tier: 'clinic',
    ownerPersonId: CHAIN_IDS.OWNER_PERSON,
    countryCode: 'PH',
  }).onConflictDoNothing();

  // 2. Branches → org
  await db.insert(dentalBranches).values({
    id: CHAIN_IDS.BRANCH_1,
    organizationId: CHAIN_IDS.ORG,
    name: 'Branch One',
    timezone: 'Asia/Manila',
  }).onConflictDoNothing();

  if (numBranches >= 2) {
    await db.insert(dentalBranches).values({
      id: CHAIN_IDS.BRANCH_2,
      organizationId: CHAIN_IDS.ORG,
      name: 'Branch Two',
      timezone: 'Asia/Manila',
    }).onConflictDoNothing();
  }

  // 3. Memberships
  // MEMBERSHIP_1: personId = OWNER_PERSON (no FK, so any UUID is safe; mirrors audit-workspace-fixtures)
  // MEMBERSHIP_2: personId = null to avoid (personId, branchId) unique collision when branches:1
  if (numMemberships >= 1) {
    await db.insert(dentalMemberships).values({
      id: CHAIN_IDS.MEMBERSHIP_1,
      branchId: CHAIN_IDS.BRANCH_1,
      personId: CHAIN_IDS.OWNER_PERSON,
      displayName: 'Dr. One',
      role: 'dentist_owner',
      status: 'active',
      pinFailedAttempts: 0,
    }).onConflictDoNothing();
  }

  if (numMemberships >= 2) {
    await db.insert(dentalMemberships).values({
      id: CHAIN_IDS.MEMBERSHIP_2,
      branchId: numBranches >= 2 ? CHAIN_IDS.BRANCH_2 : CHAIN_IDS.BRANCH_1,
      personId: null,
      displayName: 'Dr. Two',
      role: 'dentist_owner',
      status: 'active',
      pinFailedAttempts: 0,
    }).onConflictDoNothing();
  }

  // 4. Persons → Patients
  const personRows = [
    { id: CHAIN_IDS.PERSON_1, firstName: 'Patient', lastName: 'One' },
    ...(numPatients >= 2 ? [{ id: CHAIN_IDS.PERSON_2, firstName: 'Patient', lastName: 'Two' }] : []),
    ...(numPatients >= 3 ? [{ id: CHAIN_IDS.PERSON_3, firstName: 'Patient', lastName: 'Three' }] : []),
  ];
  await db.insert(persons).values(personRows).onConflictDoNothing();

  const patientRows = [
    { id: CHAIN_IDS.PATIENT_1, person: CHAIN_IDS.PERSON_1 },
    ...(numPatients >= 2 ? [{ id: CHAIN_IDS.PATIENT_2, person: CHAIN_IDS.PERSON_2 }] : []),
    ...(numPatients >= 3 ? [{ id: CHAIN_IDS.PATIENT_3, person: CHAIN_IDS.PERSON_3 }] : []),
  ];
  await db.insert(patients).values(patientRows).onConflictDoNothing();

  // 5. Visits → PATIENT_1, BRANCH_1, MEMBERSHIP_1
  if (numVisits >= 1) {
    await db.insert(dentalVisits).values({
      id: CHAIN_IDS.VISIT_1,
      patientId: CHAIN_IDS.PATIENT_1,
      branchId: CHAIN_IDS.BRANCH_1,
      dentistMemberId: CHAIN_IDS.MEMBERSHIP_1,
    }).onConflictDoNothing();
  }

  if (numVisits >= 2) {
    await db.insert(dentalVisits).values({
      id: CHAIN_IDS.VISIT_2,
      patientId: CHAIN_IDS.PATIENT_1,
      branchId: CHAIN_IDS.BRANCH_1,
      dentistMemberId: CHAIN_IDS.MEMBERSHIP_1,
    }).onConflictDoNothing();
  }

  return CHAIN_IDS;
}
