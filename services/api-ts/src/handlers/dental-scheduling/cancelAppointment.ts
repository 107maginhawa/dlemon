/**
 * cancelAppointment handler
 *
 * DELETE /dental/appointments/:appointmentId
 * Cancels an appointment (sets status to cancelled).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { APPOINTMENT_TRANSITIONS } from './repos/dental-appointment.schema';
import { assertBranchAccess } from './utils/assert-branch-access';
import type { User } from '@/types/auth';
import type { CancelAppointmentParams } from '@/generated/openapi/validators';

export async function cancelAppointment(
  ctx: ValidatedContext<never, never, CancelAppointmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { appointmentId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalAppointmentRepository(db);

  const existing = await repo.findOneById(appointmentId);
  if (!existing) throw new NotFoundError('Appointment');

  await assertBranchAccess(db, user.id, existing.branchId);

  if (!APPOINTMENT_TRANSITIONS[existing.status].includes('cancelled')) {
    throw new ValidationError(`Cannot cancel appointment with status '${existing.status}'`);
  }

  // Optional body: { cancellationReason?: string }
  let cancellationReason: string | undefined;
  const contentType = ctx.req.header('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = await ctx.req.json();
      cancellationReason = body?.cancellationReason ?? undefined;
    } catch {
      // No body or invalid JSON — ignore
    }
  }

  const result = await repo.cancel(appointmentId, cancellationReason, user.id);
  if (!result) throw new NotFoundError('Appointment');

  return ctx.body(null, 204);
}
