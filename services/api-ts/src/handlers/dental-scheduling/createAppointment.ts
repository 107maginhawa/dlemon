/**
 * createAppointment handler
 *
 * POST /dental/appointments
 * Creates a new dental appointment in scheduled status.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import type { User } from '@/types/auth';

export async function createAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['dentistMemberId'] || typeof body['dentistMemberId'] !== 'string') throw new ValidationError('dentistMemberId is required');
  if (!body['branchId'] || typeof body['branchId'] !== 'string') throw new ValidationError('branchId is required');
  if (!body['scheduledAt'] || typeof body['scheduledAt'] !== 'string') throw new ValidationError('scheduledAt is required');
  if (!body['durationMinutes'] || typeof body['durationMinutes'] !== 'number') throw new ValidationError('durationMinutes is required');
  if (!body['procedureType'] || typeof body['procedureType'] !== 'string') throw new ValidationError('procedureType is required');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalAppointmentRepository(db);

  const appt = await repo.createOne({
    patientId: body['patientId'] as string,
    dentistMemberId: body['dentistMemberId'] as string,
    branchId: body['branchId'] as string,
    scheduledAt: new Date(body['scheduledAt'] as string),
    durationMinutes: body['durationMinutes'] as number,
    procedureType: body['procedureType'] as string,
    operatoryId: typeof body['operatoryId'] === 'string' ? body['operatoryId'] : undefined,
    walkIn: body['walkIn'] === true,
    notes: typeof body['notes'] === 'string' ? body['notes'] : undefined,
  });

  return ctx.json(appt, 201);
}
