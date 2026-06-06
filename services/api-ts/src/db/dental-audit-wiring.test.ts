/**
 * IDEAL-GAP-P1-001: Audit handler wiring tests
 *
 * Verifies the dental_audit table is populated after clinical/billing events,
 * and that the branchId column exists and is filterable.
 *
 * AC-001 through AC-005: logAuditEvent contract tests
 * AC-003: branchId filter — TRUE RED until branchId added to schema
 * AUD-BR-004: required fields present on every entry
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { DentalAuditRepository } from './audit.repo';
import { logAuditEvent } from '@/core/audit-logger';

const PERSON_A = '00000000-0000-0000-0000-000000000001';
const TENANT_X = '00000000-0000-0000-0000-000000000010';
const BRANCH_A = '00000000-0000-0000-0000-000000000020';
const BRANCH_B = '00000000-0000-0000-0000-000000000021';
const RESOURCE_ID = '00000000-0000-0000-0000-000000000099';

let teardown: () => Promise<void>;
let repo: DentalAuditRepository;
let db: any;

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  repo = new DentalAuditRepository(tx.db as any);
  teardown = tx.rollback;
});

afterEach(async () => {
  await teardown();
});

describe('IDEAL-GAP-P1-001: Audit handler wiring contract', () => {
  test('AC-001: logAuditEvent writes visit.complete to dental_audit', async () => {
    await logAuditEvent(db, null, {
      personId: PERSON_A,
      tenantId: TENANT_X,
      action: 'visit.complete',
      resourceType: 'dental_visit',
      resourceId: RESOURCE_ID,
    });
    const { total, entries } = await repo.query(
      { action: 'visit.complete', tenantId: TENANT_X },
      { limit: 10, offset: 0 },
    );
    expect(total).toBe(1);
    expect(entries[0]?.action).toBe('visit.complete');
    expect(entries[0]?.personId).toBe(PERSON_A);
  });

  test('AC-002: logAuditEvent writes treatment.performed to dental_audit', async () => {
    await logAuditEvent(db, null, {
      personId: PERSON_A,
      tenantId: TENANT_X,
      action: 'treatment.performed',
      resourceType: 'dental_treatment',
      resourceId: RESOURCE_ID,
    });
    const { total } = await repo.query(
      { action: 'treatment.performed', tenantId: TENANT_X },
      { limit: 10, offset: 0 },
    );
    expect(total).toBe(1);
  });

  // AC-003: TRUE RED — branchId column not in schema yet.
  // repo.log() with branchId will throw a DB error (column unknown),
  // and query({ branchId }) filter won't exist in AuditFilters.
  test('AC-003: query() filters by branchId — only returns events from matching branch', async () => {
    await repo.log({
      personId: PERSON_A,
      tenantId: TENANT_X,
      branchId: BRANCH_A,
      action: 'visit.complete',
      resourceType: 'dental_visit',
      resourceId: RESOURCE_ID,
    } as any);
    await repo.log({
      personId: PERSON_A,
      tenantId: TENANT_X,
      branchId: BRANCH_B,
      action: 'visit.complete',
      resourceType: 'dental_visit',
    } as any);

    const { entries, total } = await repo.query(
      { branchId: BRANCH_A } as any,
      { limit: 10, offset: 0 },
    );
    expect(total).toBe(1);
    expect((entries[0] as any)?.branchId).toBe(BRANCH_A);
  });

  test('AUD-BR-004: audit entry has all required fields', async () => {
    await logAuditEvent(db, null, {
      personId: PERSON_A,
      tenantId: TENANT_X,
      action: 'invoice.voided',
      resourceType: 'dental_invoice',
      resourceId: RESOURCE_ID,
    });
    const { entries } = await repo.query(
      { action: 'invoice.voided', tenantId: TENANT_X },
      { limit: 10, offset: 0 },
    );
    const entry = entries[0]!;
    expect(entry.personId).toBeDefined();
    expect(entry.action).toBeDefined();
    expect(entry.resourceType).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(entry.tenantId).toBeDefined();
  });

  test('AC-005: logAuditEvent writes discount.applied to dental_audit', async () => {
    await logAuditEvent(db, null, {
      personId: PERSON_A,
      tenantId: TENANT_X,
      action: 'discount.applied',
      resourceType: 'dental_invoice',
      resourceId: RESOURCE_ID,
      metadata: { percentageRate: 10, reason: 'Student discount' },
    });
    const { total } = await repo.query(
      { action: 'discount.applied', tenantId: TENANT_X },
      { limit: 10, offset: 0 },
    );
    expect(total).toBe(1);
  });
});
