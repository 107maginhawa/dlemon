/**
 * erasure-service.concurrency.test.ts — approve/reject clobber race (WFG-006).
 *
 * approveErasure and rejectErasure read status='requested' BEFORE writing, and the writes
 * were unconditional UPDATE … WHERE id. Under READ COMMITTED two decisions on the same
 * 'requested' request that both passed the pre-check could interleave so the loser's write
 * lands last: a reject committing AFTER an approve leaves the subject IRREVERSIBLY anonymized
 * while the compliance record says 'rejected' (and vice-versa: an approve after a reject
 * anonymizes a refused subject). The record contradicts reality on an irreversible action.
 *
 * Fix: both claim the transition via repo.transitionFromRequested (UPDATE … WHERE
 * status='requested') and approve CLAIMS BEFORE the anonymize. The loser matches 0 rows and
 * aborts, so the anonymize runs at most once and a committed decision is never clobbered.
 *
 * Interleavings are forced deterministically: a dedicated pg connection holds the request
 * row lock with one decision committed-but-pending; the racing decision passes its pre-check
 * (reads the pre-commit 'requested') then blocks at its write until the first commits.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { createDatabase } from '@/core/database';
import { ValidationError } from '@/core/errors';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { ERASED_MARKER } from '@/handlers/person/repos/person-erasure.facade';
import { ErasureRequestRepository } from './repos/erasure-request.repo';
import { approveErasure, rejectErasure } from './erasure-service';

const URL = process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test';
const db = createDatabase({ url: URL });
const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

// Suite tag: erasurerace
const ORG = 'ea000000-0000-4000-8000-000000116001';
const BRANCH = 'ba000000-0000-4000-8000-000000116001';
const REVIEWER = 'a2000000-0000-4000-8000-000000116002';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_erasure_request, dental_legal_hold, patient, person, dental_branch, dental_organization, dental_audit_log CASCADE`);
});

async function seedRequestedErasure(): Promise<{ requestId: string; personId: string }> {
  const personId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'ErasureRace', tier: 'solo', ownerPersonId: REVIEWER, countryCode: 'PH', createdBy: REVIEWER, updatedBy: REVIEWER }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: REVIEWER, updatedBy: REVIEWER }).onConflictDoNothing();
  await db.insert(persons).values({ id: personId, firstName: 'Jane', lastName: 'Doe', contactInfo: { email: 'jane@example.com' }, createdBy: REVIEWER, updatedBy: REVIEWER });
  await db.insert(patients).values({ id: patientId, person: personId, preferredBranchId: BRANCH, emergencyContact: { name: 'Kin', phone: '+1' }, createdBy: REVIEWER, updatedBy: REVIEWER });
  const req = await new ErasureRequestRepository(db).createOne({
    subjectPersonId: personId, subjectPatientId: patientId, tenantId: ORG, branchId: BRANCH,
    reason: 'GDPR Art.17', requestedBy: REVIEWER, status: 'requested', createdBy: REVIEWER, updatedBy: REVIEWER,
  });
  return { requestId: req.id, personId };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function reqStatus(requestId: string): Promise<string> {
  const r = await db.execute(sql`SELECT status FROM dental_erasure_request WHERE id = ${requestId}`);
  return ((r as any).rows?.[0] ?? (r as any)[0]).status;
}
async function isAnonymized(personId: string): Promise<boolean> {
  const r = await db.execute(sql`SELECT first_name FROM person WHERE id = ${personId}`);
  return (((r as any).rows?.[0] ?? (r as any)[0]).first_name) === ERASED_MARKER;
}

describe('erasure approve/reject — concurrent decisions cannot clobber each other', () => {
  test('a reject racing a committed approve must not flip an anonymized record to rejected', async () => {
    const { requestId, personId } = await seedRequestedErasure();

    // Dedicated connection simulates an approve that has anonymized the subject + claimed
    // status='anonymized', committed-but-pending (holds the request row lock).
    const pool = new Pool({ connectionString: URL, max: 1 });
    const client = await pool.connect();
    let rejected = false;
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE dental_erasure_request SET status='anonymized', reviewed_at=now() WHERE id = $1`, [requestId]);
      await client.query(`UPDATE person SET first_name=$1 WHERE id = $2`, [ERASED_MARKER, personId]);

      // reject passes its pre-check (reads the pre-commit 'requested') then blocks at its write.
      const rejectP = rejectErasure(db, noopLogger, requestId, { reviewedBy: REVIEWER, rejectionReason: 'changed mind' })
        .then(() => { /* succeeded */ })
        .catch((e) => { if (e instanceof ValidationError) rejected = true; else throw e; });
      await sleep(300);
      await client.query('COMMIT'); // approve commits
      await rejectP;
    } finally {
      client.release();
      await pool.end();
    }

    expect(await isAnonymized(personId), 'subject is anonymized (the approve won)').toBe(true);
    // The record must reflect the irreversible reality: anonymized, never 'rejected'.
    expect(await reqStatus(requestId), 'an anonymized subject must not be recorded as rejected').toBe('anonymized');
    expect(rejected, 'the racing reject must be rejected, not silently applied').toBe(true);
  });

  test('an approve racing a committed reject must not anonymize a refused subject', async () => {
    const { requestId, personId } = await seedRequestedErasure();

    // Dedicated connection simulates a reject committed-but-pending (holds the request row lock).
    const pool = new Pool({ connectionString: URL, max: 1 });
    const client = await pool.connect();
    let approveRejected = false;
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE dental_erasure_request SET status='rejected', rejection_reason='no', reviewed_at=now() WHERE id = $1`, [requestId]);

      // approve passes its pre-check (reads pre-commit 'requested'); with the fix it CLAIMS
      // the transition (blocks here) BEFORE anonymizing.
      const approveP = approveErasure(db, noopLogger, requestId, { reviewedBy: REVIEWER })
        .then(() => { /* succeeded */ })
        .catch((e) => { if (e instanceof ValidationError) approveRejected = true; else throw e; });
      await sleep(300);
      await client.query('COMMIT'); // reject commits
      await approveP;
    } finally {
      client.release();
      await pool.end();
    }

    // The reject must stand: a refused subject must NEVER be anonymized.
    expect(await isAnonymized(personId), 'a rejected subject must not be anonymized').toBe(false);
    expect(await reqStatus(requestId), 'status stays rejected').toBe('rejected');
    expect(approveRejected, 'the racing approve must be rejected').toBe(true);
  });
});

describe('erasure approval vs a concurrent legal hold cannot anonymize a held subject', () => {
  test('approveErasure must block on the per-subject lock and refuse once the hold commits', async () => {
    const { requestId, personId } = await seedRequestedErasure();

    // A dedicated connection plays placeLegalHold mid-flight: it holds the
    // per-subject erasure advisory lock AND stages an active hold, all
    // uncommitted — exactly the window where approveErasure reads "no hold" and
    // would anonymize before the hold lands. Under READ COMMITTED the uncommitted
    // hold is invisible to other connections, so only the advisory lock can make
    // approve wait for the hold to commit and then observe it.
    const pool = new Pool({ connectionString: URL, max: 1 });
    const client = await pool.connect();
    let blocked = false;
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(1003, hashtext($1))`, [personId]);
      await client.query(
        `INSERT INTO dental_legal_hold
           (id, tenant_id, subject_person_id, name, reason, status, initiated_by, created_by, updated_by)
         VALUES (gen_random_uuid(), $1, $2, 'hold', 'litigation', 'active', $3, $3, $3)`,
        [ORG, personId, REVIEWER],
      );

      // With the fix approve blocks on the advisory lock; without it approve reads
      // the (invisible) hold as absent and anonymizes during the sleep.
      const approveP = approveErasure(db, noopLogger, requestId, { reviewedBy: REVIEWER }).then((r) => {
        if (r.request.legalHoldBlocked) blocked = true;
      });
      await sleep(300);
      await client.query('COMMIT'); // hold + advisory lock release together
      await approveP;
    } finally {
      client.release();
      await pool.end();
    }

    expect(
      await isAnonymized(personId),
      'a subject under a hold placed during approval must NOT be anonymized',
    ).toBe(false);
    expect(await reqStatus(requestId), 'the request must record the legal-hold block, not anonymized').toBe('rejected');
    expect(blocked, 'approve must report the legal-hold block').toBe(true);
  });
});
