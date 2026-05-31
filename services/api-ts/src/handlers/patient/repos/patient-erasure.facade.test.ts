/**
 * patient-erasure.facade tests (V-DG-002). Nulls patient PII for a person;
 * keeps the clinical row. Idempotent.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { persons } from '../../person/repos/person.schema';
import { patients } from './patient.schema';
import { anonymizePatientPiiByPerson } from './patient-erasure.facade';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const PID = 'e1000000-0000-4000-8000-000000000001';

describe('patient-erasure facade', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    await db.insert(persons).values({ id: PID, firstName: 'Jane' });
    await db.insert(patients).values({
      person: PID,
      emergencyContact: { name: 'Kin', phone: '+639170000000', email: 'kin@example.com' },
      primaryProvider: { name: 'Dr Who' },
      primaryPharmacy: { name: 'Pharma' } as any,
      dentalHistorySummary: 'sensitive clinical narrative',
      communicationPreferences: { recallEnabled: true } as any,
    });
  });

  afterEach(() => teardown());

  test('nulls patient PII fields but keeps the clinical row', async () => {
    const n = await anonymizePatientPiiByPerson(db, PID);
    expect(n).toBe(1);

    const [pt] = await db.select().from(patients).where(eq(patients.person, PID));
    expect(pt!.id).toBeTruthy(); // row preserved
    expect(pt!.emergencyContact).toBeNull();
    expect(pt!.primaryProvider).toBeNull();
    expect(pt!.primaryPharmacy).toBeNull();
    expect(pt!.dentalHistorySummary).toBeNull();
    expect(pt!.communicationPreferences).toBeNull();
  });

  test('is idempotent and returns 0 for a person with no patient', async () => {
    await anonymizePatientPiiByPerson(db, PID);
    const again = await anonymizePatientPiiByPerson(db, PID); // already nulled — still matches the row
    expect(again).toBe(1);

    const none = await anonymizePatientPiiByPerson(db, 'e1000000-0000-4000-8000-0000000000ff');
    expect(none).toBe(0);
  });
});
