/**
 * listMedicalHistory handler
 *
 * GET /dental/clinical/medical-history?patientId=...
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { MedicalHistoryRepository } from './repos/medical-history.repo';
import type { User } from '@/types/auth';

export async function listMedicalHistory(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.query('patientId');
  if (!patientId) throw new ValidationError('patientId query parameter is required');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MedicalHistoryRepository(db);

  const items = await repo.findMany({ patientId });
  const limit = parseInt(ctx.req.query('limit') ?? '50');
  const offset = parseInt(ctx.req.query('offset') ?? '0');
  const page = items.slice(offset, offset + limit);

  return ctx.json({ items: page, total: items.length, limit, offset });
}
