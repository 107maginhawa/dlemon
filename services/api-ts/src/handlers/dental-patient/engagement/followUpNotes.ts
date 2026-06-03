/**
 * Follow-up notes handlers — FR2.12
 *
 * GET  /dental/patients/:id/follow-up-notes  — list notes
 * POST /dental/patients/:id/follow-up-notes  — add note
 */

import { z } from 'zod';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getDentalPatientRecord } from '../../patient/repos/patient-dental-patient.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { FollowUpNote } from '../../patient/repos/patient-dental-patient.facade';
import { patients } from '../../patient/repos/patient.schema';
import { eq } from 'drizzle-orm';

// V-PAT-003: follow-up notes are restricted to clinical/full-staff roles.
const FOLLOW_UP_ROLES = ['staff_full', 'dentist_associate', 'dentist_owner'] as const;

// V-PAT-013: note text must be 5–2000 characters.
const addFollowUpNoteSchema = z.object({
  text: z.string().min(5, 'text must be at least 5 characters').max(2000, 'text must be at most 2000 characters'),
});

export async function listFollowUpNotes(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('id');
  if (!patientId) throw new NotFoundError('Patient not found');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getDentalPatientRecord(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // V-PAT-002/003: branch+role guard; a missing branch DENIES (never bypasses).
  if (!patient.preferredBranchId) {
    throw new ForbiddenError('Patient has no assigned branch');
  }
  await assertBranchRole(db, user.id, patient.preferredBranchId as string, [...FOLLOW_UP_ROLES]);

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

  const patient = await getDentalPatientRecord(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  // V-PAT-002/003: branch+role guard; a missing branch DENIES (never bypasses).
  if (!patient.preferredBranchId) {
    throw new ForbiddenError('Patient has no assigned branch');
  }
  await assertBranchRole(db, user.id, patient.preferredBranchId as string, [...FOLLOW_UP_ROLES]);

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
