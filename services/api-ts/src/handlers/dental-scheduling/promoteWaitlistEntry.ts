/**
 * promoteWaitlistEntry — POST /dental/waitlist/:entryId/promote
 *
 * Fills a short-notice slot from the waitlist: books an appointment for the
 * given window/provider and marks the entry `scheduled`, linking the booked
 * appointment. Only an `active` entry can be promoted.
 *
 * The appointment is created in `scheduled` status (the front desk confirms /
 * checks in via the normal lifecycle). Overlap is surfaced as a soft warning
 * (DOUBLE_BOOKING) — consistent with createAppointment — not a hard block,
 * since ASAP fills routinely backfill a slot another booking just vacated.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError, ValidationError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { DentalWaitlistEntryRepository } from './repos/waitlist-entry.repo';
import { logAuditEvent } from '@/core/audit-logger';
import { durationFromRange, isVisitType, toWire } from './appointment-wire';
import type { User } from '@/types/auth';
import type { PromoteWaitlistEntryBody, PromoteWaitlistEntryParams } from '@/generated/openapi/validators';

export async function promoteWaitlistEntry(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { entryId } = ctx.req.valid('param') as PromoteWaitlistEntryParams;
  const body = ctx.req.valid('json') as PromoteWaitlistEntryBody;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger') as any | undefined;

  const waitlistRepo = new DentalWaitlistEntryRepository(db, logger);
  const entry = await waitlistRepo.findOneById(entryId);
  if (!entry) throw new NotFoundError('Waitlist entry');

  // Authorization: scheduling-capable role in the entry's branch.
  await assertBranchRole(db, user.id, entry.branchId, [
    'dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling',
  ]);

  if (entry.status !== 'active') {
    throw new BusinessLogicError(
      `Cannot promote a waitlist entry with status '${entry.status}'. Only active entries can be filled.`,
      'WAITLIST_ENTRY_NOT_ACTIVE',
    );
  }

  const startAt = body.startAt instanceof Date ? body.startAt : new Date(String(body.startAt));
  const endAt = body.endAt instanceof Date ? body.endAt : new Date(String(body.endAt));
  if (!(endAt.getTime() > startAt.getTime())) {
    throw new ValidationError('endAt must be after startAt');
  }

  // Provider: explicit override > entry's preferred provider. One is required to book.
  const dentistMemberId = body.providerId ?? entry.preferredProviderId;
  if (!dentistMemberId) {
    throw new ValidationError('A providerId is required to promote a waitlist entry with no preferred provider');
  }

  // Visit type: explicit override > entry's stored visit type. Must be a valid enum.
  const visitType = body.visitType ?? entry.visitType ?? undefined;
  if (!isVisitType(visitType)) {
    throw new ValidationError('visitType must be one of: checkup, treatment, emergency, recall');
  }

  const durationMinutes = durationFromRange(startAt, endAt);
  const apptRepo = new DentalAppointmentRepository(db);

  // Soft double-booking warning (parity with createAppointment FR3.7).
  const overlapping = await apptRepo.findOverlapping(dentistMemberId, entry.branchId, startAt, durationMinutes);
  const warnings: string[] = [];
  if (overlapping.length > 0) warnings.push('DOUBLE_BOOKING');

  // Atomically book the appointment and promote the entry.
  const result = await db.transaction(async (tx) => {
    const txApptRepo = new DentalAppointmentRepository(tx);
    const txWaitlistRepo = new DentalWaitlistEntryRepository(tx, logger);

    const appt = await txApptRepo.createOne({
      patientId: entry.patientId,
      dentistMemberId,
      branchId: entry.branchId,
      scheduledAt: startAt,
      durationMinutes,
      serviceType: visitType,
      operatoryId: body.operatoryId ?? null,
      walkIn: false,
      notes: entry.notes ?? undefined,
      createdBy: user.id,
      updatedBy: user.id,
    });

    const promoted = await txWaitlistRepo.promote(entryId, appt.id, user.id);
    if (!promoted) {
      // Lost a race — another promotion already consumed this active entry.
      throw new BusinessLogicError('Waitlist entry is no longer active', 'WAITLIST_ENTRY_NOT_ACTIVE');
    }
    return { appt, entry: promoted };
  });

  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: entry.branchId,
    branchId: entry.branchId,
    action: 'waitlist.promote',
    resourceType: 'dental_waitlist_entry',
    resourceId: entryId,
    metadata: {
      patientId: entry.patientId,
      appointmentId: result.appt.id,
      providerId: dentistMemberId,
      startAt: startAt.toISOString(),
    },
  });

  logger?.info?.({ action: 'promoteWaitlistEntry', entryId, appointmentId: result.appt.id }, 'Waitlist entry promoted');

  return ctx.json({
    entry: result.entry,
    appointment: toWire(result.appt, { warnings }),
  }, 201);
}
