/**
 * DentalAuditRepository integration tests
 *
 * Each test is isolated in a rolled-back transaction via openTestTx.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { DentalAuditRepository } from './audit.repo';
import type { NewDentalAuditEntry } from './audit.schema';

// "d9aa" namespace — won't collide with seed data or other test suites
const PERSON_A = 'd9aa0001-0000-0000-0000-000000000001';
const PERSON_B = 'd9aa0001-0000-0000-0000-000000000002';
const TENANT_X = 'd9aa0001-0000-0000-0000-000000000010';
const TENANT_Y = 'd9aa0001-0000-0000-0000-000000000011';
const RESOURCE_ID = 'd9aa0001-0000-0000-0000-000000000099';

function makeEntry(overrides: Partial<NewDentalAuditEntry> = {}): NewDentalAuditEntry {
  return {
    personId: PERSON_A,
    tenantId: TENANT_X,
    action: 'visit.create',
    resourceType: 'dental_visit',
    resourceId: RESOURCE_ID,
    metadata: null,
    ...overrides,
  };
}

let teardown: () => Promise<void>;
let repo: DentalAuditRepository;

beforeEach(async () => {
  const { db, rollback } = await openTestTx();
  repo = new DentalAuditRepository(db as any);
  teardown = rollback;
});

afterEach(async () => {
  await teardown();
});

describe('DentalAuditRepository', () => {
  test('log() inserts a row', async () => {
    await repo.log(makeEntry());

    const { entries, total } = await repo.query({ personId: PERSON_A }, { limit: 10, offset: 0 });
    expect(total).toBe(1);
    expect(entries[0]?.action).toBe('visit.create');
    expect(entries[0]?.resourceType).toBe('dental_visit');
  });

  test('query() filters by personId', async () => {
    await repo.log(makeEntry({ personId: PERSON_A }));
    await repo.log(makeEntry({ personId: PERSON_B, action: 'patient.view' }));

    const { entries, total } = await repo.query({ personId: PERSON_A }, { limit: 10, offset: 0 });
    expect(total).toBe(1);
    expect(entries[0]?.personId).toBe(PERSON_A);
  });

  test('query() filters by tenantId', async () => {
    await repo.log(makeEntry({ tenantId: TENANT_X }));
    await repo.log(makeEntry({ tenantId: TENANT_Y, action: 'patient.view' }));

    const { entries, total } = await repo.query({ tenantId: TENANT_Y }, { limit: 10, offset: 0 });
    expect(total).toBe(1);
    expect(entries[0]?.tenantId).toBe(TENANT_Y);
  });

  test('query() filters by resourceType', async () => {
    await repo.log(makeEntry({ resourceType: 'dental_visit' }));
    await repo.log(makeEntry({ resourceType: 'dental_patient', action: 'patient.view', resourceId: undefined }));

    // Scope by tenantId too — avoids matching committed seed rows with the same resourceType
    const { entries } = await repo.query({ resourceType: 'dental_patient', tenantId: TENANT_X }, { limit: 10, offset: 0 });
    expect(entries.length).toBe(1);
    expect(entries[0]?.resourceType).toBe('dental_patient');
  });

  test('query() returns empty when no match', async () => {
    await repo.log(makeEntry());

    const { entries, total } = await repo.query({ personId: PERSON_B }, { limit: 10, offset: 0 });
    expect(total).toBe(0);
    expect(entries).toHaveLength(0);
  });

  test('query() respects limit/offset pagination', async () => {
    await repo.log(makeEntry({ action: 'visit.create' }));
    await repo.log(makeEntry({ action: 'visit.update' }));
    await repo.log(makeEntry({ action: 'visit.lock' }));

    const page1 = await repo.query({ personId: PERSON_A }, { limit: 2, offset: 0 });
    expect(page1.entries.length).toBe(2);
    expect(page1.total).toBe(3);

    const page2 = await repo.query({ personId: PERSON_A }, { limit: 2, offset: 2 });
    expect(page2.entries.length).toBe(1);
  });
});
