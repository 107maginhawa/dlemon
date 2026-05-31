/**
 * Default retention-policy seeding tests (DB-backed). Verifies the conservative
 * defaults are inserted idempotently, audit is seeded as never-purge, and
 * enablement is derived from the target registry (only entity types with a real
 * enforcement target are enabled — V-RET-002).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { seedDefaultRetentionPolicies, DEFAULT_RETENTION_DISCLAIMER } from './retention-defaults';
import { RetentionPolicyRepository } from './repos/retention-policy.repo';
import { SUPPORTED_RETENTION_ENTITY_TYPES } from './retention-targets';
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

  test('inserts the default policy set for a tenant with correct periods', async () => {
    const inserted = await seedDefaultRetentionPolicies(db, TENANT);
    expect(inserted).toBeGreaterThanOrEqual(5);

    const all = await repo.findMany({ tenantId: TENANT });
    const byType = Object.fromEntries(all.map((p) => [p.entityType, p]));

    expect(byType['clinical']!.retentionPeriodDays).toBe(3650); // ~10y
    expect(byType['prescription']!.retentionPeriodDays).toBe(1825); // ~5y
    expect(byType['attachment']!.action).toBe('archive');
  });

  test('audit is seeded as retain (never purge)', async () => {
    await seedDefaultRetentionPolicies(db, TENANT);
    const all = await repo.findMany({ tenantId: TENANT });
    const audit = all.find((p) => p.entityType === 'audit');
    expect(audit).toBeDefined();
    expect(audit!.action).toBe('retain');
  });

  test('only entity types with a registered target are enabled (V-RET-002)', async () => {
    await seedDefaultRetentionPolicies(db, TENANT);
    const all = await repo.findMany({ tenantId: TENANT });

    for (const p of all) {
      const shouldBeEnabled = SUPPORTED_RETENTION_ENTITY_TYPES.includes(p.entityType);
      expect(p.enabled).toBe(shouldBeEnabled);
    }

    // attachment + audit have targets → enabled; clinical/visit/prescription → disabled.
    const enabled = (await repo.findEnabled(TENANT)).map((p) => p.entityType).sort();
    expect(enabled).toEqual(['attachment', 'audit']);
  });

  test('no ENABLED seeded policy lacks an enforcement target (no silent no-target)', async () => {
    await seedDefaultRetentionPolicies(db, TENANT);
    const enabled = await repo.findEnabled(TENANT);
    for (const p of enabled) {
      expect(SUPPORTED_RETENTION_ENTITY_TYPES).toContain(p.entityType);
    }
  });

  test('every default carries the jurisdiction-review disclaimer', async () => {
    await seedDefaultRetentionPolicies(db, TENANT);
    const all = await repo.findMany({ tenantId: TENANT });
    for (const p of all) {
      expect(p.notes).toContain(DEFAULT_RETENTION_DISCLAIMER);
    }
  });

  test('is idempotent — a second run inserts nothing', async () => {
    await seedDefaultRetentionPolicies(db, TENANT);
    const second = await seedDefaultRetentionPolicies(db, TENANT);
    expect(second).toBe(0);
  });
});
