/**
 * updateMedicalHistoryEntry handler
 *
 * PATCH /dental/clinical/medical-history/{entryId}
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { MedicalHistoryRepository } from './repos/medical-history.repo';
import type { User } from '@/types/auth';

export async function updateMedicalHistoryEntry(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const entryId = ctx.req.param('entryId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MedicalHistoryRepository(db);

  const existing = await repo.findOneById(entryId);
  if (!existing) throw new NotFoundError('Medical history entry');

  const patch: Record<string, unknown> = {};
  if (typeof body['displayName'] === 'string') patch['displayName'] = body['displayName'];
  if (typeof body['notes'] === 'string') patch['notes'] = body['notes'];
  if (typeof body['resolvedDate'] === 'string') patch['resolvedDate'] = body['resolvedDate'];
  if (typeof body['active'] === 'boolean') patch['active'] = body['active'];

  const updated = await repo.update(entryId, patch as any);
  return ctx.json(updated);
}
