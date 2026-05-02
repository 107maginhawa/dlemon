/**
 * createLabOrder handler
 *
 * POST /dental/visits/{visitId}/lab-orders
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError } from '@/core/errors';
import { LabOrderRepository } from './repos/lab-order.repo';
import type { User } from '@/types/auth';

export async function createLabOrder(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['labName'] || typeof body['labName'] !== 'string') throw new ValidationError('labName is required');
  if (!body['description'] || typeof body['description'] !== 'string') throw new ValidationError('description is required');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new LabOrderRepository(db);

  const order = await repo.createOne({
    visitId,
    patientId: body['patientId'] as string,
    labName: body['labName'] as string,
    description: body['description'] as string,
    expectedDeliveryDate: body['expectedDeliveryDate'] ? new Date(body['expectedDeliveryDate'] as string) : undefined,
  });

  return ctx.json(order, 201);
}
