/**
 * Transaction isolation helper for DB integration tests.
 *
 * Wraps each test in a BEGIN/ROLLBACK transaction so tests are isolated
 * without needing TRUNCATE CASCADE. Faster and prevents cross-test state.
 *
 * Usage:
 *
 *   import { openTestTx } from '@/core/test-tx';
 *
 *   let teardown: () => Promise<void>;
 *   let repo: MyRepository;
 *
 *   beforeEach(async () => {
 *     const { db, rollback } = await openTestTx();
 *     repo = new MyRepository(db);
 *     teardown = rollback;
 *   });
 *
 *   afterEach(() => teardown());
 */

import { Pool, type PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const TEST_DB_URL = process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test';

// Shared pool — one Pool per process, not one per test.
// max: 2 keeps per-worker connections low. With ~20 parallel bun test workers
// this stays well under Postgres default max_connections=100.
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: TEST_DB_URL,
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000
    });
  }
  return _pool;
}

export interface TestTx {
  /** Drizzle instance scoped to a single in-progress transaction. */
  db: NodePgDatabase;
  /** Roll back the transaction and release the connection back to the pool. */
  rollback: () => Promise<void>;
}

/**
 * Open a transaction-scoped Drizzle instance for one test.
 * Always call `rollback()` in afterEach — even if the test throws.
 */
export async function openTestTx(): Promise<TestTx> {
  const client: PoolClient = await getPool().connect();
  await client.query('BEGIN');
  const db = drizzle(client) as NodePgDatabase;
  return {
    db,
    rollback: async () => {
      try {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    },
  };
}
