/**
 * recall-person.facade.ts
 *
 * Centralizes the dentalRecalls ⋈ patients ⋈ persons joins (due-by-branch list,
 * dispatchable scan) in one exempt bridge file so recall.repo no longer imports
 * the patient/person schemas directly (Phase 10 boundary lint). The patient/
 * person join is inseparable (branch filter on patients.preferredBranchId,
 * patient name from persons), so it is RELOCATED unchanged — SQL byte-identical.
 */

import { eq, and, inArray, sql, asc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalRecalls, type DentalRecall } from './recall.schema';
import { patients } from '../../patient/repos/patient.schema';
import { persons } from '../../person/repos/person.schema';

/** Due (pending/sent) recalls in a branch within [from,to], with patient name. */
export async function getDueRecallsByBranch(
  db: DatabaseInstance,
  branchId: string,
  from: string,
  to: string,
  options?: { limit?: number; offset?: number },
): Promise<Array<DentalRecall & { patientName: string }>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const rows = await db
    .select({
      recall: dentalRecalls,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(dentalRecalls)
    .innerJoin(patients, eq(patients.id, dentalRecalls.patientId))
    .innerJoin(persons, eq(persons.id, patients.person))
    .where(and(
      eq(patients.preferredBranchId, branchId),
      inArray(dentalRecalls.status, ['pending', 'sent']),
      sql`${dentalRecalls.dueDate} >= ${from}`,
      sql`${dentalRecalls.dueDate} <= ${to}`,
    ))
    .orderBy(asc(dentalRecalls.dueDate))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    ...r.recall,
    patientName: [r.firstName, r.lastName].filter(Boolean).join(' ').trim(),
  }));
}

/** Dispatchable recalls + the patient's preferred branch / person id (for consent-gating). */
export async function getDispatchableRecalls(
  db: DatabaseInstance,
  asOfDate: string,
  reattemptCutoff: Date,
  maxAttempts: number,
  limit = 100,
): Promise<Array<DentalRecall & { preferredBranchId: string | null; personId: string }>> {
  const rows = await db
    .select({ recall: dentalRecalls, preferredBranchId: patients.preferredBranchId, personId: patients.person })
    .from(dentalRecalls)
    .innerJoin(patients, eq(patients.id, dentalRecalls.patientId))
    .where(sql`(
        (${dentalRecalls.status} = 'pending' AND ${dentalRecalls.dueDate} <= ${asOfDate})
        OR (${dentalRecalls.status} = 'sent'
            AND ${dentalRecalls.sendAttempts} < ${maxAttempts}
            AND (${dentalRecalls.lastSentAt} IS NULL OR ${dentalRecalls.lastSentAt} <= ${reattemptCutoff.toISOString()}))
      )`)
    .limit(limit);
  return rows.map((r) => ({ ...r.recall, preferredBranchId: r.preferredBranchId, personId: r.personId }));
}
