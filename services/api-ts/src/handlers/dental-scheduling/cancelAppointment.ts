/**
 * cancelAppointment handler
 *
 * DELETE /dental/appointments/:appointmentId
 * Cancels an appointment (sets status to cancelled).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
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

  const result = await repo.cancel(appointmentId, undefined, user.id);
  if (!result) throw new NotFoundError('Appointment');

  return ctx.body(null, 204);
}
