/**
 * PatientRepository dental extension tests
 *
 * Tests dental-specific queries: search by branch, needs-follow-up filter,
 * archive with active payment plan blocked (EC1), dental field persistence.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { PatientRepository } from './patient.repo';
import { createDatabase } from '@/core/database';
import { persons } from '../../person/repos/person.schema';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const BRANCH_A = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_B = 'a0000000-0000-1000-8000-000000000002';

async function createTestPerson(idx: number) {
  const [person] = await db
    .insert(persons)
    .values({
      firstName: `TestFirst${idx}`,
      lastName: `TestLast${idx}`,
      dateOfBirth: '1990-01-01',
      gender: 'other',
    })
    .returning();
  return person!;
}

describe('PatientRepository — dental extensions', () => {
  let repo: PatientRepository;

  beforeEach(() => {
    repo = new PatientRepository(db);
  });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE patient CASCADE`);
    await db.execute(sql`TRUNCATE TABLE person CASCADE`);
  });

  // --------------------------------------------------------------------------
  // Dental fields persistence
  // --------------------------------------------------------------------------

  describe('dental field storage', () => {
    test('stores preferredBranchId on create', async () => {
      const person = await createTestPerson(1);
      const patient = await repo.createOne({
        person: person.id,
        preferredBranchId: BRANCH_A,
      });
      expect(patient.preferredBranchId).toBe(BRANCH_A);
    });

    test('stores dentalHistorySummary on create', async () => {
      const person = await createTestPerson(2);
      const patient = await repo.createOne({
        person: person.id,
        dentalHistorySummary: 'Mild gingivitis, routine scaling done annually.',
      });
      expect(patient.dentalHistorySummary).toBe(
        'Mild gingivitis, routine scaling done annually.'
      );
    });

    test('needsFollowUp defaults to false', async () => {
      const person = await createTestPerson(3);
      const patient = await repo.createOne({ person: person.id });
      expect(patient.needsFollowUp).toBe(false);
    });

    test('hasActivePaymentPlan defaults to false', async () => {
      const person = await createTestPerson(4);
      const patient = await repo.createOne({ person: person.id });
      expect(patient.hasActivePaymentPlan).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Branch filter
  // --------------------------------------------------------------------------

  describe('filterByBranch', () => {
    test('returns only patients belonging to the given branch', async () => {
      const pA = await createTestPerson(10);
      const pB = await createTestPerson(11);
      const pC = await createTestPerson(12);

      await repo.createOne({ person: pA.id, preferredBranchId: BRANCH_A });
      await repo.createOne({ person: pB.id, preferredBranchId: BRANCH_A });
      await repo.createOne({ person: pC.id, preferredBranchId: BRANCH_B });

      const results = await repo.findManyWithPerson({ branchId: BRANCH_A });
      expect(results.length).toBe(2);
      results.forEach(r => expect(r.preferredBranchId).toBe(BRANCH_A));
    });

    test('returns all patients when no branchId filter provided', async () => {
      const p1 = await createTestPerson(20);
      const p2 = await createTestPerson(21);
      await repo.createOne({ person: p1.id, preferredBranchId: BRANCH_A });
      await repo.createOne({ person: p2.id, preferredBranchId: BRANCH_B });

      const results = await repo.findManyWithPerson();
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    test('returns empty array when no patients in branch', async () => {
      const results = await repo.findManyWithPerson({ branchId: BRANCH_A });
      expect(results.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Needs-follow-up filter
  // --------------------------------------------------------------------------

  describe('needsFollowUp filter', () => {
    test('returns only patients flagged for follow-up', async () => {
      const p1 = await createTestPerson(30);
      const p2 = await createTestPerson(31);
      const p3 = await createTestPerson(32);

      const pat1 = await repo.createOne({ person: p1.id });
      const pat2 = await repo.createOne({ person: p2.id });
      await repo.createOne({ person: p3.id });

      // Flag two patients as needing follow-up
      await repo.updateOneById(pat1.id, { needsFollowUp: true });
      await repo.updateOneById(pat2.id, { needsFollowUp: true });

      const results = await repo.findManyWithPerson({ needsFollowUp: true });
      expect(results.length).toBe(2);
      results.forEach(r => expect(r.needsFollowUp).toBe(true));
    });

    test('returns only patients NOT needing follow-up when needsFollowUp=false', async () => {
      const p1 = await createTestPerson(40);
      const p2 = await createTestPerson(41);
      const pat1 = await repo.createOne({ person: p1.id });
      await repo.createOne({ person: p2.id });
      await repo.updateOneById(pat1.id, { needsFollowUp: true });

      const results = await repo.findManyWithPerson({ needsFollowUp: false });
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach(r => expect(r.needsFollowUp).not.toBe(true));
    });
  });

  // --------------------------------------------------------------------------
  // Archive with payment plan guard (EC1)
  // --------------------------------------------------------------------------

  describe('archivePatient (EC1)', () => {
    test('archives a patient with no active payment plan', async () => {
      const person = await createTestPerson(50);
      const patient = await repo.createOne({ person: person.id });

      const result = await repo.archivePatient(patient.id);
      expect(result.success).toBe(true);

      const updated = await repo.findOneById(patient.id);
      expect(updated?.needsFollowUp).toBe(false);
    });

    test('blocks archive when patient has an active payment plan (EC1)', async () => {
      const person = await createTestPerson(51);
      const patient = await repo.createOne({
        person: person.id,
        hasActivePaymentPlan: true,
      });

      const result = await repo.archivePatient(patient.id);
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/payment plan/i);
    });

    test('returns not-found for unknown patient', async () => {
      const result = await repo.archivePatient(
        'f0000000-0000-1000-8000-000000000099'
      );
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/not found/i);
    });
  });

  // --------------------------------------------------------------------------
  // Combined filters
  // --------------------------------------------------------------------------

  describe('combined filters', () => {
    test('branchId + needsFollowUp combined filter', async () => {
      const p1 = await createTestPerson(60);
      const p2 = await createTestPerson(61);
      const p3 = await createTestPerson(62);

      const pat1 = await repo.createOne({ person: p1.id, preferredBranchId: BRANCH_A });
      const pat2 = await repo.createOne({ person: p2.id, preferredBranchId: BRANCH_A });
      await repo.createOne({ person: p3.id, preferredBranchId: BRANCH_B });

      await repo.updateOneById(pat1.id, { needsFollowUp: true });
      await repo.updateOneById(pat2.id, { needsFollowUp: false });

      const results = await repo.findManyWithPerson({
        branchId: BRANCH_A,
        needsFollowUp: true,
      });
      expect(results.length).toBe(1);
      expect(results[0]!.preferredBranchId).toBe(BRANCH_A);
      expect(results[0]!.needsFollowUp).toBe(true);
    });
  });
});
