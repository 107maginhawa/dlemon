/**
 * GAP-010: dental_audit before/after jsonb round-trip
 *
 * AC-001 before/after fields stored and returned by DentalAuditRepository
 */
import { describe, test, expect } from 'bun:test';
import { createDatabase } from '@/core/database';
import { DentalAuditRepository } from './audit.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });
const repo = new DentalAuditRepository(db);

const ACTOR_ID = 'a0000000-0000-1000-8000-000000000001';
const TENANT_ID = 'c0000000-0000-1000-8000-000000000044';

describe('GAP-010: audit before/after fields', () => {
  test('AC-001: before/after round-trip through DentalAuditRepository.log()', async () => {
    const entry = await repo.log({
      personId: ACTOR_ID,
      action: 'visit.complete',
      resourceType: 'dental_visit',
      resourceId: 'a0000000-0000-1000-8000-000000000099',
      tenantId: TENANT_ID,
      before: { status: 'active' },
      after: { status: 'completed' },
    });
    expect(entry.before).toEqual({ status: 'active' });
    expect(entry.after).toEqual({ status: 'completed' });
  });

  test('AC-002: before/after are optional (null when not provided)', async () => {
    const entry = await repo.log({
      personId: ACTOR_ID,
      action: 'patient.view',
      resourceType: 'dental_patient',
      tenantId: TENANT_ID,
    });
    expect(entry.before).toBeNull();
    expect(entry.after).toBeNull();
  });
});
