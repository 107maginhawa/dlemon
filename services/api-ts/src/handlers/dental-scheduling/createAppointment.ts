/**
 * createAppointment handler
 *
 * POST /dental/appointments
 * Creates a new dental appointment in scheduled status.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError, ValidationError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { getBranchSchedulingConfig } from '@/handlers/dental-org/repos/org-scheduling.facade';
import { parseWorkingHours, isWithinWorkingHours } from './workingHours';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { CreateAppointmentBody } from '@/generated/openapi/validators';
import type { NotificationService } from '@/core/notifs';
import type { JobScheduler } from '@/core/jobs';
import { emitAppointmentBooked } from './domain-events';
import { durationFromRange, isVisitType, toWire } from './appointment-wire';

export async function createAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json') as CreateAppointmentBody;

  const db = ctx.get('database') as DatabaseInstance;
  const notifs = ctx.get('notifs') as NotificationService | undefined;
  const scheduler = ctx.get('jobs') as JobScheduler | undefined;

  // Authorization: user must have a scheduling-capable role in the target branch (EM-SCH-001)
  await assertBranchRole(db, user.id, body.branchId, [
    'dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling',
  ]);
  const repo = new DentalAppointmentRepository(db);

  // Canonical wire shape: providerId / startAt / endAt / visitType (V-SCH-006/007).
  const startAt = body.startAt instanceof Date ? body.startAt : new Date(String(body.startAt));
  const endAt = body.endAt instanceof Date ? body.endAt : new Date(String(body.endAt));
  const dentistMemberId = body.providerId;
  const branchId = body.branchId;

  // V-SCH-008: end_at must be strictly after start_at.
  if (!(endAt.getTime() > startAt.getTime())) {
    throw new ValidationError('endAt must be after startAt');
  }

  // V-SCH-007: visit_type is a constrained enum.
  if (!isVisitType(body.visitType)) {
    throw new ValidationError('visitType must be one of: checkup, treatment, emergency, recall');
  }

  const scheduledAt = startAt;
  const durationMinutes = durationFromRange(startAt, endAt);

  // FR3.10: Validate against configured working hours (blocking); walk-ins bypass this check (BR-SCH-002)
  if (!body.walkIn) {
    const branch = await getBranchSchedulingConfig(db, branchId);
    if (branch?.workingHours) {
      const hours = parseWorkingHours(branch.workingHours);
      if (hours && !isWithinWorkingHours(scheduledAt, durationMinutes, hours, branch.timezone ?? 'UTC')) {
        throw new BusinessLogicError('Appointment is outside configured working hours', 'OUTSIDE_WORKING_HOURS');
      }
    }
  }

  const logger = ctx.get('logger') as any | undefined;

  // FR3.7: Check for overlapping appointments (non-blocking — returns warning in response)
  const overlapping = await repo.findOverlapping(dentistMemberId, branchId, scheduledAt, durationMinutes);
  const warnings: string[] = [];
  if (overlapping.length > 0) {
    warnings.push('DOUBLE_BOOKING');
    // V-SCH-012 / §17: emit the dental-scheduling.double-booking WARN observable.
    // No PII in log fields (only opaque ids + the warning marker).
    logger?.warn?.({
      event: 'dental-scheduling.double-booking',
      branchId,
      providerId: dentistMemberId,
      startAt: scheduledAt.toISOString(),
      durationMinutes,
      overlapCount: overlapping.length,
    }, 'Double-booking detected at appointment create (soft-warn)');
  }

  const appt = await repo.createOne({
    patientId: body.patientId,
    dentistMemberId,
    branchId,
    scheduledAt,
    durationMinutes,
    serviceType: body.visitType,
    operatoryId: body.operatoryId,
    walkIn: body.walkIn ?? false,
    notes: body.notes,
    createdBy: user.id,
    updatedBy: user.id,
  });

  // AL-009: appointment booking audit trail — persisted to dental_audit + dental_audit_log
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchId,
    branchId,
    action: 'appointment.book',
    resourceType: 'dental_appointment',
    resourceId: appt.id,
    metadata: {
      patientId: appt.patientId,
      providerId: appt.dentistMemberId,
      startAt: scheduledAt.toISOString(),
      endAt: endAt.toISOString(),
      visitType: appt.serviceType,
      walkIn: appt.walkIn ?? false,
    },
  });

  // AC-NOTIF-01: fire booking.created notification to patient (best-effort, non-blocking)
  notifs?.createNotification({
    recipient: body.patientId,
    type: 'booking.created',
    channel: 'in-app',
    title: 'Appointment scheduled',
    message: `Your appointment is confirmed for ${scheduledAt.toISOString()}`,
    relatedEntityType: 'appointment',
    relatedEntity: appt.id,
  }).catch(() => {/* non-blocking */});

  // DE-010: emit AppointmentBooked domain event (best-effort, non-blocking)
  scheduler && emitAppointmentBooked(scheduler, {
    appointmentId: appt.id,
    patientId: appt.patientId,
    branchId: appt.branchId,
  }).catch(() => {/* non-blocking */});

  return ctx.json(toWire(appt, { warnings }), 201);
}
