/**
 * getPMDForVisit handler
 *
 * GET /dental/visits/{visitId}/pmd
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PMDDocumentRepository } from './repos/pmd-document.repo';
import type { User } from '@/types/auth';

export async function getPMDForVisit(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new PMDDocumentRepository(db);

  const pmd = await repo.findByVisit(visitId);
  if (!pmd) throw new NotFoundError('PMD document');

  return ctx.json(pmd);
}
