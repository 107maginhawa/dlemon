/**
 * listFollowUpNotes — GET /dental/patients/:id/follow-up-notes
 *
 * FR2.12: List follow-up notes for a patient.
 * Delegated from followUpNotes.ts; re-exported here for codegen registry.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { PatientRepository } from '../../patient/repos/patient.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { FollowUpNote } from '../../patient/repos/patient.schema';
import type { ListFollowUpNotesParams } from '@/generated/openapi/validators';

// V-PAT-003: follow-up notes are restricted to clinical/full-staff roles.
const FOLLOW_UP_ROLES = ['staff_full', 'dentist_associate', 'dentist_owner'] as const;

export async function listFollowUpNotes(
  ctx: ValidatedContext<never, never, ListFollowUpNotesParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const patientId = params.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // V-PAT-002/003: branch+role guard; a missing branch DENIES (never bypasses).
  if (!patient.preferredBranchId) {
    throw new ForbiddenError('Patient has no assigned branch');
  }
  await assertBranchRole(db, user.id, patient.preferredBranchId as string, [...FOLLOW_UP_ROLES]);

  const notes: FollowUpNote[] = patient.followUpNotes ?? [];

  return ctx.json({ notes, total: notes.length }, 200);
}
