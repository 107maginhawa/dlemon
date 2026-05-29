/**
 * dental-clinical-inventory.test.ts — Inventory Entity + Stock Adjustments (P2-004)
 *
 * inv01-AC-001  POST item returns 201 with item object
 * inv01-AC-002  GET items returns 200 with array
 * inv01-AC-003  PATCH item returns 200 with updated item
 * inv01-AC-004  POST adjustment returns 201 and quantityOnHand updated atomically
 * inv01-AC-005  GET adjustments returns 200 with array
 * inv01-AC-006  401 without auth
 * inv01-AC-007  404 for non-existent branch / non-existent item
 * inv01-AC-008  400 for invalid body (missing required, bad enum, zero quantity)
 */

import { describe, test, expect, afterEach, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  InventoryBranchParams,
  InventoryItemParams,
  CreateInventoryItemBody,
  UpdateInventoryItemBody,
  CreateAdjustmentBody,
} from './utils/inventory-validators';
import { createInventoryItem } from './inventory/createInventoryItem';
import { listInventoryItems } from './inventory/listInventoryItems';
import { updateInventoryItem } from './inventory/updateInventoryItem';
import { createInventoryAdjustment } from './inventory/createInventoryAdjustment';
import { listInventoryAdjustments } from './inventory/listInventoryAdjustments';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite tag: inv01 — unique IDs
const TEST_USER = { id: 'a0000000-0000-1000-8000-000000000044', email: 'inv@clinic.com' };
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000044';
const ORG_ID    = 'c0000000-0000-1000-8000-000000000044';
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');

  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Inventory Clinic', tier: 'solo',
    ownerPersonId: TEST_USER.id, countryCode: 'PH',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID,
    name: 'Main Branch', timezone: 'Asia/Manila',
    createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();

  await db.insert(dentalMemberships).values({
    id: 'a4000000-0000-1000-8000-000000000044',
    branchId: BRANCH_ID, personId: TEST_USER.id,
    displayName: 'Inventory Manager', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: TEST_USER.id, updatedBy: TEST_USER.id,
  }).onConflictDoNothing();
});

afterEach(async () => {
  const { dentalInventoryItems, dentalInventoryAdjustments } = await import('./repos/inventory.schema');
  // Delete adjustments first via item-scope, then items (CASCADE also handles it,
  // but explicit delete keeps order deterministic).
  const items = await db
    .select({ id: dentalInventoryItems.id })
    .from(dentalInventoryItems)
    .where(eq(dentalInventoryItems.branchId, BRANCH_ID));
  for (const it of items) {
    await db.delete(dentalInventoryAdjustments).where(eq(dentalInventoryAdjustments.itemId, it.id));
  }
  await db.delete(dentalInventoryItems).where(eq(dentalInventoryItems.branchId, BRANCH_ID));
});

function buildTestApp(user?: typeof TEST_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) ctx.set('user', user);
    await next();
  });

  app.post(
    '/dental/branches/:branchId/inventory',
    zValidator('param', InventoryBranchParams, ve),
    zValidator('json', CreateInventoryItemBody, ve),
    createInventoryItem as any,
  );
  app.get(
    '/dental/branches/:branchId/inventory',
    zValidator('param', InventoryBranchParams, ve),
    listInventoryItems as any,
  );
  app.patch(
    '/dental/branches/:branchId/inventory/:itemId',
    zValidator('param', InventoryItemParams, ve),
    zValidator('json', UpdateInventoryItemBody, ve),
    updateInventoryItem as any,
  );
  app.post(
    '/dental/branches/:branchId/inventory/:itemId/adjustments',
    zValidator('param', InventoryItemParams, ve),
    zValidator('json', CreateAdjustmentBody, ve),
    createInventoryAdjustment as any,
  );
  app.get(
    '/dental/branches/:branchId/inventory/:itemId/adjustments',
    zValidator('param', InventoryItemParams, ve),
    listInventoryAdjustments as any,
  );

  return app;
}

