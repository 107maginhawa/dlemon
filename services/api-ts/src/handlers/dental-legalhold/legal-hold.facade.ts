/**
 * legal-hold.facade.ts
 *
 * Facade exposing the legal-hold predicate to the governance engines
 * (erasure, retention) — they import only this facade, never the legal-hold
 * repo/schema directly (Phase 10 boundary lint). A subject with ANY active
 * hold must not be erased or auto-retained.
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalLegalHolds } from './repos/legal-hold.schema';

/** True if the person has at least one ACTIVE legal hold. */
export async function isPersonUnderLegalHold(db: DatabaseInstance, subjectPersonId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: dentalLegalHolds.id })
    .from(dentalLegalHolds)
    .where(and(eq(dentalLegalHolds.subjectPersonId, subjectPersonId), eq(dentalLegalHolds.status, 'active')))
    .limit(1);
  return !!row;
}

/** Subset of `personIds` that have an ACTIVE legal hold (batch — for retention). */
export async function personsUnderLegalHold(db: DatabaseInstance, personIds: string[]): Promise<Set<string>> {
  if (personIds.length === 0) return new Set();
  const rows = await db
    .select({ p: dentalLegalHolds.subjectPersonId })
    .from(dentalLegalHolds)
    .where(and(inArray(dentalLegalHolds.subjectPersonId, personIds), eq(dentalLegalHolds.status, 'active')));
  return new Set(rows.map((r) => r.p));
}
