/**
 * createOcclusionScreening — POST /dental/patients/:patientId/occlusion-screenings
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForClinical } from '@/handlers/patient/repos/patient-clinical.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { OcclusionScreeningRepository } from '../repos/occlusion-screening.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function createOcclusionScreening(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as { patientId: string };
  const body = ctx.req.valid('json') as { visitId?: string | null; angleClass?: 'class_i' | 'class_ii_div1' | 'class_ii_div2' | 'class_iii' | 'edge_to_edge' | null; overbiteMm?: number | null; overjetMm?: number | null; crossbite?: boolean; crowding?: boolean; spacing?: boolean; midlineDeviation?: string | null; notes?: string | null };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForClinical(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization via patient's preferred branch (mutation)
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, ['dentist_owner', 'dentist_associate']);

  const repo = new OcclusionScreeningRepository(db, logger);
  const screening = await repo.create({
    patientId,
    visitId: body.visitId ?? null,
    angleClass: body.angleClass ?? null,
    overbiteMm: body.overbiteMm ?? null,
    overjetMm: body.overjetMm ?? null,
    crossbite: body.crossbite ?? false,
    crowding: body.crowding ?? false,
    spacing: body.spacing ?? false,
    midlineDeviation: body.midlineDeviation ?? null,
    notes: body.notes ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createOcclusionScreening', patientId, screeningId: screening.id }, 'Occlusion screening created');

  return ctx.json(screening, 201);
}
