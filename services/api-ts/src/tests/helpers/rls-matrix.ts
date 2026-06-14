/**
 * Shared RLS isolation matrix — the per-table cross-tenant CRUD-denial assertions
 * for the ADR-010 Row-Level-Security gate (P1a+).
 *
 * The dental_visit Stage-0 test (handlers/dental-visit/dental-visit.rls-isolation.test.ts)
 * proves the MECHANISM end-to-end. Every other Tier-1 table shares the identical
 * set-valued policy shape, so its per-table test only needs to assert that the
 * migration actually armed THIS table with THIS tenant column. This helper runs
 * that uniform matrix against any table, given a way to read its row ids and a way
 * to attempt an out-of-scope insert.
 *
 * Assertions (run as the app_rls role via withTenantTx, except the baseline):
 *   1. baseline — the plain postgres connection still sees BOTH rows (RLS did not
 *      change the superuser bypass path → zero runtime change).
 *   2/3. isolation — scope [A] sees only A's row; scope [B] sees only B's.
 *   4. set-valued (D1) — scope [A, B] sees BOTH (the multi-branch read).
 *   5. fail-closed — an EMPTY scope sees neither row.
 *   6. fail-closed — app_rls with the GUC never published sees neither row.
 *   7. WITH CHECK — a write into the out-of-scope (B) tenant is rejected.
 *
 * Assertions key off the two SEEDED ids (idA/idB), never total row counts, so the
 * matrix is robust to anything else a test's own clone may contain.
 */

import { sql } from 'drizzle-orm';
import { expect, test } from 'bun:test';
import type { DatabaseInstance } from '@/core/database';
import { withTenantTx, type TenantScope } from '@/core/tenant-tx';

export interface RlsMatrixCase {
  db: DatabaseInstance;
  /** Human label for the test names, e.g. 'dental_invoice'. */
  label: string;
  /** The in-scope tenant value for the "A" rows (branch_id, or organization_id for org tables). */
  tenantA: string;
  /** The in-scope tenant value for the "B" rows. */
  tenantB: string;
  /** Id of the seeded row that belongs to tenant A. */
  idA: string;
  /** Id of the seeded row that belongs to tenant B. */
  idB: string;
  /** Which GUC the table's policy keys off. 'branch' (default) covers branch_id and
   *  the audit-log tenant_id (which holds a branch uuid); 'org' covers organization_id. */
  scopeKind?: 'branch' | 'org';
  /** Reads the ids of THIS table visible to the given executor (db or tx). */
  selectIds: (exec: DatabaseInstance) => Promise<{ id: string }[]>;
  /** Attempts to INSERT a fresh row into tenant B. Used to assert WITH CHECK
   *  rejects it when the active scope is [A]. */
  insertIntoB: (exec: DatabaseInstance) => Promise<unknown>;
}

function makeScope(kind: 'branch' | 'org', values: string[]): TenantScope {
  return kind === 'org' ? { branchIds: [], orgIds: values } : { branchIds: values };
}

/**
 * Registers the full RLS isolation matrix as bun `test(...)` cases for one table.
 * Call inside a `describe(...)` block after the table's A/B rows are seeded.
 */
export function registerRlsMatrix(c: RlsMatrixCase): void {
  const kind = c.scopeKind ?? 'branch';
  const idsVisibleUnder = async (scope: TenantScope) =>
    (await withTenantTx(c.db, scope, (tx) => c.selectIds(tx))).map((r) => r.id);

  test(`${c.label}: baseline — postgres superuser still sees BOTH rows (zero runtime change)`, async () => {
    const ids = (await c.selectIds(c.db)).map((r) => r.id);
    expect(ids).toContain(c.idA);
    expect(ids).toContain(c.idB);
  });

  test(`${c.label}: isolation — scope [A] sees only A`, async () => {
    const ids = await idsVisibleUnder(makeScope(kind, [c.tenantA]));
    expect(ids).toContain(c.idA);
    expect(ids).not.toContain(c.idB);
  });

  test(`${c.label}: isolation — scope [B] sees only B`, async () => {
    const ids = await idsVisibleUnder(makeScope(kind, [c.tenantB]));
    expect(ids).toContain(c.idB);
    expect(ids).not.toContain(c.idA);
  });

  test(`${c.label}: set-valued (D1) — scope [A, B] sees BOTH`, async () => {
    const ids = await idsVisibleUnder(makeScope(kind, [c.tenantA, c.tenantB]));
    expect(ids).toContain(c.idA);
    expect(ids).toContain(c.idB);
  });

  test(`${c.label}: fail-closed — EMPTY scope sees neither row`, async () => {
    const ids = await idsVisibleUnder(makeScope(kind, []));
    expect(ids).not.toContain(c.idA);
    expect(ids).not.toContain(c.idB);
  });

  test(`${c.label}: fail-closed — app_rls with the GUC unset sees neither row`, async () => {
    const ids = await c.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE app_rls`);
      return (await c.selectIds(tx as unknown as DatabaseInstance)).map((r) => r.id);
    });
    expect(ids).not.toContain(c.idA);
    expect(ids).not.toContain(c.idB);
  });

  test(`${c.label}: WITH CHECK — a write into the out-of-scope tenant is rejected`, async () => {
    await expect(
      withTenantTx(c.db, makeScope(kind, [c.tenantA]), (tx) => c.insertIntoB(tx)),
    ).rejects.toThrow();
  });
}
