/**
 * getPMDForVisit handler
 *
 * GET /dental/visits/{visitId}/pmd
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { PMDDocumentRepository } from './repos/pmd-document.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientForPMD } from '@/handlers/patient/repos/patient-pmd.facade';
import type { User } from '@/types/auth';

export async function getPMDForVisit(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;

  const visit = await getVisitOrThrow(db, visitId);

  const repo = new PMDDocumentRepository(db);

  const pmd = await repo.findByVisit(visitId);
  if (!pmd) throw new NotFoundError('PMD document');

  // V-PMD-008 (§6 "Download: patient own PMDs"): a patient may read their own PMD.
  // If the requester is the patient's linked person, skip the staff branch check;
  // otherwise require branch membership.
  const patient = await getPatientForPMD(db, pmd.patientId);
  const isPatientSelf = patient?.person === user.id;
  if (!isPatientSelf) {
    await assertBranchAccess(db, user.id, visit.branchId);
  }

  return ctx.json(pmd);
}