// =============================================================================
// inv01-AC-001: POST item returns 201
// =============================================================================

describe('POST /dental/branches/:branchId/inventory (inv01-AC-001)', () => {
  test('inv01-AC-001: creates item and returns 201', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Composite resin A2',
        category: 'consumable',
        unit: 'syringes',
        quantityOnHand: 12,
        reorderLevel: 4,
        notes: 'Shade A2, expires 2027',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeDefined();
    expect(body.branchId).toBe(BRANCH_ID);
    expect(body.name).toBe('Composite resin A2');
    expect(body.category).toBe('consumable');
    expect(body.unit).toBe('syringes');
    expect(body.quantityOnHand).toBe(12);
    expect(body.reorderLevel).toBe(4);
    expect(body.notes).toBe('Shade A2, expires 2027');
  });

  test('inv01-AC-001: applies defaults for quantityOnHand and reorderLevel', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gauze pads', category: 'consumable', unit: 'boxes' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.quantityOnHand).toBe(0);
    expect(body.reorderLevel).toBe(10);
  });
});

// =============================================================================
// inv01-AC-002: GET items returns array
// =============================================================================

describe('GET /dental/branches/:branchId/inventory (inv01-AC-002)', () => {
  test('inv01-AC-002: returns empty array when no items exist', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('inv01-AC-002: returns all items for the branch', async () => {
    const app = buildTestApp(TEST_USER);

    await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Lidocaine 2%', category: 'medication', unit: 'ml' }),
    });
    await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mirror', category: 'instrument', unit: 'pcs' }),
    });

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.length).toBe(2);
  });
});

// =============================================================================
// inv01-AC-003: PATCH item
// =============================================================================

describe('PATCH /dental/branches/:branchId/inventory/:itemId (inv01-AC-003)', () => {
  test('inv01-AC-003: updates name + reorderLevel and returns 200', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Old name', category: 'consumable', unit: 'pcs' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New name', reorderLevel: 25 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.name).toBe('New name');
    expect(body.reorderLevel).toBe(25);
  });

  test('inv01-AC-007: PATCH returns 404 for non-existent itemId', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${NONEXISTENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });

    expect(res.status).toBe(404);
  });
});

// =============================================================================
// inv01-AC-004: POST adjustment updates quantityOnHand
// =============================================================================

describe('POST adjustment (inv01-AC-004)', () => {
  test('inv01-AC-004: restock +5 increments quantityOnHand', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Burs', category: 'instrument', unit: 'pcs', quantityOnHand: 10 }),
    });
    const item = await createRes.json() as any;

    const adjRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${item.id}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentType: 'restock', quantity: 5, reason: 'monthly order' }),
    });

    expect(adjRes.status).toBe(201);
    const adj = await adjRes.json() as any;
    expect(adj.id).toBeDefined();
    expect(adj.itemId).toBe(item.id);
    expect(adj.adjustmentType).toBe('restock');
    expect(adj.quantity).toBe(5);

    // Verify item.quantityOnHand was updated
    const listRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`);
    const items = await listRes.json() as any[];
    const refreshed = items.find((i) => i.id === item.id);
    expect(refreshed.quantityOnHand).toBe(15);
  });

  test('inv01-AC-004: usage -3 decrements quantityOnHand', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Anesthetic', category: 'medication', unit: 'ml', quantityOnHand: 20 }),
    });
    const item = await createRes.json() as any;

    const adjRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${item.id}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentType: 'usage', quantity: -3 }),
    });

    expect(adjRes.status).toBe(201);

    const listRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`);
    const items = await listRes.json() as any[];
    const refreshed = items.find((i) => i.id === item.id);
    expect(refreshed.quantityOnHand).toBe(17);
  });

  test('inv01-AC-007: POST adjustment returns 404 for non-existent item', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${NONEXISTENT_ID}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentType: 'restock', quantity: 1 }),
    });

    expect(res.status).toBe(404);
  });

  test('inv01-AC-008: POST adjustment with quantity=0 returns 400', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', category: 'other', unit: 'pcs' }),
    });
    const item = await createRes.json() as any;

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${item.id}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentType: 'restock', quantity: 0 }),
    });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// inv01-AC-005: GET adjustments
