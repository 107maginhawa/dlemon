/**
 * IDEAL-GAP-P1-001 + P2-003/P2-004: AuditLogRepository + AUD-BR-004 tests
 *
 * Tests the spec-compliant dental_audit_log table (actorId, targetType, targetId,
 * beforeSnapshot, afterSnapshot) and verifies logAuditEvent wires into it.
 *
 * Each test is isolated in a rolled-back transaction via openTestTx.
 * "da01" UUID namespace — won't collide with seed data.
 */

import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
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

  // --------------------------------------------------------------------------
  // V-AUD-001 (AC-AUD-004) — NEGATIVE path: PHI in metadata is stripped at the
  // AuditLogRepository.insert choke point, so a forbidden PHI value is ABSENT
  // from the persisted row regardless of entry point. The append-only store
  // makes a leaked value unremediable, so the "negative" is: the forbidden
  // value must NOT be present anywhere in the row.
  // --------------------------------------------------------------------------
  test('V-AUD-001: PHI metadata keys are stripped at the repo choke point (forbidden value ABSENT)', async () => {
    const FORBIDDEN_PHI = 'Bob Patient bob@example.com';
    // Write DIRECTLY through the repository (bypassing logAuditEvent) to prove the
    // choke-point sanitizer — not the logger — is what removes PHI on EVERY path.
    const row = await repo.insert(
      makeEntry({
        action: 'patient.view',
        metadata: {
          resultCount: 1,
          name: 'Bob Patient',
          email: 'bob@example.com',
          diagnosis: 'caries',
        } as Record<string, unknown>,
      }),
    );

    const meta = row.metadata as Record<string, unknown>;
    // Non-PHI structural key survives.
    expect(meta['resultCount']).toBe(1);
    // PHI keys are stripped — the negative assertion (the forbidden keys are absent).
    expect(meta).not.toHaveProperty('name');
    expect(meta).not.toHaveProperty('email');
    expect(meta).not.toHaveProperty('diagnosis');
    // The forbidden PHI value appears NOWHERE in the persisted append-only row.
    expect(JSON.stringify(row)).not.toContain('Bob Patient');
    expect(JSON.stringify(row)).not.toContain('bob@example.com');
    expect(JSON.stringify(row)).not.toContain('caries');
  });

  // --------------------------------------------------------------------------
  // V-AUD-001 — failure path: a SECURITY-class audit write is fail-closed
  // (V-AUD-007). When the authoritative dental_audit_log write fails, the error
  // surfaces rather than being swallowed — a swallowed security-audit failure is
  // itself a compliance hole. Forcing the sink to fail must REJECT.
  // --------------------------------------------------------------------------
  test('V-AUD-001: a failing security-class audit write is fail-closed (rejects, not swallowed)', async () => {
    const spy = spyOn(AuditLogRepository.prototype, 'insert').mockImplementation(async () => {
      throw new Error('SECURITY_AUDIT_WRITE_FAILED: dental_audit_log sink unavailable');
    });
    try {
      await expect(
        logAuditEvent(db, null, {
          personId: ACTOR_A,
          tenantId: TENANT_A,
          action: 'tenant.access.denied',
          resourceType: 'dental_patient',
          resourceId: TARGET_A,
          eventType: 'security',
        }),
      ).rejects.toThrow(/SECURITY_AUDIT_WRITE_FAILED/);
    } finally {
      spy.mockRestore();
    }
  });
});

// ----------------------------------------------------------------------------
// AUD-BR-004 — NEGATIVE path: actorId is the TRUE session actor and can NEVER be
// overridden by caller-supplied data. A PHI/display "actor" field smuggled into
// metadata must be IGNORED (stripped) — it cannot become or replace the row's
// actorId, which stays the server-resolved session user.
// ----------------------------------------------------------------------------
describe('AUD-BR-004: actorId is the session user, never caller-supplied', () => {
  test('a caller-supplied actor display field in metadata cannot override actorId', async () => {
    const UNIQUE_TENANT = 'da010001-0000-0000-0000-000000000015';
    const ATTACKER_NAME = 'Mallory Impersonator';
    await logAuditEvent(db, null, {
      personId: ACTOR_A, // the TRUE actor (server-resolved session user)
      tenantId: UNIQUE_TENANT,
      action: 'patient.view',
      resourceType: 'dental_patient',
      resourceId: TARGET_A,
      metadata: {
        // Caller tries to smuggle a display "actor" name — it must NOT become the
        // row's actorId, and being a PHI-blocklisted key (`name`) it is stripped.
        name: ATTACKER_NAME,
        resultCount: 1,
      } as Record<string, unknown>,
    });

    const { entries } = await repo.list(
      { action: 'patient.view', tenantId: UNIQUE_TENANT },
      { limit: 10, offset: 0 },
    );
    const entry = entries[0]!;
    // actorId is the server-set session user — unchanged by the caller's payload.
    expect(entry.actorId).toBe(ACTOR_A);
    expect(entry.actorId).not.toBe(ATTACKER_NAME);
    // The smuggled PHI display name is stripped at the choke point and absent.
    const meta = entry.metadata as Record<string, unknown>;
    expect(meta).not.toHaveProperty('name');
    expect(meta['resultCount']).toBe(1); // non-PHI structural key survives
    expect(JSON.stringify(entry)).not.toContain(ATTACKER_NAME);
    // Mandatory fields still present + server-set timestamp.
    expect(entry.action).toBe('patient.view');
    expect(entry.targetType).toBe('dental_patient');
    expect(entry.timestamp).toBeDefined();
  });

  test('AUD-BR-004: a failing audit write surfaces (fail-closed) — actor integrity is not silently dropped', async () => {
    // The mandatory-field guarantee is meaningless if a write can vanish silently;
    // a security-class write that cannot persist must REJECT (V-AUD-007).
    const spy = spyOn(AuditLogRepository.prototype, 'insert').mockImplementation(async () => {
      throw new Error('AUDIT_WRITE_FAILED: cannot persist mandatory audit fields');
    });
    try {
      await expect(
        logAuditEvent(db, null, {
          personId: ACTOR_A,
          tenantId: TENANT_A,
          action: 'role.change',
          resourceType: 'membership',
          resourceId: TARGET_A,
          eventType: 'security',
        }),
      ).rejects.toThrow(/AUDIT_WRITE_FAILED/);
    } finally {
      spy.mockRestore();
    }
  });
});
