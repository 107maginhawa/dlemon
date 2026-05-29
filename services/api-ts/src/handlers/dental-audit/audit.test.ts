/**
 * IDEAL-GAP-P1-001 + P2-003/P2-004: AuditLogRepository + AUD-BR-004 tests
 *
 * Tests the spec-compliant dental_audit_log table (actorId, targetType, targetId,
 * beforeSnapshot, afterSnapshot) and verifies logAuditEvent wires into it.
 *
 * Each test is isolated in a rolled-back transaction via openTestTx.
 * "da01" UUID namespace — won't collide with seed data.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { AuditLogRepository } from './repos/audit-log.repo';
import { logAuditEvent } from '@/core/audit-logger';
import type { NewDentalAuditLog } from './repos/audit-log.schema';

const ACTOR_A  = 'da010001-0000-0000-0000-000000000001';
const ACTOR_B  = 'da010001-0000-0000-0000-000000000002';
const TENANT_A = 'da010001-0000-0000-0000-000000000010';
const TENANT_B = 'da010001-0000-0000-0000-000000000011';
const BRANCH_A = 'da010001-0000-0000-0000-000000000020';
const BRANCH_B = 'da010001-0000-0000-0000-000000000021';
const TARGET_A = 'da010001-0000-0000-0000-000000000099';

function makeEntry(overrides: Partial<NewDentalAuditLog> = {}): NewDentalAuditLog {
  return {
    actorId: ACTOR_A,
    tenantId: TENANT_A,
    action: 'visit.complete',
    targetType: 'dental_visit',
    targetId: TARGET_A,
    ...overrides,
  };
}

let teardown: () => Promise<void>;
let repo: AuditLogRepository;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  repo = new AuditLogRepository(tx.db);
  teardown = tx.rollback;
});

afterEach(() => teardown());

describe('AuditLogRepository', () => {
  test('insert() stores a row with spec-correct fields', async () => {
    const entry = await repo.insert(makeEntry());
    expect(entry.id).toBeDefined();
    expect(entry.actorId).toBe(ACTOR_A);
    expect(entry.tenantId).toBe(TENANT_A);
    expect(entry.action).toBe('visit.complete');
    expect(entry.targetType).toBe('dental_visit');
    expect(entry.targetId).toBe(TARGET_A);
    expect(entry.timestamp).toBeDefined();
  });

  test('list() filters by actorId', async () => {
    await repo.insert(makeEntry({ actorId: ACTOR_A }));
    await repo.insert(makeEntry({ actorId: ACTOR_B, action: 'patient.view' }));

    const { entries, total } = await repo.list({ actorId: ACTOR_A }, { limit: 10, offset: 0 });
    expect(total).toBe(1);
    expect(entries[0]?.actorId).toBe(ACTOR_A);
  });

  test('list() filters by tenantId', async () => {
    await repo.insert(makeEntry({ tenantId: TENANT_A }));
    await repo.insert(makeEntry({ tenantId: TENANT_B, action: 'patient.view' }));

    const { entries, total } = await repo.list({ tenantId: TENANT_B }, { limit: 10, offset: 0 });
    expect(total).toBe(1);
    expect(entries[0]?.tenantId).toBe(TENANT_B);
  });

  test('list() filters by branchId', async () => {
    await repo.insert(makeEntry({ branchId: BRANCH_A }));
    await repo.insert(makeEntry({ branchId: BRANCH_B, action: 'patient.view' }));

    const { entries, total } = await repo.list({ branchId: BRANCH_A }, { limit: 10, offset: 0 });
    expect(total).toBe(1);
    expect(entries[0]?.branchId).toBe(BRANCH_A);
  });

  test('list() filters by targetType', async () => {
    const UNIQUE_TENANT = 'da010001-0000-0000-0000-000000000012';
    await repo.insert(makeEntry({ tenantId: UNIQUE_TENANT, targetType: 'dental_visit' }));
    await repo.insert(makeEntry({ tenantId: UNIQUE_TENANT, targetType: 'dental_invoice', action: 'invoice.voided' }));

    const { entries } = await repo.list({ tenantId: UNIQUE_TENANT, targetType: 'dental_invoice' }, { limit: 10, offset: 0 });
    expect(entries.length).toBe(1);
    expect(entries[0]?.targetType).toBe('dental_invoice');
  });

  test('list() returns empty when no match', async () => {
    await repo.insert(makeEntry());
    const { entries, total } = await repo.list({ actorId: ACTOR_B }, { limit: 10, offset: 0 });
    expect(total).toBe(0);
    expect(entries).toHaveLength(0);
  });

  test('list() respects limit/offset pagination', async () => {
    await repo.insert(makeEntry({ action: 'visit.complete' }));
    await repo.insert(makeEntry({ action: 'treatment.performed' }));
    await repo.insert(makeEntry({ action: 'invoice.voided' }));

    const page1 = await repo.list({ actorId: ACTOR_A }, { limit: 2, offset: 0 });
    expect(page1.entries.length).toBe(2);
    expect(page1.total).toBe(3);

    const page2 = await repo.list({ actorId: ACTOR_A }, { limit: 2, offset: 2 });
    expect(page2.entries.length).toBe(1);
  });

  test('insert() stores before/after snapshots (jsonb round-trip)', async () => {
    const before = { status: 'issued', totalCents: 10000 };
    const after  = { status: 'voided', voidedAt: '2026-05-26' };

    const entry = await repo.insert(makeEntry({
      action: 'invoice.voided',
      targetType: 'dental_invoice',
      beforeSnapshot: before,
      afterSnapshot: after,
    }));

    expect(entry.beforeSnapshot).toEqual(before);
    expect(entry.afterSnapshot).toEqual(after);
  });
});

describe('IDEAL-GAP-P1-001: AUD-BR-004 — required fields via logAuditEvent', () => {
  test('AUD-BR-004: entry has actorId, action, targetType, timestamp, tenantId', async () => {
    await logAuditEvent(db, null, {
      personId: ACTOR_A,
      tenantId: TENANT_A,
      branchId: BRANCH_A,
      action: 'invoice.voided',
      resourceType: 'dental_invoice',
      resourceId: TARGET_A,
    });

    const { entries } = await repo.list(
      { action: 'invoice.voided', tenantId: TENANT_A },
      { limit: 10, offset: 0 },
    );
    const entry = entries[0]!;
    expect(entry.actorId).toBeDefined();
    expect(entry.action).toBe('invoice.voided');
    expect(entry.targetType).toBe('dental_invoice');
    expect(entry.timestamp).toBeDefined();
    expect(entry.tenantId).toBe(TENANT_A);
    expect(entry.branchId).toBe(BRANCH_A);
  });

  test('AUD-BR-004: before/after snapshots stored via logAuditEvent', async () => {
    await logAuditEvent(db, null, {
      personId: ACTOR_A,
      tenantId: TENANT_A,
      action: 'visit.complete',
      resourceType: 'dental_visit',
      resourceId: TARGET_A,
      before: { status: 'active' },
      after: { status: 'completed' },
    });

    const { entries } = await repo.list(
      { action: 'visit.complete', tenantId: TENANT_A },
      { limit: 10, offset: 0 },
    );
    const entry = entries[0]!;
    expect(entry.beforeSnapshot).toEqual({ status: 'active' });
    expect(entry.afterSnapshot).toEqual({ status: 'completed' });
  });

  test('AC-003: list() filters by branchId — only returns events from matching branch', async () => {
    await repo.insert(makeEntry({ branchId: BRANCH_A, action: 'visit.complete', tenantId: TENANT_A }));
    await repo.insert(makeEntry({ branchId: BRANCH_B, action: 'visit.complete', tenantId: TENANT_A }));

    const { entries, total } = await repo.list({ branchId: BRANCH_A }, { limit: 10, offset: 0 });
    expect(total).toBe(1);
    expect(entries[0]?.branchId).toBe(BRANCH_A);
  });
});

// ----------------------------------------------------------------------------
// V-AUD-NEW-A (P1): snapshots must be PHI-sanitized at rest.
// before/after JSONB are persisted into an append-only, never-deleted table, so
// any PHI baked in is unremediable (AC-AUD-004 / "No PHI in log body"). Sanitize
// recursively before persisting.
// ----------------------------------------------------------------------------
describe('V-AUD-NEW-A: PHI sanitization of before/after snapshots', () => {
  test('strips top-level PHI keys from before/after snapshots', async () => {
    await logAuditEvent(db, null, {
      personId: ACTOR_A,
      tenantId: TENANT_A,
      action: 'patient.update',
      resourceType: 'dental_patient',
      resourceId: TARGET_A,
      before: {
        id: TARGET_A,
        status: 'active',
        displayName: 'Jane Doe',
        dateOfBirth: '1990-01-01',
        email: 'jane@example.com',
        diagnosis: 'caries',
      },
      after: {
        id: TARGET_A,
        status: 'archived',
        displayName: 'Jane Doe',
      },
    });

    const { entries } = await repo.list(
      { action: 'patient.update', tenantId: TENANT_A },
      { limit: 10, offset: 0 },
    );
    const entry = entries[0]!;
    const before = entry.beforeSnapshot as Record<string, unknown>;
    const after = entry.afterSnapshot as Record<string, unknown>;

    // Non-PHI keys preserved.
    expect(before['id']).toBe(TARGET_A);
    expect(before['status']).toBe('active');
    // PHI keys stripped.
    expect(before).not.toHaveProperty('displayName');
    expect(before).not.toHaveProperty('dateOfBirth');
    expect(before).not.toHaveProperty('email');
    expect(before).not.toHaveProperty('diagnosis');

    expect(after['status']).toBe('archived');
    expect(after).not.toHaveProperty('displayName');

    // No PHI value anywhere in the persisted row.
    expect(JSON.stringify(entry)).not.toContain('Jane Doe');
    expect(JSON.stringify(entry)).not.toContain('jane@example.com');
    expect(JSON.stringify(entry)).not.toContain('caries');
  });

  test('strips PHI keys nested in objects and arrays', async () => {
    const UNIQUE_TENANT = 'da010001-0000-0000-0000-000000000013';
    await logAuditEvent(db, null, {
      personId: ACTOR_A,
      tenantId: UNIQUE_TENANT,
      action: 'patient.update',
      resourceType: 'dental_patient',
      resourceId: TARGET_A,
      before: {
        status: 'active',
        nested: { firstName: 'Jane', lastName: 'Doe', count: 3 },
        contacts: [{ phone: '555-1234', label: 'home' }],
      },
    });

    const { entries } = await repo.list(
      { action: 'patient.update', tenantId: UNIQUE_TENANT },
      { limit: 10, offset: 0 },
    );
    const before = entries[0]!.beforeSnapshot as Record<string, unknown>;
    const nested = before['nested'] as Record<string, unknown>;
    const contacts = before['contacts'] as Array<Record<string, unknown>>;

    expect(before['status']).toBe('active');
    expect(nested['count']).toBe(3);
    expect(nested).not.toHaveProperty('firstName');
    expect(nested).not.toHaveProperty('lastName');
    expect(contacts[0]).not.toHaveProperty('phone');
    expect(contacts[0]?.['label']).toBe('home');

    expect(JSON.stringify(entries[0]!)).not.toContain('Jane');
    expect(JSON.stringify(entries[0]!)).not.toContain('555-1234');
  });

  test('null/undefined snapshots remain null (backward compatible)', async () => {
    const UNIQUE_TENANT = 'da010001-0000-0000-0000-000000000014';
    await logAuditEvent(db, null, {
      personId: ACTOR_A,
      tenantId: UNIQUE_TENANT,
      action: 'visit.complete',
      resourceType: 'dental_visit',
      resourceId: TARGET_A,
    });
    const { entries } = await repo.list(
      { action: 'visit.complete', tenantId: UNIQUE_TENANT },
      { limit: 10, offset: 0 },
    );
    expect(entries[0]!.beforeSnapshot).toBeNull();
    expect(entries[0]!.afterSnapshot).toBeNull();
  });
});
