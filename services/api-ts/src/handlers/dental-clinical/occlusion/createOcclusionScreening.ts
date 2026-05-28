/**
 * createOcclusionScreening — POST /dental/patients/:patientId/occlusion-screenings
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForClinical } from '@/handlers/patient/repos/patient-clinical.facade';
import { OcclusionScreeningRepository } from '../repos/occlusion-screening.repo';
import type { DatabaseInstance } from '@/core/database';

export async function createOcclusionScreening(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForClinical(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

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
