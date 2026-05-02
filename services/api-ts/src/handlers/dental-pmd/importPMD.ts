/**
 * importPMD handler
 *
 * POST /dental/pmd/import
 * Imports an external PMD record (read-only, links to patient).
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError } from '@/core/errors';
import { ImportedPMDRepository } from './repos/imported-pmd.repo';
import type { User } from '@/types/auth';

export async function importPMD(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['sourceFacility'] || typeof body['sourceFacility'] !== 'string') throw new ValidationError('sourceFacility is required');
  if (!body['content'] || typeof body['content'] !== 'string') throw new ValidationError('content is required');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImportedPMDRepository(db);

  const imported = await repo.createOne({
    patientId: body['patientId'] as string,
    sourceFacility: body['sourceFacility'] as string,
    sourceReference: typeof body['sourceReference'] === 'string' ? body['sourceReference'] : undefined,
    content: body['content'] as string,
  });

  return ctx.json({ ...imported, safetyFloorMerged: imported.safetyFloorMerged === 'true' }, 201);
}
