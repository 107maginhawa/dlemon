/**
 * org-scheduling.facade contract tests (V-ORG-003 / BR-SCH-004)
 *
 * dental-org owns `dental_branch.working_hours`. Previously the facade handed
 * dental-scheduling a raw, untyped JSON string with no shape contract. These
 * tests pin the validated `getWorkingHours(branchId): WorkingHours | null`
 * accessor: it parses the stored JSON and validates it against the
 * WorkingHours zod schema, returning a typed object (or null for
 * absent/malformed data) — the exact shape BR-SCH-004 enforcement consumes.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { OrganizationRepository } from './organization.repo';
import { BranchRepository } from './branch.repo';
import {
  getWorkingHours,
  WorkingHoursSchema,
  updateBranchWorkingHours,
  type WorkingHours,
} from './org-scheduling.facade';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID = 'a4000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b4000000-0000-1000-8000-000000000001';
const OWNER_ID = 'c4000000-0000-1000-8000-000000000001';

const VALID_HOURS: WorkingHours = {
  monday: { enabled: true, open: '09:00', close: '18:00' },
  tuesday: { enabled: true, open: '09:00', close: '18:00' },
  wednesday: { enabled: true, open: '09:00', close: '18:00' },
  thursday: { enabled: true, open: '09:00', close: '18:00' },
  friday: { enabled: true, open: '09:00', close: '18:00' },
  saturday: { enabled: false },
  sunday: { enabled: false },
};

async function seedBranch() {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({
    id: ORG_ID, name: 'WH Clinic', tier: 'clinic',
    ownerPersonId: OWNER_ID, countryCode: 'PH', active: true,
  });
  const branchRepo = new BranchRepository(db);
  await branchRepo.createOne({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main',
    timezone: 'Asia/Manila', active: true,
  });
}

describe('org-scheduling.facade getWorkingHours (V-ORG-003)', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`);
  });

  test('WorkingHoursSchema accepts a well-formed schedule', () => {
    const parsed = WorkingHoursSchema.safeParse(VALID_HOURS);
    expect(parsed.success).toBe(true);
  });

  test('WorkingHoursSchema rejects a malformed time string', () => {
    const bad = { ...VALID_HOURS, monday: { enabled: true, open: '25:00', close: '18:00' } };
    const parsed = WorkingHoursSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  test('returns null when working_hours is unset', async () => {
    await seedBranch();
    const result = await getWorkingHours(db, BRANCH_ID);
    expect(result).toBeNull();
  });

  test('returns a typed, validated WorkingHours object when set', async () => {
    await seedBranch();
    await updateBranchWorkingHours(db, BRANCH_ID, JSON.stringify(VALID_HOURS), OWNER_ID);

    const result = await getWorkingHours(db, BRANCH_ID);
    expect(result).not.toBeNull();
    expect(result!.monday?.enabled).toBe(true);
    expect(result!.monday?.open).toBe('09:00');
    expect(result!.saturday?.enabled).toBe(false);
  });

  test('returns null when stored JSON is malformed / fails validation', async () => {
    await seedBranch();
    // Write a structurally invalid blob directly through the update path.
    await updateBranchWorkingHours(db, BRANCH_ID, '{ not valid json', OWNER_ID);
    expect(await getWorkingHours(db, BRANCH_ID)).toBeNull();

    await updateBranchWorkingHours(
      db,
      BRANCH_ID,
      JSON.stringify({ monday: { enabled: 'yes' } }),
      OWNER_ID,
    );
    expect(await getWorkingHours(db, BRANCH_ID)).toBeNull();
  });

  test('returns null for an unknown branch', async () => {
    await seedBranch();
    const result = await getWorkingHours(db, 'b4000000-0000-1000-8000-000000000099');
    expect(result).toBeNull();
  });
});
