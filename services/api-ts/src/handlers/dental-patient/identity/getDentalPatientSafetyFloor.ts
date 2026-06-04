/**
 * getDentalPatientSafetyFloor — GET /dental/patients/:id/safety-floor
 *
 * FR2.15: Aggregate patient safety data: active allergies, current medications,
 *          active conditions from medical history.
 *
 * "Safety Floor" = the minimum set of safety-critical information a dentist
 * must review before any procedure.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getDentalPatientRecord } from '../../patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
import { getActiveMedicalHistoryByPatientId } from '../../dental-clinical/repos/clinical-dental-patient.facade';
import type { GetDentalPatientSafetyFloorParams } from '@/generated/openapi/validators';

export async function getDentalPatientSafetyFloor(
  ctx: ValidatedContext<never, never, GetDentalPatientSafetyFloorParams>
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const patientId = params.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getDentalPatientRecord(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // Fetch all active medical history entries for this patient
  const entries = await getActiveMedicalHistoryByPatientId(db, patientId);

  const allergies = entries.filter(e => e.entryType === 'allergy');
  const medications = entries.filter(e => e.entryType === 'medication');
  const conditions = entries.filter(e => e.entryType === 'condition');

  const hasAlerts = allergies.length > 0;

  logger?.info({ action: 'getDentalPatientSafetyFloor', patientId, allergiesCount: allergies.length }, 'Safety floor retrieved');

  // EF-PAT-005: audit READ of safety-critical PHI
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.safety_floor.read',
    resourceType: 'dental_patient_safety_floor',
    resourceId: patientId,
  });

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
