/**
 * carryOverTreatments — POST /dental/visits/:visitId/carry-over
 *
 * FR1.11: Carry over undismissed pending treatments from a specific previous visit
 *          (identified by source_visit_id in the request body) into the current visit.
 *
 * When source_visit_id is provided, only treatments from that exact visit are
 * carried over (contract-compliant path). When omitted, falls back to
 * auto-discovery from the most recent prior visits (legacy behaviour).
 *
 * Also supports restore-from-dismissed: include dismissedIds in body to restore
 * specific dismissed treatments into the new visit.
 *
 * Body: { sourceVisitId?: string; restoreDismissedIds?: string[] }
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { withTenantTx } from '@/core/tenant-tx';
import { VisitRepository } from '../repos/visit.repo';
import { TreatmentRepository } from '../repos/treatment.repo';
import type { DentalTreatment } from '../repos/treatment.schema';
import { dentalTreatments } from '../repos/treatment.schema';
import { dentalVisits } from '../repos/visit.schema';
import { eq, and, inArray, ne, desc } from 'drizzle-orm';
import { z } from 'zod';

const carryOverBodySchema = z.object({
  /** EM-VIS-002: explicit source visit; when provided only treatments from this
   *  visit are carried over (API_CONTRACTS §POST /carry-over). */
  sourceVisitId: z.string().uuid().optional(),
  restoreDismissedIds: z.array(z.string().uuid()).optional(),
});

export async function carryOverTreatments(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId');
  if (!visitId) throw new NotFoundError('Visit not found');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const rawBody = await ctx.req.json().catch(() => ({}));
  const body = carryOverBodySchema.parse(rawBody);

  const visitRepo = new VisitRepository(db);

  const currentVisit = await visitRepo.findOneById(visitId);
  if (!currentVisit) throw new NotFoundError('Visit not found');

  await assertBranchRole(db, user.id, currentVisit.branchId, ['dentist_owner', 'dentist_associate']);

  if (currentVisit.status === 'completed' || currentVisit.status === 'locked') {
    throw new BusinessLogicError('Cannot carry over treatments into a completed/locked visit', 'VISIT_IMMUTABLE');
  }

  // EM-VIS-002: When source_visit_id is supplied, use it directly; otherwise
  // fall back to auto-discovery across the most recent prior visits.
  let previousVisitIds: string[];

  if (body.sourceVisitId) {
    // Validate the source visit belongs to the same patient
    const sourceVisit = await visitRepo.findOneById(body.sourceVisitId);
    if (!sourceVisit) throw new NotFoundError('Source visit not found');
    if (sourceVisit.patientId !== currentVisit.patientId) {
      throw new BusinessLogicError('Source visit does not belong to the same patient', 'INVALID_SOURCE_VISIT');
    }
    previousVisitIds = [body.sourceVisitId];
  } else {
    // Legacy auto-discovery: most recent prior visits for this patient
    const previousVisits = await db
      .select()
      .from(dentalVisits)
      .where(
        and(
          eq(dentalVisits.patientId, currentVisit.patientId),
          ne(dentalVisits.id, visitId)
        )
      )
      .orderBy(desc(dentalVisits.createdAt))
      .limit(5);

    if (previousVisits.length === 0) {
      return ctx.json({ carriedOver: [], restoredDismissed: [], message: 'No previous visits to carry over from' }, 200);
    }
    previousVisitIds = previousVisits.map(v => v.id);
  }

  // Find pending (diagnosed/planned) treatments from the resolved previous visit(s)
  const pendingTreatments = await db
    .select()
    .from(dentalTreatments)
    .where(
      and(
        inArray(dentalTreatments.visitId, previousVisitIds),
        inArray(dentalTreatments.status, ['diagnosed', 'planned'])
      )
    );

  // FR1.11: resolve the dismissed treatments to restore (READ stays on `db`,
  // outside the write tx — same ADR-010 split as the reads above).
  let dismissedTreatments: DentalTreatment[] = [];
  if (Array.isArray(body?.restoreDismissedIds) && body.restoreDismissedIds.length > 0) {
    dismissedTreatments = await db
      .select()
      .from(dentalTreatments)
      .where(
        and(
          inArray(dentalTreatments.id, body.restoreDismissedIds),
          eq(dentalTreatments.status, 'dismissed'),
          eq(dentalTreatments.patientId, currentVisit.patientId)
        )
      );
  }

  // Atomicity (ADR-010): both write loops run in ONE tenant tx scoped to the
  // current visit's branch, so a partial failure rolls the whole batch back
  // instead of leaving some carried/restored rows committed. The repo is re-bound
  // to the tx connection (createOne is a plain INSERT, no internal tx).
  const { carriedOver, restoredDismissed } = await withTenantTx(
    db,
    { branchIds: [currentVisit.branchId] },
    async (tx) => {
      const txRepo = new TreatmentRepository(tx);

      // Create carry-over copies in current visit
      const carried = await Promise.all(
        pendingTreatments.map(t =>
          txRepo.createOne({
            visitId,
            patientId: currentVisit.patientId,
            cdtCode: t.cdtCode,
            description: t.description,
            toothNumber: t.toothNumber ?? undefined,
            surfaces: t.surfaces ?? undefined,
            conditionCode: t.conditionCode ?? undefined,
            priceCents: t.priceCents,
            status: t.status,
            carriedOver: true,
            sourceVisitId: t.visitId,
          })
        )
      );

      // FR1.11: Restore from dismissed if requested
      const restored: DentalTreatment[] = [];
      for (const t of dismissedTreatments) {
        restored.push(await txRepo.createOne({
          visitId,
          patientId: currentVisit.patientId,
          cdtCode: t.cdtCode,
          description: t.description,
          toothNumber: t.toothNumber ?? undefined,
          surfaces: t.surfaces ?? undefined,
          conditionCode: t.conditionCode ?? undefined,
          priceCents: t.priceCents,
          status: 'planned',
          carriedOver: true,
          sourceVisitId: t.visitId,
        }));
      }

      return { carriedOver: carried, restoredDismissed: restored };
    },
  );

  logger?.info(
    { action: 'carryOverTreatments', visitId, sourceVisitId: body.sourceVisitId ?? null, carriedCount: carriedOver.length, restoredCount: restoredDismissed.length },
    'Treatments carried over'
  );

  return ctx.json({
    carriedOver,
    restoredDismissed,
    message: `Carried over ${carriedOver.length} treatment(s)${restoredDismissed.length > 0 ? `, restored ${restoredDismissed.length} dismissed` : ''}`,
  }, 200);
}