// =============================================================================

describe('GET adjustments (inv01-AC-005)', () => {
  test('inv01-AC-005: returns list of adjustments for an item', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gloves', category: 'consumable', unit: 'boxes', quantityOnHand: 5 }),
    });
    const item = await createRes.json() as any;

    await app.request(`/dental/branches/${BRANCH_ID}/inventory/${item.id}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentType: 'restock', quantity: 10 }),
    });
    await app.request(`/dental/branches/${BRANCH_ID}/inventory/${item.id}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentType: 'usage', quantity: -2 }),
    });

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${item.id}/adjustments`);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
  });
});

// =============================================================================
// inv01-AC-006: 401 without auth
// =============================================================================

describe('Auth (inv01-AC-006)', () => {
  test('POST item returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', category: 'other', unit: 'pcs' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET items returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`);
    expect(res.status).toBe(401);
  });

  test('POST adjustment returns 401 without user', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${NONEXISTENT_ID}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentType: 'restock', quantity: 1 }),
    });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// inv01-AC-007: 404 for non-existent branch
// =============================================================================

describe('Branch not found (inv01-AC-007)', () => {
  // EF-CLI-002: branch authorization runs before branch-existence lookup, so a
  // user with no membership in the target branch gets 403 (not 404). This is the
  // correct auth-first ordering — it prevents branch-existence enumeration by
  // non-members.
  test('POST returns 403 for branch the user is not a member of', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${NONEXISTENT_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', category: 'other', unit: 'pcs' }),
    });
    expect(res.status).toBe(403);
  });

  test('GET returns 403 for branch the user is not a member of', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${NONEXISTENT_ID}/inventory`);
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// inv01-AC-008: 400 validation
// =============================================================================

describe('Validation (inv01-AC-008)', () => {
  test('POST returns 400 when name is missing', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'consumable', unit: 'pcs' }),
    });
    expect(res.status).toBe(400);
  });

  test('POST returns 400 for invalid category enum', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', category: 'banana', unit: 'pcs' }),
    });
    expect(res.status).toBe(400);
  });

  test('POST returns 400 when unit is empty', async () => {
    const app = buildTestApp(TEST_USER);
    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', category: 'other', unit: '' }),
    });
    expect(res.status).toBe(400);
  });

  test('POST adjustment returns 400 for invalid adjustmentType enum', async () => {
    const app = buildTestApp(TEST_USER);
    const createRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', category: 'other', unit: 'pcs' }),
    });
    const item = await createRes.json() as any;

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${item.id}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentType: 'banana', quantity: 1 }),
    });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// GAP-004: InventoryItem status field (IDEAL §3.11, §6.8)
// =============================================================================

describe('GAP-004: InventoryItem status lifecycle (IDEAL §3.11)', () => {
  test('GAP-004 AC-001: POST item defaults to status=active', async () => {
    const app = buildTestApp(TEST_USER);

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'GapItem', category: 'consumable', unit: 'box' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.status).toBe('active');
  });

  test('GAP-004 AC-002: PATCH item status to discontinued succeeds', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'GapItem2', category: 'consumable', unit: 'box' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'discontinued' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('discontinued');
  });

  test('GAP-004 AC-003: PATCH item with invalid status returns 400', async () => {
    const app = buildTestApp(TEST_USER);

    const createRes = await app.request(`/dental/branches/${BRANCH_ID}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'GapItem3', category: 'consumable', unit: 'box' }),
    });
    const created = await createRes.json() as any;

    const res = await app.request(`/dental/branches/${BRANCH_ID}/inventory/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'banana' }),
    });

    expect(res.status).toBe(400);
  });
});
