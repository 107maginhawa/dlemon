import { describe, expect, test } from 'bun:test';
import { evaluateSchemaDrift, describeRlsPermissionError } from './schema-drift';

describe('evaluateSchemaDrift — code↔DB migration drift', () => {
  // AC-001: a fully-migrated, RLS-granted DB is current + healthy.
  test('AC-001: applied == on-disk and grants present → current, healthy', () => {
    const r = evaluateSchemaDrift({ migrationsApplied: 108, migrationFilesOnDisk: 108, appRlsGrantTables: 104 });
    expect(r.status).toBe('current');
    expect(r.healthy).toBe(true);
  });

  // AC-002: the incident — DB behind on migrations → not healthy, names the fix class.
  test('AC-002: applied < on-disk → behind, NOT healthy', () => {
    const r = evaluateSchemaDrift({ migrationsApplied: 104, migrationFilesOnDisk: 108, appRlsGrantTables: 104 });
    expect(r.status).toBe('behind');
    expect(r.healthy).toBe(false);
    expect(r.detail).toMatch(/behind/i);
  });

  // AC-003: migrations all applied but app_rls has no grants (missing the grant
  // migration) → the exact "permission denied" cause, not healthy.
  test('AC-003: zero app_rls grants → rls-ungranted, NOT healthy', () => {
    const r = evaluateSchemaDrift({ migrationsApplied: 108, migrationFilesOnDisk: 108, appRlsGrantTables: 0 });
    expect(r.status).toBe('rls-ungranted');
    expect(r.healthy).toBe(false);
  });

  // AC-004: DB ahead of code (API older than DB) → can still serve, healthy but flagged.
  test('AC-004: applied > on-disk → ahead, still healthy', () => {
    const r = evaluateSchemaDrift({ migrationsApplied: 110, migrationFilesOnDisk: 108, appRlsGrantTables: 104 });
    expect(r.status).toBe('ahead');
    expect(r.healthy).toBe(true);
  });

  // AC-005: behind takes precedence over ungranted (behind is the actionable root).
  test('AC-005: behind AND zero grants → reports behind (the root fix)', () => {
    const r = evaluateSchemaDrift({ migrationsApplied: 104, migrationFilesOnDisk: 108, appRlsGrantTables: 0 });
    expect(r.status).toBe('behind');
    expect(r.healthy).toBe(false);
  });
});

describe('describeRlsPermissionError — fail-loud drift hint', () => {
  // AC-006: a missing-grant permission-denied (SQLSTATE 42501) is rewritten with a
  // "DB likely behind on migrations" hint — the cryptic error the incident produced.
  test('AC-006: "permission denied for table" → drift hint', () => {
    const hint = describeRlsPermissionError({ code: '42501', message: 'permission denied for table dental_visit' });
    expect(hint).not.toBeNull();
    expect(hint).toMatch(/behind on migrations/i);
    expect(hint).toMatch(/dental_visit/);
  });

  // AC-007: a legitimate RLS POLICY write violation is ALSO SQLSTATE 42501 but is a
  // real tenant-isolation block, not drift — it must NOT be rewritten.
  test('AC-007: "new row violates row-level security policy" → null (not drift)', () => {
    const hint = describeRlsPermissionError({
      code: '42501',
      message: 'new row violates row-level security policy for table dental_visit',
    });
    expect(hint).toBeNull();
  });

  // AC-008: the pg error may arrive wrapped (drizzle puts it on `.cause`).
  test('AC-008: reads a permission-denied nested under .cause', () => {
    const hint = describeRlsPermissionError({
      message: 'query failed',
      cause: { code: '42501', message: 'permission denied for table dental_invoice' },
    });
    expect(hint).not.toBeNull();
    expect(hint).toMatch(/dental_invoice/);
  });

  // AC-009: an unrelated error is left alone.
  test('AC-009: unrelated error → null', () => {
    expect(describeRlsPermissionError({ code: '23505', message: 'duplicate key value' })).toBeNull();
    expect(describeRlsPermissionError(new Error('connection refused'))).toBeNull();
    expect(describeRlsPermissionError(undefined)).toBeNull();
  });
});
