/**
 * createDentalVisit handler
 *
 * POST /dental/visits
 * Creates a new dental visit in draft status.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitRepository } from './repos/visit.repo';
import type { User } from '@/types/auth';

export async function createDentalVisit(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['branchId'] || typeof body['branchId'] !== 'string') throw new ValidationError('branchId is required');
  if (!body['dentistMemberId'] || typeof body['dentistMemberId'] !== 'string') throw new ValidationError('dentistMemberId is required');

  const db = ctx.get('database') as DatabaseInstance;
  await assertBranchAccess(db, user.id, body['branchId'] as string);

  const repo = new VisitRepository(db);

  const visit = await repo.createOne({
    patientId: body['patientId'] as string,
    branchId: body['branchId'] as string,
    dentistMemberId: body['dentistMemberId'] as string,
    chiefComplaint: typeof body['chiefComplaint'] === 'string' ? body['chiefComplaint'] : undefined,
  });

  return ctx.json(visit, 201);
}
