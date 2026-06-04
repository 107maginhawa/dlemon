/**
 * RetentionPolicyRepository tests (DB-backed). Locks the eligibility filtering
 * the enforcement job relies on: findEnabled must exclude disabled and
 * soft-deleted rows and honour tenant scoping.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { RetentionPolicyRepository } from './retention-policy.repo';
import type { NewDentalRetentionPolicy } from './retention-policy.schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const TENANT_A = 'a0000000-0000-4000-8000-000000000001';
const TENANT_B = 'b0000000-0000-4000-8000-000000000002';

function row(overrides: Partial<NewDentalRetentionPolicy> = {}): NewDentalRetentionPolicy {
  return {
    tenantId: TENANT_A,
    entityType: 'clinical',
    retentionPeriodDays: 3650,
    action: 'archive',
    enabled: true,
    legalHoldExempt: false,
    ...overrides,
  };
}

describe('RetentionPolicyRepository', () => {
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

  test('createOne persists a policy with defaults', async () => {
    const created = await repo.createOne(row({ entityType: 'visit' }));
    expect(created.id).toBeTruthy();
    expect(created.entityType).toBe('visit');
    expect(created.action).toBe('archive');
    expect(created.enabled).toBe(true);
  });

  test('findEnabled returns only enabled, non-deleted policies', async () => {
    await repo.createOne(row({ entityType: 'clinical', enabled: true }));
    await repo.createOne(row({ entityType: 'visit', enabled: false }));
    const deleted = await repo.createOne(row({ entityType: 'prescription', enabled: true }));
    await repo.softDelete(deleted.id);

    const enabled = await repo.findEnabled();
    const types = enabled.map((p) => p.entityType).sort();
    expect(types).toEqual(['clinical']);
  });

  test('findEnabled scopes by tenant when given a tenantId', async () => {
    await repo.createOne(row({ tenantId: TENANT_A, entityType: 'clinical' }));
    await repo.createOne(row({ tenantId: TENANT_B, entityType: 'clinical' }));

    const aOnly = await repo.findEnabled(TENANT_A);
    expect(aOnly).toHaveLength(1);
    expect(aOnly[0]!.tenantId).toBe(TENANT_A);
  });

  test('softDelete hides the policy from findEnabled and findOneById', async () => {
    const p = await repo.createOne(row());
    expect(await repo.softDelete(p.id)).toBe(true);
    expect(await repo.findOneById(p.id)).toBeNull();
    expect(await repo.findEnabled()).toHaveLength(0);
  });
});
