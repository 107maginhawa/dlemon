/**
 * createAmendment handler
 *
 * POST /dental/visits/{visitId}/amendments
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError } from '@/core/errors';
import { AmendmentRepository } from './repos/amendment.repo';
import type { User } from '@/types/auth';

export async function createAmendment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['originalRecordType'] || typeof body['originalRecordType'] !== 'string') throw new ValidationError('originalRecordType is required');
  if (!body['originalRecordId'] || typeof body['originalRecordId'] !== 'string') throw new ValidationError('originalRecordId is required');
  if (!body['reason'] || typeof body['reason'] !== 'string') throw new ValidationError('reason is required');
  if (!body['content'] || typeof body['content'] !== 'string') throw new ValidationError('content is required');

  const authorMemberId = typeof body['authorMemberId'] === 'string'
    ? body['authorMemberId']
    : user.id;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new AmendmentRepository(db);

  const amendment = await repo.createOne({
    visitId,
    patientId: body['patientId'] as string,
    authorMemberId,
    originalRecordType: body['originalRecordType'] as string,
    originalRecordId: body['originalRecordId'] as string,
    reason: body['reason'] as string,
    content: body['content'] as string,
  });

  return ctx.json(amendment, 201);
}
