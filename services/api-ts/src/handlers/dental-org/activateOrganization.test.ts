/**
 * activateOrganization handler tests (C-1 / ADR-007).
 *
 * Owner activates a provisional clinic → status 'live' (unlocks PHI writes).
 * - owner: provisional → 200 + status live + audit row + DB flipped
 * - non-owner: 403 (becoming a member/admin does not grant activation)
 * - already-live: 200 idempotent
 * - suspended: 403 ORG_SUSPENDED
 * - not found: 404 ; unauthenticated: 401
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { sql, eq, and } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp as buildHarnessApp } from '@/tests/helpers/test-app';

// Migrated off the bespoke raw-handler mount to the shared validator-mounting
// harness (Track 4): POST /dental/organizations/:id/activate now runs through
// the real generated route table (authMiddleware → param zValidator → handler).

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const owner = { id: '00000000-0000-0000-0000-0000000000a1', email: 'owner@activate.com' };
const stranger = { id: '00000000-0000-0000-0000-0000000000a2', email: 'stranger@activate.com' };
const ORG_ID = 'da100000-0000-1000-8000-0000000000a1';

async function seedOrg(status: 'provisional' | 'live' | 'suspended') {
  const { dentalOrganizations } = await import('./repos/organization.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Activate Clinic', tier: 'clinic', ownerPersonId: owner.id, countryCode: 'PH', status, createdBy: owner.id, updatedBy: owner.id }).onConflictDoUpdate({ target: dentalOrganizations.id, set: { status } });
}

async function orgStatus(): Promise<string | undefined> {
  const { dentalOrganizations } = await import('./repos/organization.schema');
  const [row] = await db.select({ status: dentalOrganizations.status }).from(dentalOrganizations).where(eq(dentalOrganizations.id, ORG_ID));
  return row?.status;
}

function buildTestApp(user?: { id: string; email: string }) {
  return buildHarnessApp({ db, user: user ?? null });
}

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_audit_log WHERE target_id = ${ORG_ID}`);
  const { dentalOrganizations } = await import('./repos/organization.schema');
  await db.delete(dentalOrganizations).where(eq(dentalOrganizations.id, ORG_ID));
});

describe('activateOrganization', () => {
  test('owner activates a provisional org → 200, status live, DB flipped, audit row', async () => {
    await seedOrg('provisional');
    const res = await buildTestApp(owner).request(`/dental/organizations/${ORG_ID}/activate`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('live');
    expect(await orgStatus()).toBe('live');

    const { dentalAuditLog } = await import('@/handlers/dental-audit/repos/audit-log.schema');
    const rows = await db.select().from(dentalAuditLog).where(and(eq(dentalAuditLog.action, 'org.activate'), eq(dentalAuditLog.targetId, ORG_ID)));
    expect(rows.length).toBe(1);
  });

  test('non-owner cannot activate → 403, status unchanged', async () => {
    await seedOrg('provisional');
    const res = await buildTestApp(stranger).request(`/dental/organizations/${ORG_ID}/activate`, { method: 'POST' });
    expect(res.status).toBe(403);
    expect(await orgStatus()).toBe('provisional');
  });

  test('already-live org → 200 idempotent', async () => {
    await seedOrg('live');
    const res = await buildTestApp(owner).request(`/dental/organizations/${ORG_ID}/activate`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect((await res.json() as any).status).toBe('live');
  });

  test('suspended org cannot be self-activated → 403 ORG_SUSPENDED', async () => {
    await seedOrg('suspended');
    const res = await buildTestApp(owner).request(`/dental/organizations/${ORG_ID}/activate`, { method: 'POST' });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('ORG_SUSPENDED');
    expect(await orgStatus()).toBe('suspended');
  });

  test('unknown org → 404', async () => {
    const res = await buildTestApp(owner).request(`/dental/organizations/da100000-0000-1000-8000-0000000000ff/activate`, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  test('unauthenticated → 401', async () => {
    await seedOrg('provisional');
    const res = await buildTestApp(undefined).request(`/dental/organizations/${ORG_ID}/activate`, { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
