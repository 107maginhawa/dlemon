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
import { dentalTreatments, TREATMENT_PHASE_ORDER, type DentalTreatmentPhase, type DentalTreatment } from '../repos/treatment.schema';
import { dentalVisits } from '../repos/visit.schema';
import { treatmentPlanVersions } from '../repos/treatment-plan-version.schema';
import { eq, and, inArray, desc } from 'drizzle-orm';

export async function getTreatmentPlan(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId');
  if (!patientId) throw new ValidationError('patientId is required');
  const branchId = ctx.req.query('branchId');
  if (!branchId) throw new ValidationError('branchId is required');

  const db = ctx.get('database') as DatabaseInstance;
  await assertBranchAccess(db, user.id, branchId);

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

  // P1-18: sort by clinical phase order, then intra-phase priority, then insertion.
  // Unphased items sort last (rank 99). This drives the proposed-care sequence the
  // plan UI renders ("stabilise before crown").
  const phaseRank = (p: DentalTreatmentPhase | null): number =>
    p ? TREATMENT_PHASE_ORDER[p] : 99;
  pendingTreatments.sort((a, b) => {
    const pa = phaseRank(a.phase as DentalTreatmentPhase | null);
    const pb = phaseRank(b.phase as DentalTreatmentPhase | null);
    if (pa !== pb) return pa - pb;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Group by tooth
  type TreatmentPlanItem = Pick<DentalTreatment, 'id' | 'cdtCode' | 'description' | 'surfaces' | 'priceCents' | 'status' | 'conditionCode' | 'visitId' | 'phase' | 'priority'> & { reason?: string };
  const byTooth: Record<string | number, TreatmentPlanItem[]> = {};
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
      phase: t.phase,
      priority: t.priority,
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
      phase: t.phase,
      priority: t.priority,
      reason: t.refusalReason ?? undefined,
    })),
  }, 200);
}
