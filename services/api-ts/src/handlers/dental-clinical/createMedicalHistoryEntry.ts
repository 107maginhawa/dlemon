/**
 * createMedicalHistoryEntry handler
 *
 * POST /dental/clinical/medical-history
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError } from '@/core/errors';
import { MedicalHistoryRepository } from './repos/medical-history.repo';
import { VALID_ENTRY_TYPES } from './repos/medical-history.schema';
import type { User } from '@/types/auth';

export async function createMedicalHistoryEntry(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['entryType'] || !VALID_ENTRY_TYPES.includes(body['entryType'] as any)) {
    throw new ValidationError(`entryType must be one of: ${VALID_ENTRY_TYPES.join(', ')}`);
  }
  if (!body['displayName'] || typeof body['displayName'] !== 'string') throw new ValidationError('displayName is required');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MedicalHistoryRepository(db);

  const entry = await repo.createOne({
    patientId: body['patientId'] as string,
    entryType: body['entryType'] as any,
    displayName: body['displayName'] as string,
    codeSystem: typeof body['codeSystem'] === 'string' ? body['codeSystem'] : undefined,
    code: typeof body['code'] === 'string' ? body['code'] : undefined,
    notes: typeof body['notes'] === 'string' ? body['notes'] : undefined,
    onsetDate: typeof body['onsetDate'] === 'string' ? body['onsetDate'] : undefined,
    resolvedDate: typeof body['resolvedDate'] === 'string' ? body['resolvedDate'] : undefined,
  });

  return ctx.json(entry, 201);
}
