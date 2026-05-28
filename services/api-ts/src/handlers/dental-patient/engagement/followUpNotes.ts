/**
 * Follow-up notes handlers — FR2.12
 *
 * GET  /dental/patients/:id/follow-up-notes  — list notes
 * POST /dental/patients/:id/follow-up-notes  — add note
 */

import { z } from 'zod';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '../../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { FollowUpNote } from '../../patient/repos/patient.schema';
import { sql } from 'drizzle-orm';
import { patients } from '../../patient/repos/patient.schema';
import { eq } from 'drizzle-orm';

const addFollowUpNoteSchema = z.object({
  text: z.string().min(1, 'text is required'),
});

export async function listFollowUpNotes(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('id');
  if (!patientId) throw new NotFoundError('Patient not found');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId as string);
  }

  const notes: FollowUpNote[] = patient.followUpNotes ?? [];

  return ctx.json({ notes, total: notes.length }, 200);
}

export async function addFollowUpNote(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('id');
  if (!patientId) throw new NotFoundError('Patient not found');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const rawBody = await ctx.req.json();
  const { text } = addFollowUpNoteSchema.parse(rawBody);

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId as string);
  }

  const newNote: FollowUpNote = {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    createdBy: user.id,
  };

  const existingNotes: FollowUpNote[] = patient.followUpNotes ?? [];
  const updatedNotes = [...existingNotes, newNote];

  // Append note to JSONB array
  await db
    .update(patients)
    .set({ followUpNotes: updatedNotes, updatedAt: new Date() })
    .where(eq(patients.id, patientId));

  // Also set needsFollowUp=true when a follow-up note is added
  await db
    .update(patients)
    .set({ needsFollowUp: true, updatedAt: new Date() })
    .where(eq(patients.id, patientId));

  logger?.info({ action: 'addFollowUpNote', patientId, noteId: newNote.id }, 'Follow-up note added');

  return ctx.json({ note: newNote, total: updatedNotes.length }, 201);
}
