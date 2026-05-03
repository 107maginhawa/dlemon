/**
 * updateDentalPatient — PATCH /dental/patients/:id
 *
 * FR2.9:  Status management (active/archived)
 * FR2.16: Emergency contact fields
 * FR2.17: Communication preferences fields
 * FR2.18: Recall / next visit tracking
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';

const VALID_STATUSES = ['active', 'archived'] as const;

export async function updateDentalPatient(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('id');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const updates: Record<string, any> = {};

  if (body.needsFollowUp !== undefined) updates.needsFollowUp = Boolean(body.needsFollowUp);
  if (body.dentalHistorySummary !== undefined) updates.dentalHistorySummary = body.dentalHistorySummary;
  if (body.preferredBranchId !== undefined) updates.preferredBranchId = body.preferredBranchId;

  // FR2.9: Status management
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      throw new ValidationError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
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

  if (Object.keys(updates).length === 0) {
    throw new ValidationError('No updatable fields provided');
  }

  updates.updatedBy = user.id;
  const updated = await repo.updateOneById(patientId, updates);

  logger?.info({ action: 'updateDentalPatient', patientId, updates }, 'Dental patient updated');

  return ctx.json(updated, 200);
}
