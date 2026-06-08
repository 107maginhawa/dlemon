/**
 * updateAppointment handler
 *
 * PATCH /dental/appointments/:appointmentId
 * Updates appointment fields and/or status.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { NotificationService } from '@/core/notifs';
import { UnauthorizedError, NotFoundError, BusinessLogicError, ConflictError, ValidationError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { APPOINTMENT_TRANSITIONS } from './repos/dental-appointment.schema';
import { REMINDER_NOTIFICATION_TYPES } from './utils/reminder-types';
import { getBranchSchedulingConfig } from '@/handlers/dental-org/repos/org-scheduling.facade';
import { parseWorkingHours, isWithinWorkingHours } from './workingHours';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { UpdateAppointmentBody, UpdateAppointmentParams } from '@/generated/openapi/validators';
import type { DentalAppointment } from './repos/dental-appointment.schema';
import { durationFromRange, isVisitType, toWire } from './appointment-wire';

export async function updateAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { appointmentId } = ctx.req.valid('param') as UpdateAppointmentParams;
  const body = ctx.req.valid('json') as UpdateAppointmentBody;

  const db = ctx.get('database') as DatabaseInstance;
  const notifs = ctx.get('notifs') as NotificationService | undefined;
  const repo = new DentalAppointmentRepository(db);

  // P1-24: expire any queued reminders for this appointment (best-effort).
  const expireReminders = async () => {
    if (notifs) {
      await notifs.expireQueuedByEntity(appointmentId, REMINDER_NOTIFICATION_TYPES).catch(() => {/* best-effort */});
    }
  };

  const existing = await repo.findOneById(appointmentId);
  if (!existing) throw new NotFoundError('Appointment');

  // Authorization: user must have a scheduling-capable role in the target branch (EM-SCH-001)
  await assertBranchRole(db, user.id, existing.branchId, [
    'dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling',
  ]);

  // Handle status transitions via dedicated methods — validated against APPOINTMENT_TRANSITIONS
  if (body.status !== undefined) {
    const allowed = APPOINTMENT_TRANSITIONS[existing.status];
    if (!allowed.includes(body.status)) {
      throw new ValidationError(`Cannot transition appointment from '${existing.status}' to '${body.status}'`);
    }
  }

  if (body.status === 'confirmed') {
    const result = await repo.confirm(appointmentId, user.id, 'staff');
    if (!result) throw new NotFoundError('Appointment');
    await expireReminders();
    return ctx.json(toWire(result));
  }

  if (body.status === 'no_show') {
    const result = await repo.markNoShow(appointmentId, user.id);
    if (!result) throw new NotFoundError('Appointment');
    await expireReminders();
    return ctx.json(toWire(result));
  }

  if (body.status === 'completed') {
    // Only noShow → completed is supported via PATCH (revert); checkedIn → completed goes via visit checkout
    if (existing.status !== 'no_show') {
      throw new ValidationError(`Cannot transition appointment from '${existing.status}' to 'completed' via PATCH — complete the visit via checkout`);
    }
    const result = await repo.revertNoShow(appointmentId, user.id);
    if (!result) throw new NotFoundError('Appointment');
    return ctx.json(toWire(result));
  }

  if (body.status === 'cancelled') {
    // EM-SCH-001 / MODULE_SPEC §6: cancellation is restricted to dentist_owner + staff_full,
    // exactly as the dedicated DELETE cancel handler enforces. The broad write-role gate above
    // admits staff_scheduling/dentist_associate so they can reschedule, but they must NOT be able
    // to cancel by routing through PATCH {status:'cancelled'} — close that role bypass here.
    await assertBranchRole(db, user.id, existing.branchId, ['dentist_owner', 'staff_full']);
    const result = await repo.cancel(appointmentId, body.cancellationReason, user.id);
    if (!result) throw new NotFoundError('Appointment');
    await expireReminders();
    return ctx.json(toWire(result));
  }

  // Generic field update — canonical wire shape: startAt/endAt/providerId/visitType.
  const patch: Partial<DentalAppointment> = {};

  const newStartAt = body.startAt instanceof Date
    ? body.startAt
    : body.startAt !== undefined ? new Date(String(body.startAt)) : undefined;
  const newEndAt = body.endAt instanceof Date
    ? body.endAt
    : body.endAt !== undefined ? new Date(String(body.endAt)) : undefined;

  // V-SCH-007: visit_type, if provided, must be a valid enum value.
  if (body.visitType !== undefined && !isVisitType(body.visitType)) {
    throw new ValidationError('visitType must be one of: checkup, treatment, emergency, recall, hygiene');
  }

  // Effective start/end after the patch (fall back to existing values).
  const effectiveStart = newStartAt ?? existing.scheduledAt;
  const effectiveEnd = newEndAt ?? new Date(existing.scheduledAt.getTime() + existing.durationMinutes * 60_000);

  // V-SCH-008: end_at must be strictly after start_at when either is changed.
  if ((newStartAt !== undefined || newEndAt !== undefined) && !(effectiveEnd.getTime() > effectiveStart.getTime())) {
    throw new ValidationError('endAt must be after startAt');
  }

  const newScheduledAt = newStartAt;
  if (newScheduledAt !== undefined) patch['scheduledAt'] = newScheduledAt;
  if (newStartAt !== undefined || newEndAt !== undefined) {
    patch['durationMinutes'] = durationFromRange(effectiveStart, effectiveEnd);
  }
  if (body.providerId !== undefined) patch['dentistMemberId'] = body.providerId;
  if (body.visitType !== undefined) patch['serviceType'] = body.visitType;
  if (body.operatoryId !== undefined) patch['operatoryId'] = body.operatoryId;
  if (body.notes !== undefined) patch['notes'] = body.notes;

  // Re-validate working hours and check overlap if the time window is being changed
  if (newScheduledAt !== undefined) {
    const durationMinutes = durationFromRange(effectiveStart, effectiveEnd);
    const branch = await getBranchSchedulingConfig(db, existing.branchId);
    if (branch?.workingHours) {
      const hours = parseWorkingHours(branch.workingHours);
      if (hours && !isWithinWorkingHours(newScheduledAt, durationMinutes, hours, branch.timezone ?? 'UTC')) {
        throw new BusinessLogicError('Appointment is outside configured working hours', 'OUTSIDE_WORKING_HOURS');
      }
    }
    const overlaps = await repo.findOverlapping(
      body.providerId ?? existing.dentistMemberId,
      existing.branchId,
      newScheduledAt,
      durationMinutes,
      appointmentId, // exclude self
    );
    if (overlaps.length > 0) {
      // V-SCH-001 / AC-SCH-002: reschedule hard-block uses the specific taxonomy code,
      // not the generic CONFLICT. ERROR_TAXONOMY: RESCHEDULE_CONFLICT(409).
      throw new ConflictError(
        'Reschedule conflict: provider already has an appointment in the new time window',
        'RESCHEDULE_CONFLICT',
      );
    }
  }

  const updated = await repo.updateOneById(appointmentId, { ...patch, updatedBy: user.id });

  // P1-24: on reschedule (the appointment time moved), expire the now-stale queued
  // reminders. The reminderArmer re-arms for the new time on its next run.
  if (newScheduledAt !== undefined) {
    await expireReminders();
  }

  return ctx.json(toWire(updated));
}
