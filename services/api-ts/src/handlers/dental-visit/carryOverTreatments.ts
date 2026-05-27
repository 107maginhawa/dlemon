/**
 * carryOverTreatments — POST /dental/visits/:visitId/carry-over
 *
 * FR1.11: Auto carry-over — copy undismissed pending treatments from the patient's
 *          previous visit into the current visit.
 *
 * Also supports restore-from-dismissed: include dismissedIds in body to restore
 * specific dismissed treatments into the new visit.
 *
 * Body: { restoreDismissedIds?: string[] }
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitRepository } from './repos/visit.repo';
import { TreatmentRepository } from './repos/treatment.repo';
import { dentalTreatments } from './repos/treatment.schema';
import { dentalVisits } from './repos/visit.schema';
import { eq, and, inArray, ne, desc } from 'drizzle-orm';
import { z } from 'zod';

const carryOverBodySchema = z.object({
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
  const treatmentRepo = new TreatmentRepository(db);

  const currentVisit = await visitRepo.findOneById(visitId);
  if (!currentVisit) throw new NotFoundError('Visit not found');

  await assertBranchRole(db, user.id, currentVisit.branchId, ['dentist_owner', 'dentist_associate']);

  if (currentVisit.status === 'completed' || currentVisit.status === 'locked') {
    throw new BusinessLogicError('Cannot carry over treatments into a completed/locked visit', 'VISIT_IMMUTABLE');
  }

  // Find the most recent previous visit for this patient
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

  const previousVisitIds = previousVisits.map(v => v.id);

  // Find pending (diagnosed/planned) non-dismissed treatments from previous visits
  const pendingTreatments = await db
    .select()
    .from(dentalTreatments)
    .where(
      and(
        inArray(dentalTreatments.visitId, previousVisitIds),
        inArray(dentalTreatments.status, ['diagnosed', 'planned'])
      )
    );

  // Create carry-over copies in current visit
  const carriedOver = await Promise.all(
    pendingTreatments.map(t =>
      treatmentRepo.createOne({
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
  const restoredDismissed: any[] = [];
  if (Array.isArray(body?.restoreDismissedIds) && body.restoreDismissedIds.length > 0) {
    const dismissedTreatments = await db
      .select()
      .from(dentalTreatments)
      .where(
        and(
          inArray(dentalTreatments.id, body.restoreDismissedIds),
          eq(dentalTreatments.status, 'dismissed'),
          eq(dentalTreatments.patientId, currentVisit.patientId)
        )
      );

    for (const t of dismissedTreatments) {
      const restored = await treatmentRepo.createOne({
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
      });
      restoredDismissed.push(restored);
    }
  }

  logger?.info(
    { action: 'carryOverTreatments', visitId, carriedCount: carriedOver.length, restoredCount: restoredDismissed.length },
    'Treatments carried over'
  );

  return ctx.json({
    carriedOver,
    restoredDismissed,
    message: `Carried over ${carriedOver.length} treatment(s)${restoredDismissed.length > 0 ? `, restored ${restoredDismissed.length} dismissed` : ''}`,
  }, 200);
}
