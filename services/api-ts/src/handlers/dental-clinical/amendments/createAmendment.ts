/**
 * createAmendment handler
 *
 * POST /dental/visits/{visitId}/amendments
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { AmendmentRepository } from '../repos/amendment.repo';
import { PrescriptionRepository } from '../repos/prescription.repo';
import { ConsentFormRepository } from '../repos/consent-form.repo';
import { LabOrderRepository } from '../repos/lab-order.repo';
import { MedicalHistoryRepository } from '../repos/medical-history.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getActiveMembershipForClinical } from '@/handlers/dental-org/repos/org-clinical.facade';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { CreateAmendmentBody, CreateAmendmentParams } from '@/generated/openapi/validators';

/**
 * V-CLN-011: validate that originalRecordId resolves for the dental-clinical record
 * types this module owns. Cross-module / free-form types (treatment, note, …) are not
 * validated here — this module cannot assert their existence without coupling to other
 * bounded contexts — so they pass through unchecked.
 */
async function originalRecordResolves(
  db: DatabaseInstance,
  recordType: string,
  recordId: string,
): Promise<boolean> {
  switch (recordType) {
    case 'prescription':
      return (await new PrescriptionRepository(db).findOneById(recordId)) !== null;
    case 'consent':
    case 'consentForm':
      return (await new ConsentFormRepository(db).findOneById(recordId)) !== null;
    case 'labOrder':
      return (await new LabOrderRepository(db).findOneById(recordId)) !== null;
    case 'medicalHistory':
      return (await new MedicalHistoryRepository(db).findOneById(recordId)) !== null;
    default:
      // Not an in-module record type — cannot validate, treat as resolvable.
      return true;
  }
}

export async function createAmendment(
  ctx: ValidatedContext<CreateAmendmentBody, never, CreateAmendmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit.
  // EM-CLI-011: use assertBranchRole (role-aware) instead of getActiveMembershipId
  // (which only checks membership existence, not role). Amendments are restricted to
  // dentist_owner and dentist_associate per MODULE_SPEC §6.
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // Resolve caller's membership id for the audit trail (authorMemberId).
  // assertBranchRole above already guarantees this row exists; the cast is safe.
  const callerMembership = await getActiveMembershipForClinical(db, user.id, visit.branchId);

  const authorMemberId = callerMembership!.id;

  // V-CLN-011: reject amendments that reference a non-existent in-module record
  // (prevents dangling references on the clinical audit trail).
  const resolves = await originalRecordResolves(db, body.originalRecordType, body.originalRecordId);
  if (!resolves) {
    throw new NotFoundError(`Original ${body.originalRecordType} record`);
  }

  const repo = new AmendmentRepository(db);

  const amendment = await repo.createOne({
    visitId,
    patientId: body.patientId,
    authorMemberId,
    originalRecordType: body.originalRecordType,
    originalRecordId: body.originalRecordId,
    reason: body.reason,
    content: body.content,
  });

  // V-CLN-010 / WF-038: persist the clinical.amendment.created audit referencing both
  // the original record and the new amendment.
  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  await logAuditEvent(db, ctx.get('logger'), {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? visit.branchId,
    branchId: visit.branchId,
    action: 'clinical.amendment.created',
    resourceType: 'dental_amendment',
    resourceId: amendment.id,
    metadata: {
      visitId,
      patientId: body.patientId,
      originalRecordType: body.originalRecordType,
      originalRecordId: body.originalRecordId,
    },
  });

  return ctx.json(amendment, 201);
}
