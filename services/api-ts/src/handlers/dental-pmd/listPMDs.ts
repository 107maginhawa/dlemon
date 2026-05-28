/**
 * listPMDs handler
 *
 * GET /dental/pmd?patientId=...
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, NotFoundError, ForbiddenError } from '@/core/errors';
import { PMDDocumentRepository } from './repos/pmd-document.repo';
import { getPatientForPMD } from '@/handlers/patient/repos/patient-pmd.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { User } from '@/types/auth';

export async function listPMDs(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.query('patientId');
  if (!patientId) throw new ValidationError('patientId query parameter is required');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via patient's preferred branch
  const patient = await getPatientForPMD(db, patientId);
  if (!patient) throw new NotFoundError('Patient');
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new PMDDocumentRepository(db);

  const items = await repo.findMany({ patientId });
  const { limit, offset } = parsePagination(ctx.req.query(), { limit: 50 });
  const totalCount = items.length;
  const page = items.slice(offset, offset + limit);

  return ctx.json({ data: page, pagination: buildPaginationMeta(page, totalCount, limit, offset) });
}
