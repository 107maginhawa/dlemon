/**
 * Default retention-policy seeding tests (DB-backed). Verifies the conservative
 * defaults are inserted, idempotently, and that audit is seeded as never-purge.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { seedDefaultRetentionPolicies, DEFAULT_RETENTION_DISCLAIMER } from './retention-defaults';
import { RetentionPolicyRepository } from './repos/retention-policy.repo';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const TENANT = 'a0000000-0000-4000-8000-0000000000aa';

describe('seedDefaultRetentionPolicies', () => {
  let db: NodePgDatabase;
  let repo: RetentionPolicyRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new RetentionPolicyRepository(db);
    teardown = rollback;
  });

  afterEach(() => teardown());

  test('inserts the default policy set for a tenant', async () => {
    const inserted = await seedDefaultRetentionPolicies(db, TENANT);
    expect(inserted).toBeGreaterThanOrEqual(5);

    const policies = await repo.findEnabled(TENANT);
    const byType = Object.fromEntries(policies.map((p) => [p.entityType, p]));

    expect(byType['clinical']!.retentionPeriodDays).toBe(3650); // ~10y
    expect(byType['prescription']!.retentionPeriodDays).toBe(1825); // ~5y
    expect(byType['attachment']!.action).toBe('archive');
  });

  test('audit is seeded as retain (never purge)', async () => {
    await seedDefaultRetentionPolicies(db, TENANT);
    const policies = await repo.findEnabled(TENANT);
    const audit = policies.find((p) => p.entityType === 'audit');
    expect(audit).toBeDefined();
    expect(audit!.action).toBe('retain');
  });

  test('every default carries the jurisdiction-review disclaimer', async () => {
    await seedDefaultRetentionPolicies(db, TENANT);
    const policies = await repo.findEnabled(TENANT);
    for (const p of policies) {
      expect(p.notes).toBe(DEFAULT_RETENTION_DISCLAIMER);
    }
  });

  test('is idempotent — a second run inserts nothing', async () => {
    await seedDefaultRetentionPolicies(db, TENANT);
    const second = await seedDefaultRetentionPolicies(db, TENANT);
    expect(second).toBe(0);
  });
});
