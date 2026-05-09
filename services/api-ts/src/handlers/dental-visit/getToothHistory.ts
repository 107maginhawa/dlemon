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
import { VisitRepository } from './repos/visit.repo';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { TreatmentRepository } from './repos/treatment.repo';
import type { User } from '@/types/auth';

export async function getToothHistory(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId');
  const toothNumber = parseInt(ctx.req.param('toothNumber') ?? '');
  if (isNaN(toothNumber)) throw new ValidationError('toothNumber must be a number');

  const branchId = ctx.req.query('branchId');
  if (!branchId) throw new ValidationError('branchId query parameter is required');

  const db = ctx.get('database') as DatabaseInstance;
  await assertBranchAccess(db, user.id, branchId);

  const visitRepo = new VisitRepository(db);
  const chartRepo = new DentalChartRepository(db);
  const treatmentRepo = new TreatmentRepository(db);

  // Get all visits for this patient (completed/locked)
  const visits = await visitRepo.findMany({ patientId });
  const completedVisits = visits.filter(v => v.status === 'completed' || v.status === 'locked');

  // Build history entries in reverse chronological order
  const entries: Array<{
    visitId: string;
    visitDate: Date;
    toothNumber: number;
    state: string;
    conditionCode?: string;
    treatmentCdtCode?: string;
    treatmentDescription?: string;
  }> = [];

  for (const visit of completedVisits) {
    const chart = await chartRepo.findByVisit(visit.id);
    if (!chart) continue;

    const tooth = chart.teeth.find(t => t.toothNumber === toothNumber);
    if (!tooth) continue;

    const treatments = await treatmentRepo.findByVisit(visit.id);
    const toothTreatment = treatments.find(t => t.toothNumber === toothNumber && t.status !== 'dismissed');

    entries.push({
      visitId: visit.id,
      visitDate: visit.completedAt ?? visit.createdAt,
      toothNumber,
      state: tooth.state,
      conditionCode: tooth.conditionCode,
      treatmentCdtCode: toothTreatment?.cdtCode,
      treatmentDescription: toothTreatment?.description,
    });
  }

  // Sort reverse-chronological
  entries.sort((a, b) => b.visitDate.getTime() - a.visitDate.getTime());

  const limit = parseInt(ctx.req.query('limit') ?? '20');
  const offset = parseInt(ctx.req.query('offset') ?? '0');

  return ctx.json({ items: entries.slice(offset, offset + limit), total: entries.length, limit, offset });
}
