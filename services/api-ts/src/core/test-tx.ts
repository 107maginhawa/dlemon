/**
 * Transaction isolation helper for DB integration tests.
 *
 * Wraps each test in a Drizzle transaction so tests are isolated without needing
 * TRUNCATE CASCADE. Faster and prevents cross-test state.
 *
 * The transaction is a REAL `drizzle(client).transaction()` (not a manual
 * `BEGIN`), so a service that opens its own `db.transaction()` nests as a
 * SAVEPOINT rather than issuing a real `COMMIT` that would defeat per-test
 * isolation. Transaction-scoped advisory locks (`pg_advisory_xact_lock`) taken
 * by such services therefore release on the test's top-level rollback. This is
 * what lets services under test use `db.transaction(...)` freely.
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

/** Thrown from inside the parked transaction callback to force a ROLLBACK. */
const ROLLBACK_SENTINEL = Symbol('test-tx-rollback');

/**
 * Open a transaction-scoped Drizzle instance for one test.
 * Always call `rollback()` in afterEach — even if the test throws.
 *
 * Deferred-promise pattern: the test body runs OUTSIDE the transaction callback.
 * The callback opens a real Drizzle transaction (BEGIN), hands the `tx` handle
 * out, then parks on a gate until `rollback()` releases it and throws the
 * sentinel — which makes Drizzle ROLLBACK the whole transaction (and release any
 * advisory xact locks). Because the handle is a `NodePgTransaction`, any
 * `db.transaction()` a service opens nests as a SAVEPOINT.
 */
export async function openTestTx(): Promise<TestTx> {
  const client: PoolClient = await getPool().connect();
  const outer = drizzle(client);

  let releaseGate!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  let handOut!: (tx: NodePgDatabase) => void;
  let failReady!: (err: unknown) => void;
  const ready = new Promise<NodePgDatabase>((resolve, reject) => {
    handOut = resolve;
    failReady = reject;
  });

  // Drizzle runs BEGIN before invoking this callback, so by the time `ready`
  // resolves the transaction is live. The callback then parks until rollback().
  let handedOut = false;
  const txRun = outer
    .transaction(async (tx) => {
      handedOut = true;
      handOut(tx as unknown as NodePgDatabase);
      await gate;
      throw ROLLBACK_SENTINEL;
    })
    .catch((err) => {
      if (err === ROLLBACK_SENTINEL) return; // our own rollback signal
      if (!handedOut) {
        // Pre-handoff failure (e.g. BEGIN failed): surface via the awaiter so the
        // test fails loudly instead of hanging. No one awaits txRun in this path.
        failReady(err);
        return;
      }
      throw err; // real rollback/commit error — surfaced by rollback()'s await.
    });

  const db = await ready;

  return {
    db,
    rollback: async () => {
      releaseGate();
      try {
        await txRun;
      } finally {
        client.release();
      }
    },
  };
}
