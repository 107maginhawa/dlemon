/**
 * getTreatmentPlan — GET /dental/patients/:patientId/treatment-plan
 *
 * FR1.22: Treatment Plan Presentation — aggregate all pending (diagnosed/planned)
 *          treatments across all visits into a patient-facing treatment plan.
 *
 * Groups treatments by tooth and provides totals.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { dentalTreatments } from './repos/treatment.schema';
import { dentalVisits } from './repos/visit.schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function getTreatmentPlan(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId');
  if (!patientId) throw new ValidationError('patientId is required');
  const branchId = ctx.req.query('branchId');
  if (!branchId) throw new ValidationError('branchId query parameter is required');

  const db = ctx.get('database') as DatabaseInstance;
  await assertBranchAccess(db, user.id, branchId);

  const logger = ctx.get('logger');

  // Find all non-completed/locked visit IDs for this patient
  const visits = await db
    .select({ id: dentalVisits.id })
    .from(dentalVisits)
    .where(eq(dentalVisits.patientId, patientId));

  const visitIds = visits.map(v => v.id);

  if (visitIds.length === 0) {
    return ctx.json({ patientId, treatments: [], totalEstimateCents: 0, toothCount: 0 }, 200);
  }

  // Fetch all pending (diagnosed/planned) treatments
  const pendingTreatments = await db
    .select()
    .from(dentalTreatments)
    .where(
      and(
        inArray(dentalTreatments.visitId, visitIds),
        inArray(dentalTreatments.status, ['diagnosed', 'planned'])
      )
    );

  const totalEstimateCents = pendingTreatments.reduce((sum, t) => sum + t.priceCents, 0);

  // Group by tooth
  const byTooth: Record<string | number, any[]> = {};
  for (const t of pendingTreatments) {
    const key = t.toothNumber ?? 'general';
    if (!byTooth[key]) byTooth[key] = [];
    byTooth[key].push({
      id: t.id,
      cdtCode: t.cdtCode,
      description: t.description,
      surfaces: t.surfaces,
      priceCents: t.priceCents,
      status: t.status,
      conditionCode: t.conditionCode,
      visitId: t.visitId,
    });
  }

  logger?.info({ action: 'getTreatmentPlan', patientId, count: pendingTreatments.length }, 'Treatment plan retrieved');

  return ctx.json({
    patientId,
    totalEstimateCents,
    treatmentCount: pendingTreatments.length,
    toothCount: Object.keys(byTooth).filter(k => k !== 'general').length,
    byTooth,
    treatments: pendingTreatments.map(t => ({
      id: t.id,
      toothNumber: t.toothNumber,
      cdtCode: t.cdtCode,
      description: t.description,
      surfaces: t.surfaces,
      priceCents: t.priceCents,
      status: t.status,
      conditionCode: t.conditionCode,
      visitId: t.visitId,
      carriedOver: t.carriedOver,
    })),
  }, 200);
}
