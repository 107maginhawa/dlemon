/**
 * createCollectionNote — POST /dental/billing/collections/notes
 *
 * Phase 2.4 (BR-051): log a collections outreach attempt against an overdue
 * patient. Append-only + audited. The branch is the caller's explicit branchId
 * (membership asserted) or the patient's preferred branch; the logging staff's
 * active membership is stamped as createdByMemberId.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getBranchOrgId, getActiveMembershipId } from '@/handlers/dental-org/repos/org-billing.facade';
import { getPatientBranchForBilling } from '@/handlers/patient/repos/patient-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import { DentalCollectionNoteRepository } from './repos/dental-collection-note.repo';
import type { CreateCollectionNoteBody } from '@/generated/openapi/validators';

export async function createCollectionNote(
  ctx: ValidatedContext<CreateCollectionNoteBody, never, never>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const body = ctx.req.valid('json');

  const patient = await getPatientBranchForBilling(db, body.patientId);
  if (!patient) throw new NotFoundError('Patient');

  // Branch: explicit (asserts membership) or the patient's preferred branch.
  const branchId = body.branchId ?? patient.preferredBranchId;
  if (!branchId) throw new ValidationError('No branch for collection note (patient has no preferred branch)');
  await assertBranchAccess(db, user.id, branchId);

  const membership = await getActiveMembershipId(db, user.id, branchId);
  const contactedAt = body.contactedAt ? new Date(body.contactedAt) : new Date();

  const note = await new DentalCollectionNoteRepository(db).create({
    branchId,
    patientId: body.patientId,
    invoiceId: body.invoiceId ?? null,
    note: body.note,
    contactChannel: body.contactChannel,
    contactedAt,
    createdByMemberId: membership?.id ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  const org = await getBranchOrgId(db, branchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: org?.organizationId ?? branchId,
    branchId,
    eventType: 'data-modification',
    action: 'collection_note.created',
    resourceType: 'dental_collection_note',
    resourceId: note.id,
    metadata: { patientId: body.patientId, contactChannel: body.contactChannel },
  }, { failClosed: true });

  return ctx.json({
    id: note.id,
    patientId: note.patientId,
    invoiceId: note.invoiceId ?? undefined,
    branchId: note.branchId,
    note: note.note,
    contactChannel: note.contactChannel,
    contactedAt: note.contactedAt.toISOString(),
    createdByMemberId: note.createdByMemberId ?? undefined,
    createdAt: note.createdAt.toISOString(),
  }, 201);
}
