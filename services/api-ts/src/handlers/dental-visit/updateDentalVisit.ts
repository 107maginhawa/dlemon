/**
 * updateDentalVisit handler
 *
 * PATCH /dental/visits/{visitId}
 * Updates visit status or chiefComplaint.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitRepository } from './repos/visit.repo';
import { VISIT_TRANSITIONS, type DentalVisitStatus } from './repos/visit.schema';
import { TreatmentRepository, VisitNotesRepository } from './repos/treatment.repo';
import { ConsentFormRepository } from '@/handlers/dental-clinical/repos/consent-form.repo';
import { AttachmentRepository } from '@/handlers/dental-clinical/repos/attachment.repo';
import type { User } from '@/types/auth';
import type { UpdateDentalVisitBody, UpdateDentalVisitParams } from '@/generated/openapi/validators';

export async function updateDentalVisit(
  ctx: ValidatedContext<UpdateDentalVisitBody, never, UpdateDentalVisitParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new VisitRepository(db);

  const visit = await repo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');

  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // FR1.16: Immutability — completed/locked visits cannot be modified
  if (visit.status === 'locked') {
    throw new BusinessLogicError('Locked visits cannot be modified', 'VISIT_LOCKED');
  }

  // Validate status transition using VISIT_TRANSITIONS map
  if (body.status && body.status !== visit.status) {
    const allowed = VISIT_TRANSITIONS[visit.status as DentalVisitStatus] ?? [];
    if (!allowed.includes(body.status as DentalVisitStatus)) {
      throw new BusinessLogicError(
        `Cannot transition visit from ${visit.status} to ${body.status}`,
        'VISIT_TRANSITION_INVALID'
      );
    }
  }

  // chiefComplaint edits blocked on completed/locked
  if (visit.status === 'completed' && body.chiefComplaint !== undefined && body.status === undefined) {
    throw new BusinessLogicError('Completed visit notes cannot be edited', 'VISIT_IMMUTABLE');
  }

  const patch: Partial<{ status: DentalVisitStatus; chiefComplaint: string }> = {};

  if (body.status !== undefined) {
    patch.status = body.status as DentalVisitStatus;
  }

  if (body.chiefComplaint !== undefined) {
    patch.chiefComplaint = body.chiefComplaint;
  }

  const log = ctx.get('logger');
  const requestId = ctx.get('requestId');

  // Apply lifecycle timestamps on status transitions
  if (patch.status === 'active') {
    const activated = await repo.activate(visitId);
    if (!activated) throw new NotFoundError('Dental visit');
    if (patch.chiefComplaint) await repo.updateStatus(visitId, { chiefComplaint: patch.chiefComplaint });
    const updated = patch.chiefComplaint ? await repo.findOneById(visitId) ?? activated : activated;
    log?.info({ requestId, action: 'dental_visit_activate', visitId, by: user.id }, 'Visit activated');
    return ctx.json(updated);
  }

  if (patch.status === 'completed') {
    const treatRepo = new TreatmentRepository(db);
    const treatments = await treatRepo.findByVisit(visitId);

    const notesRepo = new VisitNotesRepository(db);
    const notes = await notesRepo.findByVisit(visitId);

    const attachmentRepo = new AttachmentRepository(db);
    const attachments = await attachmentRepo.findMany({ visitId });

    // BR-005: Auto-discard an empty visit (no treatments, no notes, no attachments).
    // When the session ends with nothing recorded, discard instead of completing.
    // createDentalVisit always seeds an empty notes row, so check for meaningful
    // SOAP content rather than mere existence of the row.
    const hasNoTreatments = treatments.length === 0;
    const hasNoNotes = !notes || (!notes.subjective && !notes.objective && !notes.assessment && !notes.plan);
    const hasNoAttachments = attachments.length === 0;

    if (hasNoTreatments && hasNoNotes && hasNoAttachments) {
      const discardedRaw = await repo.discard(visitId);
      if (!discardedRaw) throw new NotFoundError('Dental visit');
      if (patch.chiefComplaint) await repo.updateStatus(visitId, { chiefComplaint: patch.chiefComplaint });
      const discarded = patch.chiefComplaint ? await repo.findOneById(visitId) ?? discardedRaw : discardedRaw;
      log?.info({ requestId, action: 'dental_visit_discard', visitId, by: user.id }, 'Empty visit auto-discarded (BR-005)');
      return ctx.json(discarded);
    }

    // Non-empty visit — enforce normal completion guards
    if (treatments.some(t => t.status === 'diagnosed' || t.status === 'planned')) {
      throw new BusinessLogicError('Visit has incomplete treatments', 'VISIT_HAS_OPEN_TREATMENTS');
    }

    const consentRepo = new ConsentFormRepository(db);
    const consents = await consentRepo.findMany({ visitId });
    if (!consents.some(c => c.signed)) {
      throw new BusinessLogicError('Signed consent form required before completing visit', 'VISIT_CONSENT_REQUIRED');
    }

    if (!notes) {
      throw new BusinessLogicError('Visit notes required before completing visit', 'VISIT_NOTES_REQUIRED');
    }

    const completedRaw = await repo.complete(visitId);
    if (!completedRaw) throw new NotFoundError('Dental visit');
    if (patch.chiefComplaint) await repo.updateStatus(visitId, { chiefComplaint: patch.chiefComplaint });
    const updated = patch.chiefComplaint ? await repo.findOneById(visitId) ?? completedRaw : completedRaw;
    log?.info({ requestId, action: 'dental_visit_complete', visitId, by: user.id }, 'Visit completed');
    return ctx.json(updated);
  }

  if (patch.status === 'locked') {
    const locked = await repo.lock(visitId);
    if (!locked) throw new NotFoundError('Dental visit');
    log?.info({ requestId, action: 'dental_visit_lock', visitId, by: user.id }, 'Visit locked');
    return ctx.json(locked);
  }

  const updated = await repo.updateStatus(visitId, patch);
  return ctx.json(updated);
}
