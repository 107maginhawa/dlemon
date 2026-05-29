/**
 * visit-perio.facade.ts
 *
 * Facade exposing dental-visit data to dental-perio handlers.
 * Isolates cross-module access behind typed functions — dental-perio imports
 * only this file, never the underlying VisitRepository/schema directly
 * (Phase 10 boundary lint).
 *
 * Used by upsertToothReading (EF-PER-001): the parent visit must not be
 * completed or locked before a perio reading can be written.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalVisits } from './visit.schema';

export interface VisitStatusView {
  id: string;
  status: string;
}

/** Get the visit status fields needed by perio handlers, or null if not found. */
export async function getVisitForPerio(
  db: DatabaseInstance,
  visitId: string,
): Promise<VisitStatusView | null> {
  const [row] = await db
    .select({
      id: dentalVisits.id,
      status: dentalVisits.status,
    })
    .from(dentalVisits)
    .where(eq(dentalVisits.id, visitId))
    .limit(1);
  return row ?? null;
}
