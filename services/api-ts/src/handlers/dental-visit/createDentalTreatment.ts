/**
 * createDentalTreatment handler
 *
 * POST /dental/visits/{visitId}/treatments
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, BusinessLogicError } from '@/core/errors';
import { TreatmentRepository } from './repos/treatment.repo';
import { VisitRepository } from './repos/visit.repo';
import { DentalChartRepository } from './repos/dental-chart.repo';
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
  const visitRepo = new VisitRepository(db);

  // FR1.16: Immutability — cannot add treatments to completed/locked visits
  const visit = await visitRepo.findOneById(visitId);
  if (visit && (visit.status === 'completed' || visit.status === 'locked')) {
    throw new BusinessLogicError(
      `Cannot add treatments to a ${visit.status} visit`,
      'VISIT_IMMUTABLE'
    );
  }

  // EC2: Block treatment on extracted tooth
  if (typeof body['toothNumber'] === 'number') {
    const chartRepo = new DentalChartRepository(db);
    const chart = visit ? await chartRepo.findByVisit(visit.id) : null;
    if (chart) {
      const toothState = chart.teeth.find((t: any) => t.toothNumber === body['toothNumber']);
      if (toothState?.state === 'extracted') {
        throw new BusinessLogicError(
          `Tooth ${body['toothNumber']} is extracted — cannot add pending treatments`,
          'TOOTH_EXTRACTED'
        );
      }
    }
  }

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
