/**
 * Granular feature-permission grid tests (P2-17).
 *
 * Covers: catalog default-allow fallback, override allow/deny, owner-only write,
 * unknown-feature rejection, owner-lockout guard, and the assertPermission helper.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp as buildHarnessApp } from '@/tests/helpers/test-app';
import { assertPermission, resolvePermission } from '@/handlers/shared/assert-permission';
import { OrganizationRepository } from './repos/organization.repo';
import { BranchRepository } from './repos/branch.repo';
import { MembershipRepository } from './repos/membership.repo';

// Migrated off the bespoke raw-handler mount to the shared validator-mounting
// harness (Track 4): the GET/PUT permission routes now run through the real
// generated route table (authMiddleware → zValidator → handler), so the
// 400 unknown-feature / 403 non-owner / anti-lockout cases exercise the exact
// validation + error envelope production runs.

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ORG_ID = 'a9000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b9000000-0000-1000-8000-000000000001';
const OWNER_ID = 'c9000000-0000-1000-8000-000000000001';
const ASSOC_ID = 'c9000000-0000-1000-8000-000000000002';

const ownerUser = { id: OWNER_ID, email: 'owner@clinic.com' };
const assocUser = { id: ASSOC_ID, email: 'assoc@clinic.com' };

function buildTestApp(user?: { id: string; email: string }) {
  return buildHarnessApp({ db, user: user ?? null });
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
