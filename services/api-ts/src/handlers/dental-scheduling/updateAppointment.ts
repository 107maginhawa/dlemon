/**
 * updateAppointment handler
 *
 * PATCH /dental/appointments/:appointmentId
 * Updates appointment fields and/or status.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { parseWorkingHours, isWithinWorkingHours } from './workingHours';
import { assertBranchAccess } from './utils/assert-branch-access';
import { eq } from 'drizzle-orm';
import type { User } from '@/types/auth';
import type { UpdateAppointmentBody, UpdateAppointmentParams } from '@/generated/openapi/validators';

export async function updateAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { appointmentId } = ctx.req.valid('param') as UpdateAppointmentParams;
  const body = ctx.req.valid('json') as UpdateAppointmentBody;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalAppointmentRepository(db);

  const existing = await repo.findOneById(appointmentId);
  if (!existing) throw new NotFoundError('Appointment');

  await assertBranchAccess(db, user.id, existing.branchId);

  // Handle status transitions via dedicated methods
  if (body.status === 'noShow') {
    const result = await repo.markNoShow(appointmentId, user.id);
    if (!result) throw new NotFoundError('Appointment');
    return ctx.json(result);
  }

  if (body.status === 'completed' && existing.status === 'noShow') {
    const result = await repo.revertNoShow(appointmentId, user.id);
    if (!result) throw new NotFoundError('Appointment');
    return ctx.json(result);
  }

  if (body.status === 'cancelled') {
    const result = await repo.cancel(appointmentId, body.cancellationReason, user.id);
    if (!result) throw new NotFoundError('Appointment');
    return ctx.json(result);
  }

  // Generic field update (status transitions handled above — not allowed here)
  const patch: Record<string, unknown> = {};
  // scheduledAt is already a Date after zod transform
  const newScheduledAt = body.scheduledAt instanceof Date
    ? body.scheduledAt
    : body.scheduledAt !== undefined ? new Date(body.scheduledAt as any) : undefined;
  if (newScheduledAt !== undefined) patch['scheduledAt'] = newScheduledAt;
  if (body.durationMinutes !== undefined) patch['durationMinutes'] = body.durationMinutes;
  if (body.procedureType !== undefined) patch['procedureType'] = body.procedureType;
  if (body.operatoryId !== undefined) patch['operatoryId'] = body.operatoryId;
  if (body.notes !== undefined) patch['notes'] = body.notes;

  // Re-validate working hours if scheduledAt is being changed
  if (newScheduledAt !== undefined) {
    const durationMinutes = body.durationMinutes ?? existing.durationMinutes;
    const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, existing.branchId));
    if (branch?.workingHours) {
      const hours = parseWorkingHours(branch.workingHours);
      if (hours && !isWithinWorkingHours(newScheduledAt, durationMinutes, hours, branch.timezone ?? 'UTC')) {
        throw new BusinessLogicError('Appointment is outside configured working hours', 'OUTSIDE_WORKING_HOURS');
      }
    }
  }

  const updated = await repo.updateOneById(appointmentId, { ...patch, updatedBy: user.id } as any);
  return ctx.json(updated);
}
