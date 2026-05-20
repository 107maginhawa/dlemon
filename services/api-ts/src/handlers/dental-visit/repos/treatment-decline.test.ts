/**
 * TreatmentRepository — informed refusal (P1.4) tests
 *
 * Covers decline() method: sets status='declined', stores refusalReason,
 * and is distinct from dismiss().
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { TreatmentRepository } from './treatment.repo';
import { openTestTx } from '@/core/test-tx';
import { createDatabase } from '@/core/database';
import { seedAuditWorkspace, AUDIT_IDS } from '@/tests/fixtures/audit-workspace-fixtures';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

beforeAll(async () => {
  await seedAuditWorkspace(db);
});

describe('TreatmentRepository — informed refusal (P1.4)', () => {
  let repo: TreatmentRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    repo = new TreatmentRepository(txDb);
    teardown = rollback;
  });

  afterEach(() => teardown());

  test('decline() sets status to declined and stores refusalReason', async () => {
    const declined = await repo.decline(AUDIT_IDS.txDiagnosed, 'Patient cannot afford treatment at this time');
    expect(declined!.status).toBe('declined');
    expect(declined!.refusalReason).toBe('Patient cannot afford treatment at this time');
    expect(declined!.dismissReason).toBeNull();
  });

  test('decline() is distinct from dismiss() — does not set dismissReason', async () => {
    const declined = await repo.decline(AUDIT_IDS.txPlanned, 'Prefers alternative approach');
    expect(declined!.status).toBe('declined');
    expect(declined!.refusalReason).toBe('Prefers alternative approach');
    expect(declined!.dismissReason).toBeNull();
  });

  test('declined status is independent read-back from DB', async () => {
    await repo.decline(AUDIT_IDS.txDiagnosed, 'Insurance does not cover this procedure');
    const readback = await repo.findOneById(AUDIT_IDS.txDiagnosed);
    expect(readback!.status).toBe('declined');
    expect(readback!.refusalReason).toBe('Insurance does not cover this procedure');
  });

  test('TREATMENT_TRANSITIONS allows diagnosed → declined', () => {
    const { TREATMENT_TRANSITIONS } = require('./treatment.schema');
    expect(TREATMENT_TRANSITIONS['diagnosed']).toContain('declined');
  });

  test('TREATMENT_TRANSITIONS allows planned → declined', () => {
    const { TREATMENT_TRANSITIONS } = require('./treatment.schema');
    expect(TREATMENT_TRANSITIONS['planned']).toContain('declined');
  });

  test('TREATMENT_TRANSITIONS: declined is terminal (no further transitions)', () => {
    const { TREATMENT_TRANSITIONS } = require('./treatment.schema');
    expect(TREATMENT_TRANSITIONS['declined']).toEqual([]);
  });
});
