/**
 * listFollowUpNotes — GET /dental/patients/:id/follow-up-notes
 *
 * FR2.12: List follow-up notes for a patient.
 * Delegated from followUpNotes.ts; re-exported here for codegen registry.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { FollowUpNote } from '../patient/repos/patient.schema';
import type { ListFollowUpNotesParams } from '@/generated/openapi/validators';

export async function listFollowUpNotes(
  ctx: ValidatedContext<never, never, ListFollowUpNotesParams>
): Promise<Response> {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const patientId = params.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId as string);
  }

  const notes: FollowUpNote[] = (patient as any).followUpNotes ?? [];

  return ctx.json({ notes, total: notes.length }, 200);
}
