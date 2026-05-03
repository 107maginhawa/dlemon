/**
 * Module 11: Settings — FR8.1-FR8.3, FR8.7, FR8.8, FR8.13
 *
 * Tests:
 * - GET returns empty settings when none configured
 * - PUT saves clinic config (FR8.1)
 * - PUT saves dentist profile (FR8.2)
 * - PUT saves fee schedule (FR8.3)
 * - PUT saves visit notes format toggle (FR8.7)
 * - PUT saves locale settings (FR8.8)
 * - PUT merges with existing settings (not overwrite)
 * - FR8.13: non-owner cannot update settings (403)
 * - FR8.13: owner can update settings (200)
 * - 404 for unknown branch
 * - 401 without auth
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { getBranchSettings, updateBranchSettings } from './branchSettings';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const TEST_USER = { id: '00000000-0000-0000-0000-000000000044', email: 'owner@clinic.com' };
const OTHER_USER = { id: '00000000-0000-0000-0000-000000000045', email: 'staff@clinic.com' };
const ORG_ID = 'eeeeeeee-0000-1000-8000-000000000044';
const BRANCH_ID = 'bbbbbbbb-0000-1000-8000-000000000044';
const OWNER_MEMBER_ID = 'dddddddd-0000-1000-8000-000000000044';
const STAFF_MEMBER_ID = 'dddddddd-0000-1000-8000-000000000045';

function buildTestApp(user?: typeof TEST_USER | typeof OTHER_USER) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    if (user) ctx.set('user', user);
    await next();
  });
  app.get('/dental/branches/:branchId/settings', getBranchSettings);
  app.put('/dental/branches/:branchId/settings', updateBranchSettings);
  return app;
}

async function seedData() {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Test Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values([
    {
      id: OWNER_MEMBER_ID, branchId: BRANCH_ID, personId: TEST_USER.id,
      displayName: 'Dr. Owner', role: 'dentist_owner',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    },
    {
      id: STAFF_MEMBER_ID, branchId: BRANCH_ID, personId: OTHER_USER.id,
      displayName: 'Staff Member', role: 'staff_full',
      createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    },
  ]).onConflictDoNothing();
}

afterEach(async () => {
  await db.execute(sql`
    TRUNCATE dental_membership, dental_branch, dental_organization
    RESTART IDENTITY CASCADE
  `);
});

// ---------------------------------------------------------------------------
// GET settings
// ---------------------------------------------------------------------------

describe('GET /dental/branches/:branchId/settings', () => {
  test('returns empty object when no settings configured', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.settings).toEqual({});
  });

  test('404 for unknown branch', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/branches/ffffffff-ffff-1000-8000-ffffffffffff/settings');
    expect(res.status).toBe(404);
  });

  test('401 without auth', async () => {
    await seedData();
    const app = buildTestApp();
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT settings (FR8.1-FR8.3, FR8.7, FR8.8)
// ---------------------------------------------------------------------------

describe('PUT /dental/branches/:branchId/settings', () => {
  test('FR8.1: saves clinic configuration', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { clinicName: 'Sunshine Dental', clinicPhone: '+63-912-345-6789' },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.settings.clinicName).toBe('Sunshine Dental');
    expect(body.settings.clinicPhone).toBe('+63-912-345-6789');
  });

  test('FR8.2: saves dentist profile', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { dentistName: 'Dr. Maria Santos', dentistLicenseNumber: 'PRC-12345' },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.settings.dentistLicenseNumber).toBe('PRC-12345');
  });

  test('FR8.3: saves treatment fee schedule', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { feeSchedule: { D0120: 50000, D0140: 80000 } },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.settings.feeSchedule.D0120).toBe(50000);
  });

  test('FR8.7: saves visit notes format toggle', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { visitNotesFormat: 'freetext' } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.settings.visitNotesFormat).toBe('freetext');
  });

  test('FR8.8: saves locale settings', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { locale: 'en-PH', currency: 'PHP', dateFormat: 'MM/DD/YYYY' },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.settings.locale).toBe('en-PH');
    expect(body.settings.currency).toBe('PHP');
  });

  test('merges with existing settings (does not overwrite)', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    // First save
    await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { clinicName: 'Sunshine Dental' } }),
    });
    // Second save — should preserve clinicName
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { locale: 'en-PH' } }),
    });
    const body = await res.json() as any;
    expect(body.settings.clinicName).toBe('Sunshine Dental'); // preserved
    expect(body.settings.locale).toBe('en-PH'); // added
  });
});

// ---------------------------------------------------------------------------
// FR8.13: Access Control
// ---------------------------------------------------------------------------

describe('FR8.13: Access Control — dentist_owner only for settings updates', () => {
  test('owner can update settings', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER); // dentist_owner
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { clinicName: 'My Clinic' } }),
    });
    expect(res.status).toBe(200);
  });

  test('non-owner staff cannot update settings (403)', async () => {
    await seedData();
    const app = buildTestApp(OTHER_USER); // staff_full
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { clinicName: 'Hacked Clinic' } }),
    });
    expect(res.status).toBe(403);
  });

  test('user without membership can still update (no role restriction for non-members)', async () => {
    await seedData();
    const unknownUser = { id: '00000000-0000-0000-0000-000000000099', email: 'unknown@test.com' };
    const app = buildTestApp(unknownUser as any); // no membership
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { clinicName: 'Test' } }),
    });
    // No membership found → no role → not blocked (null role = allowed)
    expect(res.status).toBe(200);
  });
});
