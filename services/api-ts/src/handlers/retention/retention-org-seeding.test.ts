/**
 * V-RET-001: creating an organization must seed its default retention policy
 * registry at RUNTIME (not just via the standalone script), so declared
 * retention is present from day one. Drives the real routed handler.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { DentalOrganizationManagement_create } from '@/handlers/dental-org/DentalOrganizationManagement_create';
import { RetentionPolicyRepository } from './repos/retention-policy.repo';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;
const ADMIN = { id: 'a0000000-0000-4000-8000-0000000000a1', email: 'admin@clinic.com', role: 'admin' };

function fakeCtx(db: NodePgDatabase, user: any, body: any) {
  const store = new Map<string, unknown>([
    ['database', db],
    ['logger', noopLogger],
    ['user', user],
  ]);
  return {
    get: (k: string) => store.get(k),
    req: { valid: () => body },
    json: (data: any, status?: number) =>
      new Response(JSON.stringify(data), { status: status ?? 200, headers: { 'Content-Type': 'application/json' } }),
  } as any;
}

describe('org creation seeds default retention policies (V-RET-001)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    teardown = rollback;
  });

  afterEach(() => teardown());

  test('a newly created org has its default retention registry seeded', async () => {
    const ctx = fakeCtx(db, ADMIN, { name: 'Bright Dental', tier: 'solo', countryCode: 'PH' });
    const res = await DentalOrganizationManagement_create(ctx);
    expect(res.status).toBe(201);
    const org = (await res.json()) as { id: string };
    expect(org.id).toBeTruthy();

    const repo = new RetentionPolicyRepository(db);
    const policies = await repo.findMany({ tenantId: org.id });
    expect(policies.length).toBeGreaterThanOrEqual(5);

    // The cron now finds real enabled policies for this tenant (attachment + audit).
    const enabled = await repo.findEnabled(org.id);
    expect(enabled.length).toBeGreaterThan(0);
  });
});
