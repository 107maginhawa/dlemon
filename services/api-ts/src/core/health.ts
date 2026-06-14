/**
 * Health check endpoints for Kubernetes liveness and readiness probes
 * Provides standardized health endpoints following Kubernetes conventions
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { App } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { checkDatabaseConnection } from '@/core/database';
import { evaluateSchemaDrift, type SchemaDriftResult } from '@/core/schema-drift';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOURNAL_PATH = path.join(__dirname, '../generated/migrations/meta/_journal.json');

/** Migration files the running code ships (drizzle journal). Read once at startup. */
function migrationFilesOnDisk(): number {
  try {
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as { entries?: unknown[] };
    return Array.isArray(journal.entries) ? journal.entries.length : 0;
  } catch {
    return 0;
  }
}
const MIGRATION_FILES_ON_DISK = migrationFilesOnDisk();

/**
 * Query the DB for migration + app_rls-grant counts and classify drift. Returns
 * null if the counts can't be read (e.g. the embedded SQLite path, or a transient
 * catalog error) — callers must treat null as "unknown", NOT as unhealthy, so a
 * probe hiccup never self-inflicts an outage. A definitive `behind`/`rls-ungranted`
 * verdict (Plan D) DOES fail readiness: a DB behind on migrations cannot serve RLS
 * writes (the live-incident cause).
 */
async function checkSchemaDrift(
  database: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger?: { warn?: (...args: any[]) => void },
): Promise<SchemaDriftResult | null> {
  try {
    const applied = (await database.execute(
      sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
    )) as unknown as { rows: Array<{ count: number }> };
    const grants = (await database.execute(
      sql`SELECT count(DISTINCT table_name)::int AS count
            FROM information_schema.role_table_grants
           WHERE grantee = 'app_rls'`,
    )) as unknown as { rows: Array<{ count: number }> };
    const result = evaluateSchemaDrift({
      migrationsApplied: Number(applied.rows[0]?.count ?? 0),
      migrationFilesOnDisk: MIGRATION_FILES_ON_DISK,
      appRlsGrantTables: Number(grants.rows[0]?.count ?? 0),
    });
    if (!result.healthy) logger?.warn?.({ schemaDrift: result }, `readyz: schema drift — ${result.detail}`);
    return result;
  } catch {
    // Counts unavailable (embedded SQLite, or transient) — unknown, not unhealthy.
    return null;
  }
}

/**
 * Register health check endpoints with the Hono app
 * Implements Kubernetes-compliant health check endpoints
 */
export function registerRoutes(app: App): void {
  const { database, storage, jobs, logger } = app;

  // Liveness probe - simple "is app alive?" check
  app.get('/livez', async (ctx) => {
    // Lightweight check - just verify the app process is running
    // No external dependency checks to avoid false negatives
    const isVerbose = ctx.req.query('verbose') !== undefined;
    
    if (isVerbose) {
      // RFC-compliant verbose response
      return ctx.json({
        status: 'pass',
        timestamp: new Date().toISOString(),
        checks: {
          ping: 'pass'
        }
      }, 200, {
        'Content-Type': 'application/health+json'
      });
    }
    
    // Kubernetes standard: simple text response
    ctx.header('Content-Type', 'text/plain');
    return ctx.text('ok', 200);
  });

  // Readiness probe - comprehensive "can app serve traffic?" check
  app.get('/readyz', async (ctx) => {
    const dbHealthy = await checkDatabaseConnection(database, logger);
    const storageHealthy = await storage.healthCheck();
    const jobsHealth = await jobs.getHealth();
    const jobsHealthy = jobsHealth.healthy;
    // Schema drift (Plan D): only query when the DB is otherwise reachable. A
    // definitive behind/ungranted verdict fails readiness; null = unknown = pass.
    const schema = dbHealthy ? await checkSchemaDrift(database, logger) : null;
    const schemaHealthy = schema === null ? true : schema.healthy;

    const allHealthy = dbHealthy && storageHealthy && jobsHealthy && schemaHealthy;
    const isVerbose = ctx.req.query('verbose') !== undefined;

    if (isVerbose) {
      // RFC-compliant verbose response
      return ctx.json({
        status: allHealthy ? 'pass' : 'fail',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealthy ? 'pass' : 'fail',
          storage: storageHealthy ? 'pass' : 'fail',
          jobs: jobsHealthy ? 'pass' : 'fail',
          schema: schema === null ? 'unknown' : schema.healthy ? 'pass' : 'fail',
        },
        // Surface the drift detail so a behind DB is diagnosable from the probe alone.
        ...(schema && !schema.healthy
          ? { schemaDrift: { status: schema.status, detail: schema.detail, migrationsApplied: schema.migrationsApplied, migrationFilesOnDisk: schema.migrationFilesOnDisk, appRlsGrantTables: schema.appRlsGrantTables } }
          : {}),
      }, allHealthy ? 200 : 503, {
        'Content-Type': 'application/health+json'
      });
    }
    
    // Kubernetes standard: simple text response
    ctx.header('Content-Type', 'text/plain');
    return ctx.text(allHealthy ? 'ok' : 'failed', allHealthy ? 200 : 503);
  });

}