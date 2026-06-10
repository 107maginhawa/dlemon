/**
 * convertFindingToTreatment handler — P0-C
 *
 * POST /dental/visits/{visitId}/findings/{findingId}/treatment
 *
 * Converts a finding into a treatment (carries its tooth/surface), then links
 * them (finding.linkedTreatmentId). Price defaults from the branch fee schedule
 * when omitted (mirrors createDentalTreatment).
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitRepository } from './repos/visit.repo';
import { TreatmentRepository } from './repos/treatment.repo';
import { DentalFindingRepository } from './repos/dental-finding.repo';
import { getBranchFeeOverrides } from '@/handlers/dental-org/repos/org-billing.facade';
import { resolveFeeCents } from '@/handlers/dental-org/fee-resolution';
import { getActiveProcedureCode } from './repos/visit-org.facade';
import type { ConvertFindingToTreatmentBody, ConvertFindingToTreatmentParams } from '@/generated/openapi/validators';
import type { User } from '@/types/auth';

export async function convertFindingToTreatment(
  ctx: ValidatedContext<ConvertFindingToTreatmentBody, never, ConvertFindingToTreatmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId, findingId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const visit = await new VisitRepository(db).findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError(`Cannot add treatments to a ${visit.status} visit`, 'VISIT_IMMUTABLE');
  }

  const findingRepo = new DentalFindingRepository(db);
  const finding = await findingRepo.findById(findingId);
  if (!finding || finding.visitId !== visitId) throw new NotFoundError('Finding');

  // Price: explicit wins, else default from the branch fee schedule (AC-ORG-002).
  let priceCents = body.priceCents;
  if (priceCents === undefined) {
    const overrides = await getBranchFeeOverrides(db, visit.branchId);
    const procedure = await getActiveProcedureCode(db, body.cdtCode);
    priceCents = resolveFeeCents(overrides, body.cdtCode, procedure?.defaultFeePhp);
  }

  const treatment = await new TreatmentRepository(db).createOne({
    visitId,
    patientId: finding.patientId,
    cdtCode: body.cdtCode,
    description: body.description,
    toothNumber: finding.toothNumber,
    surfaces: finding.surface ? [finding.surface] : undefined,
    conditionCode: finding.conditionCode,
    priceCents,
    carriedOver: false,
    createdBy: user.id,
    updatedBy: user.id,
  });

  await findingRepo.linkTreatment(findingId, treatment.id);

  return ctx.json(treatment, 201);
}
