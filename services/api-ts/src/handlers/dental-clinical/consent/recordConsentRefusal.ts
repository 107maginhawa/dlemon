/**
 * recordConsentRefusal handler (P1-3)
 *
 * POST /dental/visits/{visitId}/consent-refusals
 *
 * Records a patient's explicit, attributed refusal of recommended treatment.
 * Distinct from consent grants — this is the informed-refusal path (ADA).
 * Records are immutable once created.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { ConsentRefusalRepository } from '../repos/consent-refusal.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { RecordConsentRefusalBody, RecordConsentRefusalParams } from '@/generated/openapi/validators';

export async function recordConsentRefusal(
  ctx: ValidatedContext<RecordConsentRefusalBody, never, RecordConsentRefusalParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, visitId);
  // V-CLN-006: consent actions require dentist role
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // BR-003: writes to locked or completed visits are blocked
  if (visit.status === 'locked' || visit.status === 'completed') {
    throw new BusinessLogicError('Cannot record refusal on a locked or completed visit', 'VISIT_IMMUTABLE');
  }

  const repo = new ConsentRefusalRepository(db);

  const refusal = await repo.createOne({
    visitId,
    patientId: body.patientId,
    refusingMemberId: body.refusingMemberId,
    procedureDescription: body.procedureDescription,
    refusalReason: body.refusalReason,
    patientAcknowledgement: body.patientAcknowledgement,
    refusedAt: new Date(),
  });

  ctx.get('logger')?.info(
    { requestId: ctx.get('requestId'), action: 'dental_consent_refusal_record', refusalId: refusal.id, visitId, by: user.id },
    'Informed refusal recorded',
  );

  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  await logAuditEvent(db, ctx.get('logger'), {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? visit.branchId,
    branchId: visit.branchId,
    action: 'consent.refused',
    resourceType: 'dental_consent_refusal',
    resourceId: refusal.id,
    metadata: { visitId, patientId: body.patientId, refusingMemberId: body.refusingMemberId },
  });

  return ctx.json(refusal, 201);
}
