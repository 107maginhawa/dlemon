/**
 * createDentalFinding handler — P0-C
 *
 * POST /dental/visits/{visitId}/findings
 *
 * Records a structured clinical finding (curated vocabulary) on a tooth/surface.
 * Distinct from the odontogram `state`: a tooth can carry several findings.
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitRepository } from './repos/visit.repo';
import { DentalFindingRepository } from './repos/dental-finding.repo';
import type { ConditionCode } from './repos/dental-finding.schema';
import type { CreateDentalFindingBody, CreateDentalFindingParams } from '@/generated/openapi/validators';
import type { User } from '@/types/auth';

export async function createDentalFinding(
  ctx: ValidatedContext<CreateDentalFindingBody, never, CreateDentalFindingParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const visit = await new VisitRepository(db).findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  // E2: a dental_assistant may record chart conditions/findings under supervision.
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist', 'dental_assistant']);

  // `other` is free-text — it must carry a note or it collapses into a meaningless
  // generic finding (the exact problem the curated vocabulary fixes).
  if (body.conditionCode === 'other' && !body.note?.trim()) {
    throw new ValidationError("A note is required when conditionCode is 'other'");
  }

  const repo = new DentalFindingRepository(db);

  // GAP-001: offline-replay idempotency — a retried create returns the existing row.
  if (body.localId) {
    const existing = await repo.findByLocalId(visitId, body.localId);
    if (existing) return ctx.json(existing, 201);
  }

  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError(`Cannot add findings to a ${visit.status} visit`, 'VISIT_IMMUTABLE');
  }

  const finding = await repo.createOne({
    visitId,
    patientId: visit.patientId,
    toothNumber: body.toothNumber,
    surface: body.surface,
    conditionCode: body.conditionCode as ConditionCode,
    note: body.note,
    localId: body.localId,
    createdBy: user.id,
    updatedBy: user.id,
  });

  return ctx.json(finding, 201);
}
