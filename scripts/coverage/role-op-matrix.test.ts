/**
 * role-op-matrix.test.ts — TDD for the role×operation drift detector.
 *
 * Run from repo root:  bun test ./scripts/coverage/role-op-matrix.test.ts
 * (the leading ./ is required for Bun path filters). These are root-level tests:
 * they do NOT trip the api-ts db-guard preload, so no DATABASE_URL is needed.
 */

import { describe, expect, test } from 'bun:test';
import {
  extractAllowedRolesFromSource,
  diffRoles,
} from './role-op-matrix';
import {
  loadRolePermissionMatrix,
  parseRolePermissionMatrix,
  PROSE_DOCUMENTED_GRANTS,
} from './lib/sources';

// ─────────────────────────────────────────────────────────────────────────────
// (a) assertBranchRole extractor
// ─────────────────────────────────────────────────────────────────────────────

describe('extractAllowedRolesFromSource', () => {
  test('extracts a single-line literal role array for the named function', () => {
    const src = `
export async function getAuditEvents(ctx) {
  const db = ctx.get('db');
  await assertBranchRole(db, user.id, branchId, ['dentist_owner']);
  return new Response();
}
`;
    expect(extractAllowedRolesFromSource(src, 'getAuditEvents')).toEqual(['dentist_owner']);
  });

  test('extracts a multiline literal role array', () => {
    const src = `
export async function createImagingStudy(ctx) {
  await assertBranchRole(db, user.id, body.branchId, [
    'dentist_owner',
    'dentist_associate',
    'hygienist',
    'dental_assistant',
  ]);
}
`;
    expect(extractAllowedRolesFromSource(src, 'createImagingStudy')).toEqual([
      'dentist_owner',
      'dentist_associate',
      'hygienist',
      'dental_assistant',
    ]);
  });

  test('returns "dynamic" when the role set is computed (spread of a variable)', () => {
    const src = `
export async function upsertVisitNotes(ctx) {
  const draftRoles =
    visit.visitType === 'hygiene'
      ? (['dentist_owner', 'dentist_associate', 'dental_assistant', 'hygienist'] as const)
      : (['dentist_owner', 'dentist_associate', 'dental_assistant'] as const);
  await assertBranchRole(db, user.id, visit.branchId, [...draftRoles]);
}
`;
    expect(extractAllowedRolesFromSource(src, 'upsertVisitNotes')).toBe('dynamic');
  });

  test('returns null when the named function has no assertBranchRole gate', () => {
    const src = `
export async function getThing(ctx) {
  await assertBranchAccess(db, user.id, branchId);
  return new Response();
}
`;
    expect(extractAllowedRolesFromSource(src, 'getThing')).toBeNull();
  });

  test('binds the gate to the right function in a multi-export file', () => {
    const src = `
export async function getFeeSchedule(ctx) {
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'dentist_associate']);
}

export async function updateFeeScheduleEntry(ctx) {
  await assertBranchRole(db, user.id, branchId, ['dentist_owner']);
}
`;
    expect(extractAllowedRolesFromSource(src, 'getFeeSchedule')).toEqual([
      'dentist_owner',
      'dentist_associate',
    ]);
    expect(extractAllowedRolesFromSource(src, 'updateFeeScheduleEntry')).toEqual(['dentist_owner']);
  });

  test('takes the FIRST assertBranchRole (primary gate) when a function has several', () => {
    const src = `
export async function updateAppointment(ctx) {
  await assertBranchRole(db, user.id, existing.branchId, [
    'dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling',
  ]);
  if (isReschedule) {
    await assertBranchRole(db, user.id, existing.branchId, ['dentist_owner', 'staff_full']);
  }
}
`;
    expect(extractAllowedRolesFromSource(src, 'updateAppointment')).toEqual([
      'dentist_owner',
      'dentist_associate',
      'staff_full',
      'staff_scheduling',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) matrix parser
// ─────────────────────────────────────────────────────────────────────────────

describe('parseRolePermissionMatrix', () => {
  const fixture = `
## Detailed Permission Statements

### Billing Write Operations

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Create invoice | ✅ | Own patients only | ❌ | ❌ |
| Void invoice | ✅ | ❌ | ❌ | ❌ |
| Record payment | ✅ | ✅ | ✅ | ❌ |

### Clinical Write Operations

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling | hygienist | dental_assistant |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| Sign visit notes | ✅ | ✅ | ❌ | ❌ | ✅ᴴ | ❌ |
`;

  test('maps a simple row to its allowed roles (Own = allow, ❌ = deny)', () => {
    const m = parseRolePermissionMatrix(fixture);
    expect(m.get('createDentalInvoice')).toEqual({
      roles: ['dentist_owner', 'dentist_associate'],
      conditional: [],
      hasConditional: false,
    });
  });

  test('a single-owner row only allows the owner', () => {
    const m = parseRolePermissionMatrix(fixture);
    expect(m.get('voidDentalInvoice')?.roles).toEqual(['dentist_owner']);
  });

  test('captures ✅ᴴ as a conditional (not a flat allow)', () => {
    const m = parseRolePermissionMatrix(fixture);
    const sign = m.get('signVisitNotes');
    expect(sign?.roles).toEqual(['dentist_owner', 'dentist_associate']);
    expect(sign?.conditional).toEqual(['hygienist']);
    expect(sign?.hasConditional).toBe(true);
  });

  test('does not key operations whose rows are absent from the table', () => {
    const m = parseRolePermissionMatrix(fixture);
    expect(m.has('createDentalVisit')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) diff
// ─────────────────────────────────────────────────────────────────────────────

describe('diffRoles', () => {
  test('no drift when code and spec allow the same set (order-insensitive)', () => {
    expect(
      diffRoles(['dentist_owner', 'dentist_associate'], {
        roles: ['dentist_associate', 'dentist_owner'],
        conditional: [],
        hasConditional: false,
      }),
    ).toBe(false);
  });

  test('drift when code allows a role the spec does not', () => {
    expect(
      diffRoles(['dentist_owner', 'staff_full'], {
        roles: ['dentist_owner'],
        conditional: [],
        hasConditional: false,
      }),
    ).toBe(true);
  });

  test('drift when the spec allows a role the code does not', () => {
    expect(
      diffRoles(['dentist_owner'], {
        roles: ['dentist_owner', 'dentist_associate'],
        conditional: [],
        hasConditional: false,
      }),
    ).toBe(true);
  });

  test('a dynamic code gate against a conditional spec is NOT drift', () => {
    expect(
      diffRoles('dynamic', {
        roles: ['dentist_owner', 'dentist_associate'],
        conditional: ['hygienist'],
        hasConditional: true,
      }),
    ).toBe(false);
  });

  test('a dynamic code gate against a flat (non-conditional) spec IS drift', () => {
    expect(
      diffRoles('dynamic', {
        roles: ['dentist_owner', 'dentist_associate'],
        conditional: [],
        hasConditional: false,
      }),
    ).toBe(true);
  });

  test('no spec to compare against → not drift (unmappable, reported separately)', () => {
    expect(diffRoles(['dentist_owner'], undefined)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) prose-documented grants (lossy tables completed from authoritative prose)
// ─────────────────────────────────────────────────────────────────────────────

describe('PROSE_DOCUMENTED_GRANTS', () => {
  test('every entry carries a sourceCitation', () => {
    for (const [opId, grant] of Object.entries(PROSE_DOCUMENTED_GRANTS)) {
      expect(grant.sourceCitation, `${opId} must cite its prose source`).toBeTruthy();
    }
  });

  test('the prose merge augments even when the table has no column for the role', () => {
    // A Clinical Write table with NO treatment_coordinator column — the grant
    // for createCasePresentation can only come from prose.
    const fixture = `
### Clinical Write Operations

| Operation | dentist_owner | dentist_associate |
|-----------|:---:|:---:|
| Present case / treatment plan | ✅ | ✅ |
`;
    const m = parseRolePermissionMatrix(fixture);
    const cp = m.get('createCasePresentation');
    expect(cp?.roles).toEqual(['dentist_owner', 'dentist_associate', 'treatment_coordinator']);
  });

  test('a conditional prose grant flips hasConditional so a dynamic code gate is non-drift', () => {
    const fixture = `
### Scheduling Write Operations

| Operation | dentist_owner | dentist_associate | staff_full |
|-----------|:---:|:---:|:---:|
| Check-in (creates visit) | ✅ | ✅ | ✅ |
`;
    const m = parseRolePermissionMatrix(fixture);
    const ci = m.get('checkInAppointment');
    expect(ci?.conditional).toEqual(['hygienist']);
    expect(ci?.hasConditional).toBe(true);
    // The code gate is dynamic (E3 visitType ternary) → must resolve to non-drift.
    expect(diffRoles('dynamic', ci)).toBe(false);
  });

  test('end-to-end against the real matrix: createCasePresentation spec includes treatment_coordinator', () => {
    const m = loadRolePermissionMatrix();
    expect(m.get('createCasePresentation')?.roles).toContain('treatment_coordinator');
  });

  test('end-to-end against the real matrix: checkInAppointment resolves non-drift for a dynamic gate', () => {
    const m = loadRolePermissionMatrix();
    const ci = m.get('checkInAppointment');
    expect(ci?.conditional).toContain('hygienist');
    expect(diffRoles('dynamic', ci)).toBe(false);
  });
});
