/**
 * storage-imaging.facade.ts
 *
 * Facade exposing storage repo data to dental-imaging handlers.
 * Isolates cross-module access behind typed functions.
 */

import { inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { storedFiles } from './file.schema';

/**
 * Returns a map of fileId → size (bytes) for the given file IDs.
 * Files not found in the table are omitted from the result.
 * Used by dental-imaging to enrich image records with file size.
 */
export async function getFileSizesByIds(
  db: DatabaseInstance,
  fileIds: string[],
): Promise<Map<string, number>> {
  if (fileIds.length === 0) return new Map();

  const rows = await db
    .select({ id: storedFiles.id, size: storedFiles.size })
    .from(storedFiles)
    .where(inArray(storedFiles.id, fileIds));

  return new Map(rows.map((r) => [r.id, r.size]));
}
