/**
 * createPerioChart
 *
 * POST /dental/perio-charts
 *
 * BR-P01: One chart per visit (409 on duplicate).
 * BR-P02: Visit must be active (422 if locked/completed/discarded).
 * BR-P05: Dentist role required.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import { PerioChartRepository } from './repos/perio-chart.repo';
import { getVisitOrThrow } from '@/handlers/dental-visit/visit.service';
import { getActiveMembershipId } from '@/handlers/dental-org/repos/org-billing.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { CreatePerioChartBody } from '@/generated/openapi/validators';

export async function createPerioChart(
  ctx: ValidatedContext<CreatePerioChartBody, never, never>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const visit = await getVisitOrThrow(db, body.visitId);

  // BR-P02: visit must be writable.
  if (visit.status === 'locked' || visit.status === 'completed' || visit.status === 'discarded') {
    throw new BusinessLogicError(`Cannot create perio chart on ${visit.status} visit`, 'PERIO_VISIT_LOCKED');
  }

  // BR-P05: dentist or hygienist role required on branch.
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);

  // Resolve examiner membership for this user on this branch.
  const membership = await getActiveMembershipId(db, user.id, visit.branchId);
  if (!membership) throw new NotFoundError('Membership');

  const repo = new PerioChartRepository(db);

  // BR-P01: enforce one chart per visit.
  const existing = await repo.findByVisitId(body.visitId);
  if (existing) {
    throw new BusinessLogicError('A periodontal chart already exists for this visit', 'PERIO_CHART_DUPLICATE');
  }

  const chart = await repo.createOne({
    visitId: body.visitId,
    patientId: body.patientId,
    branchId: visit.branchId,
    examinerMemberId: membership.id,
    status: 'draft',
    notes: body.notes,
    createdBy: user.id,
    updatedBy: user.id,
  });

  ctx.get('logger')?.info(
    {
      requestId: ctx.get('requestId'),
      action: 'dental_perio_chart_create',
      chartId: chart.id,
      visitId: body.visitId,
      by: user.id,
    },
    'Perio chart created',
  );

  return ctx.json({ ...chart, readings: [] }, 201);
}
