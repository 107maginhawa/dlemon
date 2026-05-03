/**
 * listAppointments handler
 *
 * GET /dental/appointments
 * Lists dental appointments with optional filters.
 * Joins patient+person for patientName.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { AppointmentFilters } from './repos/dental-appointment.repo';
import type { User } from '@/types/auth';
import { eq, and, gte, lt } from 'drizzle-orm';
import { dentalAppointments } from './repos/dental-appointment.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { persons } from '@/handlers/person/repos/person.schema';

export async function listAppointments(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const url = new URL(ctx.req.url);
  const filters: AppointmentFilters = {};

  const branchId = url.searchParams.get('branchId');
  if (branchId) filters.branchId = branchId;

  const dentistMemberId = url.searchParams.get('dentistMemberId');
  if (dentistMemberId) filters.dentistMemberId = dentistMemberId;

  const date = url.searchParams.get('date');
  if (date) filters.date = date;

  const status = url.searchParams.get('status');
  if (status) filters.status = status as AppointmentFilters['status'];

  const db = ctx.get('database') as DatabaseInstance;

  // Build conditions
  const conditions = [];
  if (filters.branchId) conditions.push(eq(dentalAppointments.branchId, filters.branchId));
  if (filters.dentistMemberId) conditions.push(eq(dentalAppointments.dentistMemberId, filters.dentistMemberId));
  if (filters.status) conditions.push(eq(dentalAppointments.status, filters.status));
  if (filters.date) {
    const dayStart = new Date(filters.date + 'T00:00:00.000Z');
    const dayEnd = new Date(filters.date + 'T23:59:59.999Z');
    conditions.push(gte(dentalAppointments.scheduledAt, dayStart));
    conditions.push(lt(dentalAppointments.scheduledAt, new Date(dayEnd.getTime() + 1)));
  }

  const rows = await db
    .select({
      id: dentalAppointments.id,
      patientId: dentalAppointments.patientId,
      dentistMemberId: dentalAppointments.dentistMemberId,
      branchId: dentalAppointments.branchId,
      scheduledAt: dentalAppointments.scheduledAt,
      durationMinutes: dentalAppointments.durationMinutes,
      procedureType: dentalAppointments.procedureType,
      operatoryId: dentalAppointments.operatoryId,
      walkIn: dentalAppointments.walkIn,
      status: dentalAppointments.status,
      checkInTime: dentalAppointments.checkInTime,
      visitId: dentalAppointments.visitId,
      notes: dentalAppointments.notes,
      cancelledAt: dentalAppointments.cancelledAt,
      cancellationReason: dentalAppointments.cancellationReason,
      noShowAt: dentalAppointments.noShowAt,
      createdAt: dentalAppointments.createdAt,
      updatedAt: dentalAppointments.updatedAt,
      // Patient name from person table
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(dentalAppointments)
    .leftJoin(patients, eq(patients.id, dentalAppointments.patientId))
    .leftJoin(persons, eq(persons.id, patients.person))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const appointments = rows.map((row) => {
    const { firstName, lastName, ...appt } = row;
    const patientName = firstName
      ? [firstName, lastName].filter(Boolean).join(' ')
      : undefined;
    return { ...appt, patientName };
  });

  return ctx.json(appointments);
}
