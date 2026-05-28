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
import { dentalTreatments } from '../repos/treatment.schema';
import { dentalVisits } from '../repos/visit.schema';
import { treatmentPlanVersions } from '../repos/treatment-plan-version.schema';
import { eq, and, inArray, desc } from 'drizzle-orm';

export async function getTreatmentPlan(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId');
  if (!patientId) throw new ValidationError('patientId is required');
  const branchId = ctx.req.query('branchId');

  const db = ctx.get('database') as DatabaseInstance;
  if (branchId) await assertBranchAccess(db, user.id, branchId);

  const logger = ctx.get('logger');

  // Find all non-completed/locked visit IDs for this patient
  const visits = await db
    .select({ id: dentalVisits.id })
    .from(dentalVisits)
    .where(eq(dentalVisits.patientId, patientId));

  const visitIds = visits.map(v => v.id);

  // Fetch latest accepted version (0 if none)
  const [latestVersion] = await db
    .select({ version: treatmentPlanVersions.version })
    .from(treatmentPlanVersions)
    .where(eq(treatmentPlanVersions.patientId, patientId))
    .orderBy(desc(treatmentPlanVersions.version))
    .limit(1);
  const currentVersion = latestVersion?.version ?? 0;

  if (visitIds.length === 0) {
    return ctx.json({ patientId, treatments: [], totalEstimateCents: 0, toothCount: 0, version: currentVersion }, 200);
  }

  // Fetch all pending (diagnosed/planned/declined) treatments
  const pendingTreatments = await db
    .select()
    .from(dentalTreatments)
    .where(
      and(
        inArray(dentalTreatments.visitId, visitIds),
        inArray(dentalTreatments.status, ['diagnosed', 'planned', 'declined'])
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
      reason: t.refusalReason ?? undefined,
    });
  }

  logger?.info({ action: 'getTreatmentPlan', patientId, count: pendingTreatments.length }, 'Treatment plan retrieved');

  return ctx.json({
    patientId,
    version: currentVersion,
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
      reason: t.refusalReason ?? undefined,
    })),
  }, 200);
}
