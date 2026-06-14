/**
 * withTenantTx — the request-side half of the ADR-010 Row-Level-Security gate.
 * (The DB half — the app_rls role, the app_current_branches() helper, and the
 * per-table policies — lives in migration 0104+. See
 * docs/decisions/ADR-010-rls-implementation-plan.md.)
 *
 * On PostgreSQL it opens a transaction, publishes the caller's in-scope branch
 * set to the `app.current_branches` GUC, and `SET LOCAL ROLE app_rls` so the
 * table-owning postgres superuser's RLS bypass no longer applies. Inside the
 * callback, every query against an RLS-enabled table is filtered by the policies
 * to that branch set; a query that touches such a table with an EMPTY or missing
 * set sees zero rows (fail-closed). Both the GUC (`is_local => true`) and the role
 * (`SET LOCAL ROLE`) are transaction-local, so they revert when the tx ends —
 * safe on a pooled connection.
 *
 * On the embedded SQLite path (services/api-ts-embedded) there is no RLS and the
 * device is single-tenant, so this is a transparent no-op: the callback runs
 * directly against the injected instance.
 *
 * NOT YET WIRED into handlers. P0 introduces the helper and validates the
 * mechanism (see dental-visit.rls-isolation.test.ts); later phases route
 * tenant-scoped handlers through it. Admin / deliberately-cross-tenant paths
 * (the erasure queue, the audit-log list) must NOT use it — they stay on the
 * bypassing superuser connection.
 */

import { sql } from 'drizzle-orm';
import type { DatabaseInstance } from './database';

export interface TenantScope {
  /**
   * The caller's in-scope branch UUIDs. The key is SET-VALUED (not a single
   * branch) on purpose: multi-branch users and the cross-branch billing reports
   * (EM-BIL-002) legitimately read across several branches in one request. An
   * empty array ⇒ every RLS-enabled table returns zero rows.
   */
  branchIds: string[];
  /** Optional org UUID for the few org-level RLS tables (later phases). */
  orgId?: string;
}

/**
 * True when `db` is the node-postgres-backed instance (vs an embedded
 * sqlite-proxy one). node-postgres exposes the pg `Pool` as `$client` (a pool has
 * query/end/connect); the sqlite-proxy `$client` is the async callback function,
 * which has none of those methods.
 */
function isPostgresDatabase(db: DatabaseInstance): boolean {
  const client = (db as unknown as {
    $client?: { query?: unknown; end?: unknown; connect?: unknown };
  }).$client;
  return (
    !!client &&
    typeof client.query === 'function' &&
    typeof client.end === 'function' &&
    typeof client.connect === 'function'
  );
}

export async function withTenantTx<T>(
  db: DatabaseInstance,
  scope: TenantScope,
  fn: (tx: DatabaseInstance) => Promise<T>,
): Promise<T> {
  // Embedded / SQLite single-tenant device: no RLS, transparent pass-through.
  if (!isPostgresDatabase(db)) {
    return fn(db);
  }

  return db.transaction(async (tx) => {
    // Publish the tenant context as the privileged connecting role, THEN drop to
    // app_rls. set_config(..., is_local => true) == SET LOCAL — transaction-scoped.
    const branchCsv = scope.branchIds.join(',');
    await tx.execute(sql`SELECT set_config('app.current_branches', ${branchCsv}, true)`);
    if (scope.orgId !== undefined) {
      await tx.execute(sql`SELECT set_config('app.current_org', ${scope.orgId}, true)`);
    }
    await tx.execute(sql`SET LOCAL ROLE app_rls`);
    return fn(tx as unknown as DatabaseInstance);
  });
}
