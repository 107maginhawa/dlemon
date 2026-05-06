/**
 * updateDentalPatient — PATCH /dental/patients/:id
 *
 * FR2.9:  Status management (active/archived)
 * FR2.16: Emergency contact fields
 * FR2.17: Communication preferences fields
 * FR2.18: Recall / next visit tracking
 */

import { z } from 'zod';
import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

const updateDentalPatientSchema = z.object({
  needsFollowUp: z.boolean().optional(),
  dentalHistorySummary: z.string().optional().nullable(),
  preferredBranchId: z.string().optional().nullable(),
  status: z.enum(['active', 'archived']).optional(),
  emergencyContact: z.any().optional(),
  communicationPreferences: z.any().optional(),
  recallDate: z.string().optional().nullable(),
  recallNote: z.string().optional().nullable(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'No updatable fields provided' }
);

export async function updateDentalPatient(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('id');
  if (!patientId) throw new NotFoundError('Patient not found');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const rawBody = await ctx.req.json();
  const body = updateDentalPatientSchema.parse(rawBody);

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId as string);
  }

  const updates: Record<string, any> = {};

  if (body.needsFollowUp !== undefined) updates.needsFollowUp = body.needsFollowUp;
  if (body.dentalHistorySummary !== undefined) updates.dentalHistorySummary = body.dentalHistorySummary;
  if (body.preferredBranchId !== undefined) updates.preferredBranchId = body.preferredBranchId;

  // FR2.9: Status management
  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === 'archived') updates.archivedAt = new Date();
    if (body.status === 'active') updates.archivedAt = null;
  }

  // FR2.16: Emergency contact
  if (body.emergencyContact !== undefined) {
    updates.emergencyContact = body.emergencyContact;
  }

  // FR2.17: Communication preferences
  if (body.communicationPreferences !== undefined) {
    updates.communicationPreferences = body.communicationPreferences;
  }

  // FR2.18: Recall date + note
  if (body.recallDate !== undefined) updates.recallDate = body.recallDate;
  if (body.recallNote !== undefined) updates.recallNote = body.recallNote;

  updates.updatedBy = user.id;
  const updated = await repo.updateOneById(patientId, updates);

  logger?.info({ action: 'updateDentalPatient', patientId, updates }, 'Dental patient updated');

  return ctx.json(updated, 200);
}
