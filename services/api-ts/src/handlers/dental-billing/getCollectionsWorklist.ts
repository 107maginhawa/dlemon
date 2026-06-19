/**
 * getCollectionsWorklist — GET /dental/billing/collections/worklist
 *
 * Phase 2.4: the actionable view over overdue accounts. One row per patient who
 * has an `overdue` balance, enriched with open-invoice count, active-plan flag,
 * and last collections contact (from dental_collection_note). Sorted most-aged
 * first so the worst accounts surface at the top.
 *
 * EM-BIL-002: branchId is OPTIONAL — supplied asserts membership; omitted scopes
 * to the caller's own active branches via withTenantTx, never the whole DB.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getActiveBranchIdsForPerson } from '@/handlers/dental-org/repos/org-billing.facade';
import { getActivePaymentPlanPatientIds } from '@/handlers/patient/repos/patient-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { getOutstandingInvoicesForAging } from './repos/billing-report.facade';
import { invoiceAgeDays } from './utils/aging';
import { DentalCollectionNoteRepository } from './repos/dental-collection-note.repo';
import type { GetCollectionsWorklistQuery } from '@/generated/openapi/validators';

interface WorklistAccum {
  patientName: string;
  totalOverdueCents: number;
  oldestDaysOverdue: number;
  openInvoiceCount: number;
}

export async function getCollectionsWorklist(
  ctx: ValidatedContext<never, GetCollectionsWorklistQuery, never>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const query = ctx.req.valid('query');

  let allowedBranchIds: string[] | undefined;
  if (query.branchId) {
    await assertBranchAccess(db, user.id, query.branchId);
  } else {
    allowedBranchIds = await getActiveBranchIdsForPerson(db, user.id);
  }

  const asOf = query.asOf ? new Date(query.asOf) : new Date();
  const scopeBranchIds = query.branchId ? [query.branchId] : (allowedBranchIds ?? []);
  const rows = await withTenantTx(db, { branchIds: scopeBranchIds }, (tx) =>
    getOutstandingInvoicesForAging(tx, query.branchId, allowedBranchIds),
  );

  // Aggregate per patient — overdue balance drives the worklist; every
  // outstanding invoice counts toward openInvoiceCount.
  const byPatient = new Map<string, WorklistAccum>();
  for (const r of rows) {
    const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
    let acc = byPatient.get(r.patientId);
    if (!acc) {
      acc = { patientName: name, totalOverdueCents: 0, oldestDaysOverdue: 0, openInvoiceCount: 0 };
      byPatient.set(r.patientId, acc);
    }
    acc.openInvoiceCount += 1;
    if (r.status === 'overdue') {
      acc.totalOverdueCents += r.balanceCents;
      const age = invoiceAgeDays(r, asOf);
      if (age > acc.oldestDaysOverdue) acc.oldestDaysOverdue = age;
    }
  }

  const overduePatientIds = [...byPatient.entries()]
    .filter(([, a]) => a.totalOverdueCents > 0)
    .map(([id]) => id);

  // Enrich the overdue set: last contact + active-plan flag (one round-trip each).
  const [latestNotes, activePlanIds] = await Promise.all([
    new DentalCollectionNoteRepository(db).findLatestByPatients(overduePatientIds),
    getActivePaymentPlanPatientIds(db, overduePatientIds),
  ]);

  const worklist = overduePatientIds.map((patientId) => {
    const acc = byPatient.get(patientId)!;
    const contact = latestNotes.get(patientId);
    return {
      patientId,
      patientName: acc.patientName,
      totalOverdueCents: acc.totalOverdueCents,
      oldestDaysOverdue: acc.oldestDaysOverdue,
      openInvoiceCount: acc.openInvoiceCount,
      hasActivePlan: activePlanIds.has(patientId),
      lastContactedAt: contact ? contact.lastContactedAt.toISOString() : undefined,
      lastContactChannel: contact?.lastContactChannel,
      noteCount: contact?.noteCount ?? 0,
    };
  });

  worklist.sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue);

  logger?.info(
    { action: 'getCollectionsWorklist', branchId: query.branchId, rowCount: worklist.length },
    'Collections worklist computed',
  );

  return ctx.json({ asOf: asOf.toISOString(), rows: worklist }, 200);
}
