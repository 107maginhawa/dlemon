/**
 * person-erasure.facade tests (V-DG-002). Anonymization redacts PII in place,
 * keeps the row, and is idempotent.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { persons } from './person.schema';
import { anonymizePersonPii, isPersonErased, ERASED_MARKER } from './person-erasure.facade';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const PID = 'e0000000-0000-4000-8000-000000000001';

describe('person-erasure facade', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    await db.insert(persons).values({
      id: PID,
      firstName: 'Jane',
      lastName: 'Doe',
      middleName: 'Q',
      dateOfBirth: '1990-01-01',
      gender: 'female',
      contactInfo: { email: 'jane@example.com', phone: '+639170000000' },
      primaryAddress: { street1: '1 St', city: 'Manila', state: 'NCR', postalCode: '1000', country: 'PH' },
      consent: { registrationConsent: true, capturedAt: '2026-01-01T00:00:00Z' },
    });
  });

  afterEach(() => teardown());

  test('anonymizes every PII field but keeps the row', async () => {
    const r = await anonymizePersonPii(db, PID);
    expect(r.anonymized).toBe(true);

    const [p] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(p!.id).toBe(PID); // preserved, NOT hard-deleted
    expect(p!.firstName).toBe(ERASED_MARKER);
    expect(p!.lastName).toBeNull();
    expect(p!.middleName).toBeNull();
    expect(p!.dateOfBirth).toBeNull();
    expect(p!.gender).toBeNull();
    expect(p!.contactInfo).toBeNull();
    expect(p!.primaryAddress).toBeNull();
    expect(p!.consent).toBeNull();
  });

  test('is idempotent — a second run is a no-op', async () => {
    await anonymizePersonPii(db, PID);
    const r2 = await anonymizePersonPii(db, PID);
    expect(r2.anonymized).toBe(false);
    expect(r2.alreadyErased).toBe(true);
  });

  test('isPersonErased reflects state', async () => {
    expect(await isPersonErased(db, PID)).toBe(false);
    await anonymizePersonPii(db, PID);
    expect(await isPersonErased(db, PID)).toBe(true);
  });

  test('unknown person → no-op (not found, not erased)', async () => {
    const r = await anonymizePersonPii(db, 'e0000000-0000-4000-8000-0000000000ff');
    expect(r.anonymized).toBe(false);
    expect(r.alreadyErased).toBe(false);
  });
});
