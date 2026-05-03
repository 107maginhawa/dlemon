/**
 * getDentalPatientSafetyFloor — GET /dental/patients/:id/safety-floor
 *
 * FR2.15: Aggregate patient safety data: active allergies, current medications,
 *          active conditions from medical history.
 *
 * "Safety Floor" = the minimum set of safety-critical information a dentist
 * must review before any procedure.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';
import { medicalHistoryEntries } from '../dental-clinical/repos/medical-history.schema';
import { eq, and } from 'drizzle-orm';

export async function getDentalPatientSafetyFloor(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('id');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Fetch all active medical history entries for this patient
  const entries = await db
    .select()
    .from(medicalHistoryEntries)
    .where(
      and(
        eq(medicalHistoryEntries.patientId, patientId),
        eq(medicalHistoryEntries.active, true)
      )
    );

  const allergies = entries.filter(e => e.entryType === 'allergy');
  const medications = entries.filter(e => e.entryType === 'medication');
  const conditions = entries.filter(e => e.entryType === 'condition');

  const hasAlerts = allergies.length > 0;

  logger?.info({ action: 'getDentalPatientSafetyFloor', patientId, allergiesCount: allergies.length }, 'Safety floor retrieved');

  return ctx.json({
    patientId,
    hasAlerts,
    allergies: allergies.map(e => ({
      id: e.id,
      displayName: e.displayName,
      code: e.code,
      codeSystem: e.codeSystem,
      notes: e.notes,
      onsetDate: e.onsetDate,
    })),
    medications: medications.map(e => ({
      id: e.id,
      displayName: e.displayName,
      code: e.code,
      codeSystem: e.codeSystem,
      notes: e.notes,
    })),
    conditions: conditions.map(e => ({
      id: e.id,
      displayName: e.displayName,
      code: e.code,
      codeSystem: e.codeSystem,
      notes: e.notes,
      onsetDate: e.onsetDate,
    })),
    retrievedAt: new Date().toISOString(),
  }, 200);
}
