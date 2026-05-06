/**
 * addFollowUpNote — POST /dental/patients/:id/follow-up-notes
 *
 * FR2.12: Add a follow-up note to a patient.
 * Delegated from followUpNotes.ts; re-exported here for codegen registry.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { FollowUpNote } from '../patient/repos/patient.schema';
import { patients } from '../patient/repos/patient.schema';
import { eq } from 'drizzle-orm';
import type { AddFollowUpNoteBody, AddFollowUpNoteParams } from '@/generated/openapi/validators';

export async function addFollowUpNote(
  ctx: ValidatedContext<AddFollowUpNoteBody, never, AddFollowUpNoteParams>
): Promise<Response> {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const patientId = params.id;
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId as string);
  }

  const newNote: FollowUpNote = {
    id: crypto.randomUUID(),
    text: body.text,
    createdAt: new Date().toISOString(),
    createdBy: user.id,
  };

  const existingNotes: FollowUpNote[] = (patient as any).followUpNotes ?? [];
  const updatedNotes = [...existingNotes, newNote];

  // Append note to JSONB array
  await db
    .update(patients)
    .set({ followUpNotes: updatedNotes as any, updatedAt: new Date() })
    .where(eq(patients.id, patientId));

  // Also set needsFollowUp=true when a follow-up note is added
  await db
    .update(patients)
    .set({ needsFollowUp: true, updatedAt: new Date() })
    .where(eq(patients.id, patientId));

  logger?.info({ action: 'addFollowUpNote', patientId, noteId: newNote.id }, 'Follow-up note added');

  return ctx.json({ note: newNote, total: updatedNotes.length }, 201);
}
