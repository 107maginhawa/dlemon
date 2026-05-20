/**
 * Shared database schema definitions and helpers
 * Provides base entity fields and interfaces for consistency across all tables
 */

import { uuid, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { eq, sql, type AnyColumn } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Base entity fields that all tables should include
 * Provides standard audit and tracking fields
 */
export const baseEntityFields = {
  // Primary key
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // Optimistic locking
  version: integer('version').default(1).notNull(),
  
  // Audit fields - who performed the action
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

/**
 * BaseEntity interface for TypeScript type consistency
 * All entity types should extend this interface
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Column-set builder for append-only versioned snapshot tables.
 *
 * WHY NOT baseEntityFields: baseEntityFields.version is an optimistic-lock counter
 * (default 1) used by mutable entities. Snapshot tables use `version` as a monotonic
 * revision number (1, 2, 3…) set by createSnapshotVersion — a semantic collision that
 * would cause confusion and subtle bugs if baseEntityFields were reused here.
 *
 * Consumer tables MUST add their own parent FK column (e.g. imageId, noteId) and
 * define unique(parentFk, version) + index(parentFk) in the pgTable 2nd-arg callback.
 * Example:
 *   export const mySnapshots = pgTable('my_snapshot', {
 *     ...versionedSnapshotFields(),
 *     parentId: uuid('parent_id').notNull().references(() => myParent.id),
 *   }, (table) => ({
 *     uniqueParentVersion: unique('my_snapshot_parent_version_uniq').on(table.parentId, table.version),
 *     parentIdx: index('my_snapshot_parent_idx').on(table.parentId),
 *   }));
 */
export function versionedSnapshotFields() {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    createdBy: uuid('created_by'),
    // Monotonic snapshot revision (1, 2, 3…) — NOT an optimistic-lock counter.
    // Set by createSnapshotVersion via max(version)+1 with unique-violation retry.
    version: integer('version').notNull(),
    snapshot: jsonb('snapshot').notNull().$type<Record<string, unknown>>(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTable = { [key: string]: AnyColumn | any };

const MAX_VERSION_RETRIES = 5;

/** Postgres unique-violation SQLSTATE code */
const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  const code = (err as any)?.cause?.code ?? (err as any)?.code;
  return code === PG_UNIQUE_VIOLATION;
}

/**
 * Atomic-safe insert helper for append-only versioned snapshot tables.
 *
 * Fixes the non-atomic race in the naive SELECT max(version)+1 → INSERT pattern:
 * under READ COMMITTED isolation two concurrent transactions can both read the same
 * max before either commits, both compute the same next version, and one will fail
 * with a unique-constraint violation on (parentFk, version).
 *
 * This helper retries up to MAX_VERSION_RETRIES times on unique violation, which
 * handles concurrent writes gracefully without serializable isolation or advisory locks.
 *
 * @param db            - Drizzle NodePgDatabase instance
 * @param table         - The snapshot pgTable (must have version + snapshot columns)
 * @param parentColumn  - The parent FK column reference (e.g. imagingCephReports.imageId)
 * @param versionColumn - The version column reference (e.g. imagingCephReports.version)
 * @param parentId      - The parent FK value to scope the version counter to
 * @param insertValues  - Insert fields excluding `version` (computed here).
 *                        Caller casts the return to the concrete row type.
 * @returns The inserted row (typed unknown — caller casts to the concrete row type)
 */
export async function createSnapshotVersion(
  db: NodePgDatabase,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: AnyTable,
  parentColumn: AnyColumn,
  versionColumn: AnyColumn,
  parentId: string,
  insertValues: Record<string, unknown>,
): Promise<unknown> {
  if ('version' in insertValues) {
    throw new Error('createSnapshotVersion: insertValues must not contain "version" — it is computed internally');
  }
  for (let attempt = 0; attempt < MAX_VERSION_RETRIES; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [maxRow] = await (db as any)
        .select({ maxVersion: sql<number>`coalesce(max(${versionColumn}), 0)` })
        .from(table)
        .where(eq(parentColumn, parentId));
      const nextVersion = ((maxRow?.maxVersion as number) ?? 0) + 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [row] = await (db as any)
        .insert(table)
        .values({ ...insertValues, version: nextVersion })
        .returning();

      if (!row) throw new Error('createSnapshotVersion: insert returned no row');
      return row;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < MAX_VERSION_RETRIES - 1) continue;
      throw err;
    }
  }
  // Unreachable — loop always returns or throws, but TypeScript needs this.
  throw new Error('createSnapshotVersion: exhausted retries');
}