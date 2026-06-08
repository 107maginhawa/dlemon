/**
 * Legal-hold store tests (V-DG-002 support): place/release + the
 * isPersonUnderLegalHold predicate the governance engines consult.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { placeLegalHold, releaseLegalHold } from './legal-hold-service';
import { isPersonUnderLegalHold } from './legal-hold.facade';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;
const TENANT = 'd4000000-0000-4000-8000-000000000001';
const PERSON = 'e4000000-0000-4000-8000-000000000001';
const OTHER = 'e4000000-0000-4000-8000-000000000002';
const ACTOR = 'a4000000-0000-4000-8000-000000000001';

describe('legal-hold store', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
  });

  afterEach(() => teardown());

  const holdInput = {
    tenantId: TENANT,
    subjectPersonId: PERSON,
    name: 'Smith v. Clinic — discovery hold',
    reason: 'litigation',
    initiatedBy: ACTOR,
  };

  test('no hold → isPersonUnderLegalHold is false', async () => {
    expect(await isPersonUnderLegalHold(db, PERSON)).toBe(false);
  });

  test('placing a hold makes the subject held; another person is unaffected', async () => {
    await placeLegalHold(db, noopLogger, holdInput);
    expect(await isPersonUnderLegalHold(db, PERSON)).toBe(true);
    expect(await isPersonUnderLegalHold(db, OTHER)).toBe(false);
  });

  test('releasing the hold clears it', async () => {
    const hold = await placeLegalHold(db, noopLogger, holdInput);
    expect(await isPersonUnderLegalHold(db, PERSON)).toBe(true);

    const released = await releaseLegalHold(db, noopLogger, hold.id, { releasedBy: ACTOR });
    expect(released.status).toBe('released');
    expect(released.releasedAt).not.toBeNull();
    expect(await isPersonUnderLegalHold(db, PERSON)).toBe(false);
  });

  test('AC-LH-004: releasing an already-released hold is rejected (illegal FSM transition)', async () => {
    const hold = await placeLegalHold(db, noopLogger, holdInput);
    await releaseLegalHold(db, noopLogger, hold.id, { releasedBy: ACTOR });

    // active → released is terminal; a second release must throw, not silently
    // re-stamp releasedBy/releasedAt or resurrect the hold.
    await expect(releaseLegalHold(db, noopLogger, hold.id, { releasedBy: ACTOR })).rejects.toThrow(
      /already released/i,
    );
    // The subject stays NOT-held (the double-release didn't corrupt state).
    expect(await isPersonUnderLegalHold(db, PERSON)).toBe(false);
  });

  test('releasing a non-existent hold → not found', async () => {
    await expect(
      releaseLegalHold(db, noopLogger, 'd4000000-0000-4000-8000-0000000000ff', { releasedBy: ACTOR }),
    ).rejects.toThrow(/not found/i);
  });
});
