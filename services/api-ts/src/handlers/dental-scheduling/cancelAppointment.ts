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
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { CancelAppointmentParams } from '@/generated/openapi/validators';
import type { JobScheduler } from '@/core/jobs';
import { emitAppointmentCancelled } from './domain-events';

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

  // Authorization: user must have a scheduling-capable role in the target branch (EM-SCH-001)
  await assertBranchRole(db, user.id, existing.branchId, [
    'dentist_owner', 'staff_full',
  ]);

  if (!APPOINTMENT_TRANSITIONS[existing.status].includes('cancelled')) {
    throw new ValidationError(`Cannot cancel appointment with status '${existing.status}'`);
  }

  // BR-SCH-003: cancellation_reason is mandatory; omitting returns 422
  let cancellationReason: string;
  try {
    const body = await ctx.req.json();
    const reason = body?.cancellationReason;
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      throw new ValidationError('cancellationReason is required and must be a non-empty string');
    }
    cancellationReason = reason;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('cancellationReason is required and must be a non-empty string');
  }

  const result = await repo.cancel(appointmentId, cancellationReason, user.id);
  if (!result) throw new NotFoundError('Appointment');

  // AL-008: appointment cancellation audit trail — persisted to dental_audit + dental_audit_log
  const logger = ctx.get('logger') as any | undefined;
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: result.branchId,
    branchId: result.branchId,
    action: 'appointment.cancel',
    resourceType: 'dental_appointment',
    resourceId: result.id,
    reason: cancellationReason,
    metadata: {
      patientId: result.patientId,
      dentistMemberId: result.dentistMemberId,
    },
  });

  // DE-011: emit AppointmentCancelled domain event (best-effort, non-blocking)
  const scheduler = ctx.get('jobs') as JobScheduler | undefined;
  scheduler && emitAppointmentCancelled(scheduler, {
    appointmentId: result.id,
    patientId: result.patientId,
    branchId: result.branchId,
  }).catch(() => {/* non-blocking */});

  return ctx.body(null, 204);
}
