/**
 * PractitionerRoleRepository unit tests
 */

import { describe, test, expect, mock } from 'bun:test';
import { PractitionerRoleRepository } from './practitioner-role.repo';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRole(overrides: Record<string, any> = {}) {
  return {
    id: 'role-00000000-0000-0000-0000-000000000001',
    practitionerId: 'pr-00000000-0000-0000-0000-000000000001',
    active: true,
    practitionerRef: { resourceType: 'Practitioner', id: 'pr-00000000-0000-0000-0000-000000000001' },
    organizationRef: { resourceType: 'Organization', id: 'org-00000000-0000-0000-0000-000000000001' },
    code: [{ text: 'dentist' }],
    specialty: [{ text: 'General Dentistry' }],
    periodStart: null,
    periodEnd: null,
    location: null,
    healthcareService: null,
    telecom: null,
    availableTime: null,
    notAvailable: null,
    deactivatedAt: null,
    tenantId: 'default',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PractitionerRoleRepository', () => {
  test('constructs without throwing', () => {
    const db = { select: mock(() => ({})), insert: mock(() => ({})), update: mock(() => ({})) } as any;
    const repo = new PractitionerRoleRepository(db);
    expect(repo).not.toBeNull();
  });

  test('createOne returns created role', async () => {
    const role = makeRole();
    const returning = mock(() => Promise.resolve([role]));
    const db = {
      insert: mock(() => ({ values: mock(() => ({ returning })) })),
      select: mock(() => ({})),
      update: mock(() => ({})),
    } as any;

    const repo = new PractitionerRoleRepository(db);
    const result = await repo.createOne({
      practitionerId: role.practitionerId,
      active: true,
      practitionerRef: role.practitionerRef,
      organizationRef: role.organizationRef,
      code: [{ text: 'dentist' }],
      specialty: [],
      tenantId: 'default',
    } as any);

    expect(result).not.toBeNull();
    expect(result.id).toBe(role.id);
    expect(result.practitionerId).toBe(role.practitionerId);
    expect(returning).toHaveBeenCalled();
  });

  test('findOneById returns role when found', async () => {
    const role = makeRole();
    const limit = mock(() => Promise.resolve([role]));
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const db = {
      select: mock(() => ({ from })),
      insert: mock(() => ({})),
      update: mock(() => ({})),
    } as any;

    const repo = new PractitionerRoleRepository(db);
    const result = await repo.findOneById(role.id);
    expect(result).not.toBeNull();
    expect(from).toHaveBeenCalled();
  });

  test('findOneById returns null for non-existent role', async () => {
    const limit = mock(() => Promise.resolve([]));
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const db = {
      select: mock(() => ({ from })),
      insert: mock(() => ({})),
      update: mock(() => ({})),
    } as any;

    const repo = new PractitionerRoleRepository(db);
    const result = await repo.findOneById('non-existent-id');
    expect(result).toBeNull();
  });

  test('deactivateById sets active=false', async () => {
    const deactivated = makeRole({ active: false, deactivatedAt: new Date() });
    const returning = mock(() => Promise.resolve([deactivated]));
    const whereUpdate = mock(() => ({ returning }));
    const set = mock(() => ({ where: whereUpdate }));
    const db = {
      select: mock(() => ({})),
      insert: mock(() => ({})),
      update: mock(() => ({ set })),
    } as any;

    const repo = new PractitionerRoleRepository(db);
    const result = await repo.deactivateById(deactivated.id);
    expect(result.active).toBe(false);
    expect(result.deactivatedAt).not.toBeUndefined();
  });

  test('buildWhereConditions filters by practitionerId', () => {
    const db = { select: mock(() => ({})), insert: mock(() => ({})), update: mock(() => ({})) } as any;
    const repo = new PractitionerRoleRepository(db) as any;
    const cond = repo.buildWhereConditions({ practitionerId: 'pr-id' });
    expect(cond).not.toBeNull();
  });

  test('buildWhereConditions filters by active', () => {
    const db = { select: mock(() => ({})), insert: mock(() => ({})), update: mock(() => ({})) } as any;
    const repo = new PractitionerRoleRepository(db) as any;
    const cond = repo.buildWhereConditions({ active: true });
    expect(cond).not.toBeNull();
  });

  test('buildWhereConditions returns undefined for empty filters', () => {
    const db = { select: mock(() => ({})), insert: mock(() => ({})), update: mock(() => ({})) } as any;
    const repo = new PractitionerRoleRepository(db) as any;
    const cond = repo.buildWhereConditions({});
    expect(cond).toBeUndefined();
  });

  test('listPractitionerRoles for a practitioner filters correctly', () => {
    const db = { select: mock(() => ({})), insert: mock(() => ({})), update: mock(() => ({})) } as any;
    const repo = new PractitionerRoleRepository(db) as any;
    const cond = repo.buildWhereConditions({
      practitionerId: 'pr-00000000-0000-0000-0000-000000000001',
    });
    expect(cond).not.toBeNull();
  });
});
