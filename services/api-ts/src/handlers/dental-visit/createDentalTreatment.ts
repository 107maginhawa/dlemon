/**
 * createDentalTreatment handler
 *
 * POST /dental/visits/{visitId}/treatments
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { TreatmentRepository } from './repos/treatment.repo';
import type { User } from '@/types/auth';

export async function createDentalTreatment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['cdtCode'] || typeof body['cdtCode'] !== 'string') throw new ValidationError('cdtCode is required');
  if (!body['description'] || typeof body['description'] !== 'string') throw new ValidationError('description is required');
  if (typeof body['priceCents'] !== 'number') throw new ValidationError('priceCents is required and must be a number');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new TreatmentRepository(db);

  const treatment = await repo.createOne({
    visitId,
    patientId: body['patientId'] as string,
    cdtCode: body['cdtCode'] as string,
    description: body['description'] as string,
    toothNumber: typeof body['toothNumber'] === 'number' ? body['toothNumber'] : undefined,
    surfaces: Array.isArray(body['surfaces']) ? body['surfaces'] as string[] : undefined,
    conditionCode: typeof body['conditionCode'] === 'string' ? body['conditionCode'] : undefined,
    priceCents: body['priceCents'] as number,
    carriedOver: false,
  });

  return ctx.json(treatment, 201);
}
