/**
 * updateAppointment handler
 *
 * PATCH /dental/appointments/:appointmentId
 * Updates appointment fields and/or status.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import type { User } from '@/types/auth';

export async function updateAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const appointmentId = ctx.req.param('appointmentId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalAppointmentRepository(db);

  const existing = await repo.findOneById(appointmentId);
  if (!existing) throw new NotFoundError('Appointment');

  // Handle status transitions via dedicated methods
  if (body['status'] === 'noShow') {
    const result = await repo.markNoShow(appointmentId);
    if (!result) throw new NotFoundError('Appointment');
    return ctx.json(result);
  }

  if (body['status'] === 'completed' && existing.status === 'noShow') {
    const result = await repo.revertNoShow(appointmentId);
    if (!result) throw new NotFoundError('Appointment');
    return ctx.json(result);
  }

  if (body['status'] === 'cancelled') {
    const result = await repo.cancel(
      appointmentId,
      typeof body['cancellationReason'] === 'string' ? body['cancellationReason'] : undefined
    );
    if (!result) throw new NotFoundError('Appointment');
    return ctx.json(result);
  }

  // Generic field update
  const patch: Record<string, unknown> = {};
  if (body['scheduledAt'] !== undefined) patch['scheduledAt'] = new Date(body['scheduledAt'] as string);
  if (body['durationMinutes'] !== undefined) patch['durationMinutes'] = body['durationMinutes'];
  if (body['procedureType'] !== undefined) patch['procedureType'] = body['procedureType'];
  if (body['operatoryId'] !== undefined) patch['operatoryId'] = body['operatoryId'];
  if (body['notes'] !== undefined) patch['notes'] = body['notes'];
  if (body['status'] !== undefined) patch['status'] = body['status'];

  const updated = await repo.updateOneById(appointmentId, patch as any);
  return ctx.json(updated);
}
