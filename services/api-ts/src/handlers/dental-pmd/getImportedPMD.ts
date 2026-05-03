/**
 * getImportedPMD — FR12.2: Read / parse an imported PMD
 *
 * GET /dental/pmd/imported/:id
 *
 * Returns the imported PMD with parsed content (JSON or raw text).
 * If content is valid JSON, returns a parsed structured view.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { ImportedPMDRepository } from './repos/imported-pmd.repo';

export async function getImportedPMD(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const id = ctx.req.param('id')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImportedPMDRepository(db);

  const record = await repo.findOneById(id);
  if (!record) throw new NotFoundError('Imported PMD not found');

  // FR12.2: Parse content — try JSON first, fall back to raw text
  let parsedContent: unknown;
  let contentType: 'json' | 'text' = 'text';
  try {
    parsedContent = JSON.parse(record.content);
    contentType = 'json';
  } catch {
    parsedContent = record.content;
  }

  return ctx.json({
    id: record.id,
    patientId: record.patientId,
    sourceFacility: record.sourceFacility,
    sourceReference: record.sourceReference,
    importedAt: record.importedAt,
    safetyFloorMerged: record.safetyFloorMerged === 'true',
    contentType,
    content: parsedContent,
  }, 200);
}
