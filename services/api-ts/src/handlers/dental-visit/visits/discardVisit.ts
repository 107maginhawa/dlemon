/**
 * discardVisit handler
 *
 * POST /dental/visits/{visitId}/discard
 *
 * The owner-initiated escape hatch behind the one-active-visit rule: an OPEN
 * (active/draft) visit that carries no durable clinical/financial/legal artifact
 * can be abandoned (→ discarded), which dismisses its pending treatments so the
 * patient is no longer wedged ("Active visit already exists… complete OR discard
 * it first"). Mirrors the void/cancel pattern: owner-only, reason required,
 * fail-closed audit.
 */
import type { ValidatedContext } from '@/types/app';
import type { DiscardVisitBody, DiscardVisitParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { countAttachmentsForVisit, hasSignedConsentForVisit } from '@/handlers/dental-clinical/repos/clinical-visit.facade';
import { logAuditEvent } from '@/core/audit-logger';
import { VisitRepository } from '../repos/visit.repo';
import { TreatmentRepository } from '../repos/treatment.repo';
import type { User } from '@/types/auth';

export async function discardVisit(
  ctx: ValidatedContext<DiscardVisitBody, never, DiscardVisitParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const { reason } = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');

  // Discarding clinical work is owner-only (mirrors payment void).
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner']);

  // Only an OPEN visit can be discarded — completed/locked are durable records.
  if (visit.status !== 'active' && visit.status !== 'draft') {
    throw new BusinessLogicError(
      `Cannot discard a ${visit.status} visit — only an open visit can be discarded.`,
      'VISIT_NOT_DISCARDABLE',
    );
  }

  // Safe-to-discard guard: refuse if any durable clinical/financial/legal artifact
  // exists. Discard is for abandoning a visit where nothing real happened.
  const treatmentRepo = new TreatmentRepository(db);
  const treatments = await treatmentRepo.findByVisit(visitId);

  const hasPerformedWork = treatments.some((t) => t.status === 'performed' || t.status === 'verified');
  const hasBilledWork = treatments.some((t) => t.billedInvoiceId != null);
  if (hasPerformedWork || hasBilledWork) {
    throw new BusinessLogicError(
      'Cannot discard a visit with performed or billed treatments — complete it instead.',
      'VISIT_NOT_DISCARDABLE',
    );
  }
  if (await hasSignedConsentForVisit(db, visitId)) {
    throw new BusinessLogicError(
      'Cannot discard a visit with a signed consent form.',
      'VISIT_NOT_DISCARDABLE',
    );
  }
  if ((await countAttachmentsForVisit(db, visitId)) > 0) {
    throw new BusinessLogicError(
      'Cannot discard a visit with attachments.',
      'VISIT_NOT_DISCARDABLE',
    );
  }

  // Dismiss the open (diagnosed/planned) treatments, then discard the visit.
  // (Sequential, mirroring voidDentalPayment — repos are constructed from `db`.)
  const openTreatments = treatments.filter((t) => t.status === 'diagnosed' || t.status === 'planned');
  for (const t of openTreatments) {
    await treatmentRepo.dismiss(t.id, 'Visit discarded');
  }

  const discarded = await visitRepo.discard(visitId);
  if (!discarded) throw new NotFoundError('Dental visit');

  // V-VIS-DISCARD: owner abandonment of a visit is a material clinical-record
  // action — fail-closed audit with reason + before/after (mirrors payment void).
  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? visit.branchId,
    branchId: visit.branchId,
    eventType: 'data-modification',
    action: 'visit.discard',
    resourceType: 'dental_visit',
    resourceId: visitId,
    reason,
    before: { status: visit.status },
    after: { status: 'discarded' },
    metadata: { dismissedTreatmentCount: openTreatments.length },
  }, { failClosed: true });

  return ctx.json(discarded, 200);
}
