/**
 * person-erasure.facade.ts
 *
 * Facade exposing Person PII anonymization to the `erasure` module (V-DG-002).
 * The erasure engine imports only this facade, never the person repo/schema
 * directly (Phase 10 boundary lint). Anonymization REDACTS PII in place and
 * keeps the row — never a hard delete — per DATA_GOVERNANCE.md §3.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { persons } from './person.schema';

/** Synthetic pseudonym written into the non-null firstName on erasure. */
export const ERASED_MARKER = '[ERASED]';

export interface PersonErasureResult {
  /** True when this call performed the anonymization. */
  anonymized: boolean;
  /** True when the person was already anonymized (idempotent no-op). */
  alreadyErased: boolean;
}

/** Whether the person's PII has already been anonymized. */
export async function isPersonErased(db: DatabaseInstance, personId: string): Promise<boolean> {
  const [row] = await db
    .select({ firstName: persons.firstName })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);
  return row?.firstName === ERASED_MARKER;
}

/**
 * Anonymize a person's PII: name → pseudonym, all other identifiers nulled,
 * row preserved. Idempotent (a second call on an already-erased person is a
 * no-op). Returns whether it acted and whether it was already erased.
 */
export async function anonymizePersonPii(
  db: DatabaseInstance,
  personId: string,
  opts: { actorId?: string | null } = {},
): Promise<PersonErasureResult> {
  const [existing] = await db
    .select({ firstName: persons.firstName })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);

  if (!existing) return { anonymized: false, alreadyErased: false };
  if (existing.firstName === ERASED_MARKER) return { anonymized: false, alreadyErased: true };

  const res = await db
    .update(persons)
    .set({
      firstName: ERASED_MARKER,
      lastName: null,
      middleName: null,
      dateOfBirth: null,
      gender: null,
      primaryAddress: null,
      contactInfo: null,
      avatar: null,
      consent: null,
      updatedAt: new Date(),
      updatedBy: opts.actorId ?? null,
    })
    .where(eq(persons.id, personId))
    .returning({ id: persons.id });

  return { anonymized: res.length > 0, alreadyErased: false };
}
