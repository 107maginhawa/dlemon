/**
 * listChartConflicts handler — P0-A
 *
 * GET /dental/visits/chart-conflicts/{patientId}
 *
 * Lists open (unresolved) dental chart sync conflicts for a patient across all
 * visits. The server already persists a rejected stale offline write to
 * dental_chart.conflictPayload (syncStatus='conflict'); this surfaces them so a
 * clinician can see and resolve dropped clinical edits.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { DentalChartRepository } from './repos/dental-chart.repo';
import type { ToothChartState } from './repos/dental-chart.schema';
import type { ListChartConflictsParams } from '@/generated/openapi/validators';
import type { User } from '@/types/auth';

interface ConflictPayload {
  reason?: string;
  rejectedTeeth?: ToothChartState[];
}

export async function listChartConflicts(
  ctx: ValidatedContext<never, never, ListChartConflictsParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  // Authorize against the PATIENT's branch (mirrors getTreatmentPlan / V-VIS-011).
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const repo = new DentalChartRepository(db);
  const charts = await repo.listConflicts(patientId);

  const conflicts = charts.map((chart) => {
    const payload = (chart.conflictPayload ?? {}) as ConflictPayload;
    return {
      chartId: chart.id,
      visitId: chart.visitId,
      patientId: chart.patientId,
      reason: payload.reason ?? 'stale_clock_rejected',
      rejectedTeeth: payload.rejectedTeeth ?? [],
      detectedAt: chart.updatedAt,
    };
  });

  return ctx.json(conflicts, 200);
}
