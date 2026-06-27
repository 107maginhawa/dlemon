/**
 * getToothHistory handler
 *
 * GET /dental/visits/history/{patientId}/teeth/{toothNumber}
 * Returns per-tooth history across all visits for a patient.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitRepository } from '../repos/visit.repo';
import { DentalChartRepository } from '../repos/dental-chart.repo';
import { TreatmentRepository } from '../repos/treatment.repo';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { User } from '@/types/auth';

export async function getToothHistory(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId');
  const toothNumber = parseInt(ctx.req.param('toothNumber') ?? '');
  if (isNaN(toothNumber)) throw new ValidationError('toothNumber must be a number');

  const db = ctx.get('database') as DatabaseInstance;

  const visitRepo = new VisitRepository(db);
  const chartRepo = new DentalChartRepository(db);
  const treatmentRepo = new TreatmentRepository(db);

  // Get all visits for this patient (completed/locked)
  const visits = await visitRepo.findMany({ patientId });

  // Derive branch from patient's visits and assert access
  if (visits.length === 0) {
    const { limit, offset } = parsePagination(ctx.req.query(), { limit: 20 });
    return ctx.json({ data: [], pagination: buildPaginationMeta([], 0, limit, offset) });
  }
  await assertBranchAccess(db, user.id, visits[0]!.branchId);

  // Item 9 / bug-a: include the ACTIVE visit so its in-progress (diagnosed/planned)
  // work shows in the per-tooth timeline, not just finished visits. Response shape
  // (ToothHistoryEntry) is unchanged → no codegen. Draft/discarded stay excluded.
  const chartedVisits = visits.filter(
    v => v.status === 'completed' || v.status === 'locked' || v.status === 'active',
  );

  // Build a two-axis chronological ledger: one entry per non-dismissed treatment
  // (eventKind='treatment'), plus a condition-only finding event (eventKind='finding')
  // when the tooth is flagged that visit with no treatment recorded. Neither axis
  // silently drops the other: a treatment on a tooth absent from the visit's chart
  // snapshot is still surfaced (synthesised state), and a flagged tooth never renders
  // a blank row.
  const entries: Array<{
    visitId: string;
    visitDate: Date;
    toothNumber: number;
    state: string;
    conditionCode?: string;
    treatmentCdtCode?: string;
    treatmentDescription?: string;
    surfaces?: string[];
    treatmentStatus?: string;
    treatmentPriceCents?: number;
    treatmentId?: string;
    eventKind: 'finding' | 'treatment';
    syncStatus?: string;
  }> = [];

  // ponytail: naive state synthesis when a treatment has no chart snapshot for the
  // tooth — performed work reads as filled, pending as caries. Refine if richer
  // inference is ever needed.
  const synthState = (status: string) =>
    (status === 'performed' || status === 'verified') ? 'filled' : 'caries';

  for (const visit of chartedVisits) {
    const chart = await chartRepo.findByVisit(visit.id);
    const tooth = chart?.teeth.find(t => t.toothNumber === toothNumber);
    const treatments = await treatmentRepo.findByVisit(visit.id);
    const toothTreatments = treatments.filter(
      t => t.toothNumber === toothNumber && t.status !== 'dismissed',
    );

    // Surface a sync conflict on the chart row so the ledger can warn about
    // unreconciled offline edits to this tooth's visit.
    const syncStatus = chart?.syncStatus === 'conflict' ? 'conflict' : undefined;
    const visitDate = visit.completedAt ?? visit.createdAt;

    if (toothTreatments.length > 0) {
      for (const t of toothTreatments) {
        entries.push({
          visitId: visit.id,
          visitDate,
          toothNumber,
          state: tooth?.state ?? synthState(t.status),
          conditionCode: tooth?.conditionCode ?? t.conditionCode ?? undefined,
          treatmentCdtCode: t.cdtCode,
          treatmentDescription: t.description,
          // QA-003: surface these so the per-tooth slideout's Surface/Status/Total
          // columns render real data instead of invented FE-only fields.
          surfaces: t.surfaces ?? undefined,
          treatmentStatus: t.status,
          treatmentPriceCents: t.priceCents,
          // P2-C: surface the treatment id so the per-tooth panel can PATCH it
          // (advance / decline / dismiss). Additive to the OUTPUT only — does
          // not touch the finding-vs-treatment emit rule.
          treatmentId: t.id,
          eventKind: 'treatment',
          syncStatus,
        });
      }
      continue;
    }

    // No treatment this visit — emit a finding event when the tooth is flagged
    // (any non-healthy state or a recorded condition code). A sound, untreated
    // tooth produces no row.
    if (tooth && (tooth.state !== 'healthy' || tooth.conditionCode)) {
      entries.push({
        visitId: visit.id,
        visitDate,
        toothNumber,
        state: tooth.state,
        conditionCode: tooth.conditionCode,
        eventKind: 'finding',
        syncStatus,
      });
    }
  }

  // Sort reverse-chronological
  entries.sort((a, b) => b.visitDate.getTime() - a.visitDate.getTime());

  const { limit, offset } = parsePagination(ctx.req.query(), { limit: 20 });
  const totalCount = entries.length;
  const page = entries.slice(offset, offset + limit);

  return ctx.json({ data: page, pagination: buildPaginationMeta(page, totalCount, limit, offset) });
}
