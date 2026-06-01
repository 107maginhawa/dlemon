/**
 * Database connection factory functions without global state
 * Uses Drizzle ORM with PostgreSQL via pg.Pool or SQLite for embedded mode
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Logger } from '@/types/logger';
import path from 'path';

export type Dialect = 'postgresql' | 'sqlite';

/**
 * Detect the dialect from a DATABASE_URL string.
 *
 * - `postgres://...` or `postgresql://...` → 'postgresql'
 * - `sqlite://...` or `:memory:` or path ending in `.db`/`.sqlite` → 'sqlite'
 * - Defaults to 'postgresql'
 */
export function detectDialect(databaseUrl: string): Dialect {
  if (
    databaseUrl?.startsWith('sqlite://') ||
    databaseUrl === ':memory:' ||
    /\.(db|sqlite|sqlite3)$/i.test(databaseUrl || '')
  ) {
    return 'sqlite';
  }
  return 'postgresql';
}

/**
 * Database configuration
 *
 * Two modes:
 *  1. URL-driven (default): set `url` and `createDatabase` builds a Drizzle
 *     instance backed by pg.Pool (PostgreSQL).
 *  2. Pre-built instance (embedded mode): set `instance` to a Drizzle instance
 *     you've already built (e.g. via `drizzle-orm/sqlite-proxy` with native
 *     SQLite bindings from a Tauri host). `createApp` will skip `createDatabase`
 *     entirely and use the instance you provided.
 */
export interface DatabaseConfig {
  url: string;
  poolMin?: number;
  poolMax?: number;
  idleTimeoutMs?: number;
  ssl?: boolean;
  logging?: boolean;
  /**
   * V-DG-001 — PHI at-rest encryption attestation. The PHI at-rest control is
   * storage-layer (transparent disk/volume / managed-Postgres storage)
   * encryption, NOT column-level. This field records the operator's attestation
   * that the control is in force, parsed from `DB_AT_REST_ENCRYPTION`:
   *   - `enabled`    — encrypted volume / managed storage encryption provisioned
   *   - `verified`   — provisioned AND independently verified (cloud/KMS evidence)
   *   - `unverified` — not attested (default; refused at startup in production)
   * Asserted in the production guard in `parseConfig()` so it cannot silently
   * regress. See docs/product/DATA_GOVERNANCE.md §1 / §2 / §7 (AG-6 / G-012).
   */
  atRestEncryption?: 'enabled' | 'verified' | 'unverified';
  /**
   * Pre-built Drizzle instance. Used by `services/api-ts-embedded` to inject
   * a sqlite-proxy backend bridged to the host's native SQLite. When set,
   * `createApp` does not call `createDatabase` and `runMigrations` is skipped
   * (the embedded host owns schema management).
   *
   * Loosely typed because the injected instance may be a `sqlite-proxy`
   * Drizzle instance, which has a different concrete type from the default
   * `NodePgDatabase` but shares the same query interface.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance?: any;
}

/**
 * Database instance type - Drizzle instance with pg.Pool
 *
 * Stays narrow (`NodePgDatabase`) so the Bun-side typechecker keeps full
 * Drizzle inference. The embedded host's sqlite-proxy instance is type-
 * compatible at runtime via Drizzle's shared interface; embedded code
 * lives in `services/api-ts-embedded/src-js/` and is checked separately.
 */
export type DatabaseInstance = NodePgDatabase;

/**
 * Create a new database instance with the given configuration
 * Returns the Drizzle instance directly for simplified usage
 *
 * Dialect is auto-detected from the URL:
 * - `postgres://` or `postgresql://` → PostgreSQL
 * - `sqlite://` or `:memory:` or `.db`/`.sqlite` → SQLite
 *
 * For SQLite, prefer building the Drizzle instance externally with
 * `drizzle-orm/sqlite-proxy` and passing it via `config.instance` (see
 * `services/api-ts-embedded/src-js/entry.ts` for the canonical pattern).
 */
export function createDatabase(config: DatabaseConfig): DatabaseInstance {
  // Pre-built instance wins.
  if (config.instance) {
    return config.instance;
  }

  const dialect = detectDialect(config.url);

  if (dialect === 'sqlite') {
    // SQLite mode is reserved for embedded hosts that build their own
    // Drizzle instance via sqlite-proxy and inject it via `config.instance`.
    // The Bun server should always use PostgreSQL.
    throw new Error(
      'SQLite is only supported in embedded mode. ' +
      'Build a Drizzle instance with drizzle-orm/sqlite-proxy ' +
      'and pass it via config.database.instance.'
    );
  }

  // PostgreSQL mode
  let schemaName: string | null = null;
  let cleanUrl = config.url;

  try {
    const url = new URL(config.url);
    schemaName = url.searchParams.get('schema');

    // Remove schema from connection string (pg doesn't support it as a connection parameter)
    if (schemaName) {
      url.searchParams.delete('schema');
      cleanUrl = url.toString();
    }
  } catch {
    // If URL parsing fails, use original URL
    cleanUrl = config.url;
  }

  // Create PostgreSQL connection pool
  const pool = new Pool({
    connectionString: cleanUrl,
    max: config.poolMax || 20,
    min: config.poolMin || 2,
    idleTimeoutMillis: config.idleTimeoutMs || 30000,
    connectionTimeoutMillis: 5000,
    ssl: config.ssl
      ? {
          rejectUnauthorized: true,
        }
      : false,
  });

  // Set search_path for ALL connections in the pool (critical for test schema isolation)
  if (schemaName) {
    pool.on('connect', async (client) => {
      try {
        await client.query(`SET search_path TO "${schemaName}", public`);
      } catch (error) {
        console.error(`Failed to set search_path to ${schemaName}:`, error);
        throw error;
      }
    });
  }

  // Create and return Drizzle database instance directly
  return drizzle(pool, {
    logger: config.logging || false,
  });
}

/**
 * Check if database connection is healthy
 * Uses Drizzle's execute method for health checks
 */
export async function checkDatabaseConnection(
  dbInstance: DatabaseInstance, 
  logger?: Logger
): Promise<boolean> {
  try {
    // Use Drizzle's execute method for health check
    await dbInstance.execute('SELECT 1 as health_check');
    return true;
  } catch (error) {
    if (logger) {
      logger.error({ error }, 'Database health check failed');
    }
    return false;
  }
}

/**
 * Close database connection and cleanup resources
 * Accesses underlying pg.Pool through $client property
 */
export async function closeDatabaseConnection(dbInstance: DatabaseInstance): Promise<void> {
  // Access the underlying pg.Pool and close it
  const pool = (dbInstance as any).$client;
  if (pool && typeof pool.end === 'function') {
    await pool.end();
  }
}

/**
 * @deprecated Use ctx.get('database') directly instead
 * Helper function to get database instance from Hono context
 * Returns the Drizzle instance directly for database operations
 */
export function getDatabaseFromContext(ctx: any): DatabaseInstance {
  const database = ctx.get('database');
  if (!database) {
    throw new Error('Database instance not found in context. Make sure dependency injection middleware is properly configured.');
  }
  return database;
}

/**
 * Run database migrations
 * Applies all pending migrations from the specified folder
 */
export async function runMigrations(
  dbInstance: DatabaseInstance, 
  migrationsFolder?: string
): Promise<void> {
  // Use absolute path to migrations directory
  const folder = migrationsFolder || path.join(__dirname, '../generated/migrations');

  await migrate(dbInstance, { migrationsFolder: folder });
}

