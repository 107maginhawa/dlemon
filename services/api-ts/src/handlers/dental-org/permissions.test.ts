/**
 * Granular feature-permission grid tests (P2-17).
 *
 * Covers: catalog default-allow fallback, override allow/deny, owner-only write,
 * unknown-feature rejection, owner-lockout guard, and the assertPermission helper.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import { Hono } from 'hono';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { getPermissionGrid } from './getPermissionGrid';
import { updatePermissions } from './updatePermissions';
import { assertPermission, resolvePermission } from '@/handlers/shared/assert-permission';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID = 'a9000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b9000000-0000-1000-8000-000000000001';
const OWNER_ID = 'c9000000-0000-1000-8000-000000000001';
const ASSOC_ID = 'c9000000-0000-1000-8000-000000000002';

const ownerUser = { id: OWNER_ID, email: 'owner@clinic.com' };
const assocUser = { id: ASSOC_ID, email: 'assoc@clinic.com' };

function buildTestApp(user?: { id: string; email: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    if (err instanceof ZodError) return c.json({ error: err.issues.map((i) => i.message).join('; ') }, 400);
    return c.json({ error: String((err as Error).message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });
  app.get('/dental/org/permissions', getPermissionGrid);
  app.put('/dental/org/permissions', updatePermissions);
  return app;
}

async function seed() {
  const orgRepo = new OrganizationRepository(db);
  await orgRepo.createOne({
    id: ORG_ID, name: 'Perm Clinic', tier: 'clinic', ownerPersonId: OWNER_ID, countryCode: 'PH', active: true,
  });
  const branchRepo = new BranchRepository(db);
  await branchRepo.createOne({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', active: true,
  });
  const memberRepo = new MembershipRepository(db);
  await memberRepo.createOne({ branchId: BRANCH_ID, personId: OWNER_ID, displayName: 'Owner', role: 'dentist_owner', status: 'active' });
  await memberRepo.createOne({ branchId: BRANCH_ID, personId: ASSOC_ID, displayName: 'Assoc', role: 'dentist_associate', status: 'active' });
}

describe('feature permissions (P2-17)', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_feature_permission, dental_membership, dental_branch, dental_organization CASCADE`);
  });

  // ---- grid read ----

  test('GET returns 401 when unauthenticated', async () => {
    const res = await buildTestApp(undefined).request('/dental/org/permissions');
    expect(res.status).toBe(401);
  });

  test('GET returns the catalog + effective grid for the owner', async () => {
    await seed();
    const res = await buildTestApp(ownerUser).request(`/dental/org/permissions?organizationId=${ORG_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.organizationId).toBe(ORG_ID);
    expect(Array.isArray(body.catalog)).toBe(true);
    expect(body.catalog.length).toBeGreaterThan(0);
    // owner default-allows billing.invoice.void
    const ownerVoid = body.cells.find((c: any) => c.role === 'dentist_owner' && c.feature === 'billing.invoice.void');
    expect(ownerVoid.allowed).toBe(true);
    expect(ownerVoid.source).toBe('default');
    // associate default-denies billing.invoice.void
    const assocVoid = body.cells.find((c: any) => c.role === 'dentist_associate' && c.feature === 'billing.invoice.void');
    expect(assocVoid.allowed).toBe(false);
  });

  test('a member (non-owner) may view the grid', async () => {
    await seed();
    const res = await buildTestApp(assocUser).request(`/dental/org/permissions?organizationId=${ORG_ID}`);
    expect(res.status).toBe(200);
  });

  // ---- override write ----

  test('owner can grant a non-default permission and it shows as override', async () => {
    await seed();
    const res = await buildTestApp(ownerUser).request(`/dental/org/permissions?organizationId=${ORG_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: [{ role: 'dentist_associate', feature: 'billing.invoice.void', allowed: true }] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const cell = body.cells.find((c: any) => c.role === 'dentist_associate' && c.feature === 'billing.invoice.void');
    expect(cell.allowed).toBe(true);
    expect(cell.source).toBe('override');
  });

  test('non-owner member cannot write permissions (403)', async () => {
    await seed();
    const res = await buildTestApp(assocUser).request(`/dental/org/permissions?organizationId=${ORG_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: [{ role: 'staff_full', feature: 'reports.view', allowed: true }] }),
    });
    expect(res.status).toBe(403);
  });

  test('rejects unknown feature keys (400)', async () => {
    await seed();
    const res = await buildTestApp(ownerUser).request(`/dental/org/permissions?organizationId=${ORG_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: [{ role: 'staff_full', feature: 'nonsense.feature', allowed: true }] }),
    });
    expect(res.status).toBe(400);
  });

  test('refuses to revoke staff.manage from dentist_owner (anti-lockout)', async () => {
    await seed();
    const res = await buildTestApp(ownerUser).request(`/dental/org/permissions?organizationId=${ORG_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: [{ role: 'dentist_owner', feature: 'staff.manage', allowed: false }] }),
    });
    expect(res.status).toBe(400);
  });

  // ---- assertPermission helper ----

  test('assertPermission falls back to catalog default (no override) — owner allowed, assoc denied', async () => {
    await seed();
    // owner default-allows void
    await expect(assertPermission(db, OWNER_ID, BRANCH_ID, 'billing.invoice.void')).resolves.toBeUndefined();
    // associate default-denies void
    await expect(assertPermission(db, ASSOC_ID, BRANCH_ID, 'billing.invoice.void')).rejects.toThrow();
  });

  test('assertPermission honors an explicit override (deny owner-default-allowed feature)', async () => {
    await seed();
    // Deny the owner an otherwise-allowed feature via override and confirm enforcement.
    const { FeaturePermissionRepository } = await import('./repos/feature-permission.repo');
    const repo = new FeaturePermissionRepository(db);
    await repo.upsertOverride(ORG_ID, 'dentist_owner', 'billing.invoice.issue', false);
    await expect(assertPermission(db, OWNER_ID, BRANCH_ID, 'billing.invoice.issue')).rejects.toThrow();
    const decision = await resolvePermission(db, OWNER_ID, BRANCH_ID, 'billing.invoice.issue');
    expect(decision?.allowed).toBe(false);
    expect(decision?.source).toBe('override');
  });

  test('resolvePermission returns null for a non-member', async () => {
    await seed();
    const decision = await resolvePermission(db, 'f0000000-0000-1000-8000-0000000000ff', BRANCH_ID, 'reports.view');
    expect(decision).toBeNull();
  });
});
