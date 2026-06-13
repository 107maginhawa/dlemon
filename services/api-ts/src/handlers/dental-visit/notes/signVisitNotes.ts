/**
 * signVisitNotes handler
 *
 * POST /dental/visits/{visitId}/notes/sign
 *
 * Signs and locks a visit note. Once signed:
 *   - The note is immutable (upsert returns NOTE_SIGNED)
 *   - A v1 snapshot is frozen in visit_note_version
 *   - Corrections must go through createVisitNoteAddendum
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { VisitNotesRepository } from '../repos/treatment.repo';
import { VisitRepository } from '../repos/visit.repo';
import { logAuditEvent } from '@/core/audit-logger';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import type { User } from '@/types/auth';
import type { SignVisitNotesBody, SignVisitNotesParams } from '@/generated/openapi/validators';

export async function signVisitNotes(
  ctx: ValidatedContext<SignVisitNotesBody, never, SignVisitNotesParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  // E3: signing a GENERAL visit's notes stays dentist-only (owner/associate).
  // On a HYGIENE-typed visit, the hygienist may sign their own notes. The hygienist
  // is added to the allowed set ONLY when the visit is hygiene-typed — never on general.
  const signRoles =
    visit.visitType === 'hygiene'
      ? (['dentist_owner', 'dentist_associate', 'hygienist'] as const)
      : (['dentist_owner', 'dentist_associate'] as const);
  await assertBranchRole(db, user.id, visit.branchId, [...signRoles]);

  const repo = new VisitNotesRepository(db);
  const note = await repo.findByVisit(visitId);
  if (!note) throw new NotFoundError('Visit note');

  if (note.signed) {
    throw new BusinessLogicError('Visit note is already signed', 'NOTE_ALREADY_SIGNED');
  }

  const { note: signed } = await repo.sign(note.id, user.id);

  // dental-audit P1-B: signing freezes an immutable clinical record — write an
  // audit row so an owner can see who signed/locked the note and when.
  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? visit.branchId,
    branchId: visit.branchId,
    eventType: 'data-modification',
    action: 'visit_note.signed',
    resourceType: 'dental_visit_note',
    resourceId: note.id,
    metadata: { visitId },
  });

  logger?.info(
    { requestId: ctx.get('requestId'), action: 'visit_note_sign', noteId: note.id, visitId, by: user.id },
    'Visit note signed and locked',
  );

  return ctx.json(signed);
}
