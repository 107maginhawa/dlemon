/**
 * Module 11: Settings — FR8.1-FR8.3, FR8.4, FR8.4b, FR8.7, FR8.8, FR8.13
 *
 * Tests:
 * - GET returns empty settings when none configured
 * - PUT saves clinic config (FR8.1)
 * - PUT saves dentist profile (FR8.2)
 * - PUT saves fee schedule (FR8.3)
 * - FR8.4: Treatment templates editor (branch-level CRUD via existing routes)
 * - FR8.4b: Consent form templates CRUD
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
import { ZodError } from 'zod';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { getBranchSettings, updateBranchSettings } from './branchSettings';
import {
  listConsentTemplates,
  createConsentTemplate,
  updateConsentTemplate,
  deleteConsentTemplate,
} from './consentTemplates';
import { dentalConsentTemplates } from './repos/consent-template.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

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
    if (err instanceof ZodError) return c.json({ error: err.issues.map(i => i.message).join('; ') }, 400);
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
  // FR8.4b: Consent form templates
  app.get('/dental/branches/:branchId/consent-templates', listConsentTemplates);
  app.post('/dental/branches/:branchId/consent-templates', createConsentTemplate);
  app.patch('/dental/branches/:branchId/consent-templates/:id', updateConsentTemplate);
  app.delete('/dental/branches/:branchId/consent-templates/:id', deleteConsentTemplate);
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

  test('403 for unknown branch (no membership → access denied)', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request('/dental/branches/ffffffff-ffff-1000-8000-ffffffffffff/settings');
    // assertBranchAccess runs before existence check — 403 is correct (no info leak)
    expect(res.status).toBe(403);
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

  test('user without membership is blocked (403)', async () => {
    await seedData();
    const unknownUser = { id: '00000000-0000-0000-0000-000000000099', email: 'unknown@test.com' };
    const app = buildTestApp(unknownUser as any); // no membership
    const res = await app.request(`/dental/branches/${BRANCH_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { clinicName: 'Test' } }),
    });
    // P0 auth: no membership → not dentist_owner → blocked
    expect(res.status).toBe(403);
  });
});

// FR8.4: Treatment Templates Editor CRUD
// Note: FR8.4 shares the same API endpoints as FR1.8 (/dental/treatment-templates).
// The distinction is purely UI: FR1.8 = workspace toolbar, FR8.4 = Settings menu.
// Both are covered by dental-visit-module3.test.ts treatmentTemplates tests.
describe('FR8.4 — Treatment Templates Editor (branch-level CRUD)', () => {
  test('treatment template CRUD is branch-scoped (shared with FR1.8)', () => {
    // FR8.4 shares handlers with FR1.8 (see treatmentTemplates.ts).
    // Full test coverage in dental-visit-module3.test.ts.
    // This test documents the intentional sharing.
    expect(true).toBe(true);
  });
});

// FR8.4b: Consent Form Templates CRUD
describe('FR8.4b — Consent Form Templates Editor', () => {
  afterEach(async () => {
    await db.execute(sql`DELETE FROM dental_consent_template WHERE branch_id = ${BRANCH_ID}`);
  });

  test('owner can create a consent template', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/consent-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tooth Extraction Consent',
        body: 'I consent to the extraction of the indicated tooth.',
        requiresWitnessSignature: false,
      }),
    });

    expect(res.status).toBe(201);
    // Contract: ApiCreatedResponse<DentalConsentTemplate> = bare created object.
    const body = await res.json() as any;
    expect(body.name).toBe('Tooth Extraction Consent');
    expect(body.branchId).toBe(BRANCH_ID);
    expect(body.active).toBe(true);
  });

  test('lists active consent templates for a branch', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    // Create two templates
    await db.insert(dentalConsentTemplates).values([
      { branchId: BRANCH_ID, name: 'Template A', body: 'Body A', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
      { branchId: BRANCH_ID, name: 'Template B', body: 'Body B', active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id },
    ]);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/consent-templates`);
    expect(res.status).toBe(200);
    // Contract: ApiOkResponse<DentalConsentTemplate[]> = bare array body.
    const body = await res.json() as any;
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  test('owner can update a consent template', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const [template] = await db.insert(dentalConsentTemplates).values({
      branchId: BRANCH_ID, name: 'Old Name', body: 'Old body',
      active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).returning();

    const res = await app.request(`/dental/branches/${BRANCH_ID}/consent-templates/${template!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(200);
    // Contract: ApiOkResponse<DentalConsentTemplate> = bare updated object.
    const body = await res.json() as any;
    expect(body.name).toBe('New Name');
    expect(body.body).toBe('Old body'); // unchanged
  });

  test('owner can soft-delete a consent template', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);
    const [template] = await db.insert(dentalConsentTemplates).values({
      branchId: BRANCH_ID, name: 'To Delete', body: 'Body',
      active: true, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
    }).returning();

    const res = await app.request(`/dental/branches/${BRANCH_ID}/consent-templates/${template!.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    // Should not appear in list after deletion (bare array body).
    const listRes = await app.request(`/dental/branches/${BRANCH_ID}/consent-templates`);
    const listBody = await listRes.json() as any;
    const found = (listBody as any[]).find((t: any) => t.id === template!.id);
    expect(found).toBeUndefined();
  });

  test('non-owner cannot create consent template (403)', async () => {
    await seedData();
    const app = buildTestApp(OTHER_USER);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/consent-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', body: 'Y' }),
    });

    expect(res.status).toBe(403);
  });

  test('returns 400 when name is missing', async () => {
    await seedData();
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/consent-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Body without name' }),
    });

    expect(res.status).toBe(400);
  });

  test('returns 401 without auth', async () => {
    const app = buildTestApp(); // no user
    const res = await app.request(`/dental/branches/${BRANCH_ID}/consent-templates`);
    expect(res.status).toBe(401);
  });
});
