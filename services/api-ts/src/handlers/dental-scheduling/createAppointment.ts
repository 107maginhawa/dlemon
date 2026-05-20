/**
 * createAppointment handler
 *
 * POST /dental/appointments
 * Creates a new dental appointment in scheduled status.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { parseWorkingHours, isWithinWorkingHours } from './workingHours';
import { assertBranchAccess } from './utils/assert-branch-access';
import { eq } from 'drizzle-orm';
import type { User } from '@/types/auth';
import type { CreateAppointmentBody } from '@/generated/openapi/validators';
import type { NotificationService } from '@/core/notifs';

export async function createAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json') as CreateAppointmentBody;

  const db = ctx.get('database') as DatabaseInstance;
  const notifs = ctx.get('notifs') as NotificationService | undefined;

  // Authorization: user must have active membership in the target branch
  await assertBranchAccess(db, user.id, body.branchId);
  const repo = new DentalAppointmentRepository(db);

  // scheduledAt is already a Date after zod transform
  const scheduledAt = body.scheduledAt instanceof Date ? body.scheduledAt : new Date(String(body.scheduledAt));
  const durationMinutes = body.durationMinutes;
  const dentistMemberId = body.dentistMemberId;
  const branchId = body.branchId;

  // FR3.10: Validate against configured working hours (blocking)
  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (branch?.workingHours) {
    const hours = parseWorkingHours(branch.workingHours);
    if (hours && !isWithinWorkingHours(scheduledAt, durationMinutes, hours, branch.timezone ?? 'UTC')) {
      throw new BusinessLogicError('Appointment is outside configured working hours', 'OUTSIDE_WORKING_HOURS');
    }
  }

  // FR3.7: Check for overlapping appointments (non-blocking — returns warning in response)
  const overlapping = await repo.findOverlapping(dentistMemberId, branchId, scheduledAt, durationMinutes);
  const warnings: string[] = [];
  if (overlapping.length > 0) {
    warnings.push('DOUBLE_BOOKING');
  }

  const appt = await repo.createOne({
    patientId: body.patientId,
    dentistMemberId,
    branchId,
    scheduledAt,
    durationMinutes,
    serviceType: body.serviceType,
    operatoryId: body.operatoryId,
    walkIn: body.walkIn ?? false,
    notes: body.notes,
    createdBy: user.id,
    updatedBy: user.id,
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

  return ctx.json({ ...appt, warnings }, 201);
}
