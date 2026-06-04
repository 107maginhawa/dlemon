/**
 * Integration: the real legal-hold STORE blocks erasure approval (V-DG-002 + B1).
 * place hold → approve is blocked (subject kept) → release → approve anonymizes.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { persons } from '../person/repos/person.schema';
import { ERASED_MARKER } from '../person/repos/person-erasure.facade';
import { requestErasure, approveErasure } from './erasure-service';
import { placeLegalHold, releaseLegalHold } from '../dental-legalhold/legal-hold-service';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;
const PID = 'e5000000-0000-4000-8000-000000000001';
const TENANT = 'd5000000-0000-4000-8000-000000000001';
const ACTOR = 'a5000000-0000-4000-8000-000000000001';

describe('erasure respects the legal-hold store', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    await db.insert(persons).values({ id: PID, firstName: 'Jane', lastName: 'Doe' });
  });

  afterEach(() => teardown());

  test('an active hold blocks approval; releasing it allows erasure', async () => {
    const req = await requestErasure(db, noopLogger, {
      subjectPersonId: PID,
      tenantId: TENANT,
      reason: 'Art.17 request',
      requestedBy: ACTOR,
    });

    // Place a hold — approval (no reviewer flag) must be blocked by the STORE.
    const hold = await placeLegalHold(db, noopLogger, {
      tenantId: TENANT,
      subjectPersonId: PID,
      name: 'hold',
      reason: 'litigation',
      initiatedBy: ACTOR,
    });

    const { request: blocked } = await approveErasure(db, noopLogger, req.id, { reviewedBy: ACTOR });
    expect(blocked.status).toBe('rejected');
    expect(blocked.legalHoldBlocked).toBe(true);
    const [held] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(held!.firstName).toBe('Jane'); // not erased

    // Release the hold, file a fresh request, approve → now anonymizes.
    await releaseLegalHold(db, noopLogger, hold.id, { releasedBy: ACTOR });
    const req2 = await requestErasure(db, noopLogger, {
      subjectPersonId: PID,
      tenantId: TENANT,
      reason: 'Art.17 retry',
      requestedBy: ACTOR,
    });
    const { request: approved } = await approveErasure(db, noopLogger, req2.id, { reviewedBy: ACTOR });
    expect(approved.status).toBe('anonymized');
    const [erased] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(erased!.firstName).toBe(ERASED_MARKER);
  });
});
