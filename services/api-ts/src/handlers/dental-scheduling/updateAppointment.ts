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
import { withTenantTx } from '@/core/tenant-tx';
import { logAuditEvent } from '@/core/audit-logger';
import { emitAppointmentCancelled } from './domain-events';
import type { JobScheduler } from '@/core/jobs';
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

  // RLS P1b activation: every dental_appointment write below runs through this
  // helper so the app_rls policy enforces the branch scope as a second wall.
  // Entity fetch + authz + FSM/working-hours guards + audit/notifs/event stay on
  // db (preserving the exact 403/404/409/422 behavior).
  const runScoped = <T>(fn: (tx: DatabaseInstance) => Promise<T>): Promise<T> =>
    withTenantTx(db, { branchIds: [existing.branchId] }, fn);

  // Handle status transitions via dedicated methods — validated against APPOINTMENT_TRANSITIONS
  if (body.status !== undefined) {
    const allowed = APPOINTMENT_TRANSITIONS[existing.status];
    if (!allowed.includes(body.status)) {
      throw new ValidationError(`Cannot transition appointment from '${existing.status}' to '${body.status}'`);
    }
  }

  if (body.status === 'confirmed') {
    const result = await runScoped((tx) => new DentalAppointmentRepository(tx).confirm(appointmentId, user.id, 'staff'));
    if (!result) throw new NotFoundError('Appointment');
    await expireReminders();
    return ctx.json(toWire(result));
  }

  if (body.status === 'no_show') {
    const result = await runScoped((tx) => new DentalAppointmentRepository(tx).markNoShow(appointmentId, user.id));
    if (!result) throw new NotFoundError('Appointment');
    await expireReminders();
    return ctx.json(toWire(result));
  }

  if (body.status === 'completed') {
    // Only noShow → completed is supported via PATCH (revert); checkedIn → completed goes via visit checkout
    if (existing.status !== 'no_show') {
      throw new ValidationError(`Cannot transition appointment from '${existing.status}' to 'completed' via PATCH — complete the visit via checkout`);
    }
    const result = await runScoped((tx) => new DentalAppointmentRepository(tx).revertNoShow(appointmentId, user.id));
    if (!result) throw new NotFoundError('Appointment');
    return ctx.json(toWire(result));
  }

  if (body.status === 'cancelled') {
    // EM-SCH-001 / MODULE_SPEC §6: cancellation is restricted to dentist_owner + staff_full,
    // exactly as the dedicated DELETE cancel handler enforces. The broad write-role gate above
    // admits staff_scheduling/dentist_associate so they can reschedule, but they must NOT be able
    // to cancel by routing through PATCH {status:'cancelled'} — close that role bypass here.
    await assertBranchRole(db, user.id, existing.branchId, ['dentist_owner', 'staff_full']);

    // FIX-002 (GAP-6): one canonical cancel policy. The dedicated DELETE cancel
    // path requires a reason (5–500); PATCH {status:cancelled} must enforce the
    // SAME rule so a reason-less cancel is impossible on either path.
    const cancellationReason = typeof body.cancellationReason === 'string' ? body.cancellationReason.trim() : '';
    if (cancellationReason.length < 5 || cancellationReason.length > 500) {
      throw new BusinessLogicError('reason is required (min 5, max 500 characters)', 'REASON_REQUIRED');
    }
    const result = await runScoped((tx) => new DentalAppointmentRepository(tx).cancel(appointmentId, cancellationReason, user.id));
    if (!result) throw new NotFoundError('Appointment');
    await expireReminders();

    // Parity with the canonical DELETE cancel path: a cancellation via PATCH must
    // leave the SAME audit trail (AL-008) and emit the SAME domain event (DE-011).
    const logger = ctx.get('logger');
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: result.branchId,
      branchId: result.branchId,
      action: 'appointment.cancel',
      resourceType: 'dental_appointment',
      resourceId: result.id,
      reason: cancellationReason,
      metadata: { patientId: result.patientId, dentistMemberId: result.dentistMemberId },
    });
    const scheduler = ctx.get('jobs') as JobScheduler | undefined;
    if (scheduler) {
      void emitAppointmentCancelled(scheduler, {
        appointmentId: result.id,
        patientId: result.patientId,
        branchId: result.branchId,
      }).catch(() => {/* non-blocking */});
    }

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

  // Re-validate working hours (config read stays on db) if the time window moves.
  if (newScheduledAt !== undefined) {
    const durationMinutes = durationFromRange(effectiveStart, effectiveEnd);
    const branch = await getBranchSchedulingConfig(db, existing.branchId);
    if (branch?.workingHours) {
      const hours = parseWorkingHours(branch.workingHours);
      if (hours && !isWithinWorkingHours(newScheduledAt, durationMinutes, hours, branch.timezone ?? 'UTC')) {
        throw new BusinessLogicError('Appointment is outside configured working hours', 'OUTSIDE_WORKING_HOURS');
      }
    }
  }

  // RLS P1b activation: route the overlap-check read + the field update through a
  // single tenant tx (the overlap check is the reschedule hard-block; both touch
  // the armed dental_appointment).
  const updated = await runScoped(async (tx) => {
    const txRepo = new DentalAppointmentRepository(tx);
    if (newScheduledAt !== undefined) {
      const durationMinutes = durationFromRange(effectiveStart, effectiveEnd);
      const overlaps = await txRepo.findOverlapping(
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
    return txRepo.updateOneById(appointmentId, { ...patch, updatedBy: user.id });
  });

  // P1-24: on reschedule (the appointment time moved), expire the now-stale queued
  // reminders. The reminderArmer re-arms for the new time on its next run.
  if (newScheduledAt !== undefined) {
    await expireReminders();
  }

  return ctx.json(toWire(updated));
}
