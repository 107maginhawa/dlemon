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
import { eq, and, gte, lt, inArray } from 'drizzle-orm';
import { dentalAppointments } from './repos/dental-appointment.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { assertBranchAccess } from './utils/assert-branch-access';
import type { ListAppointmentsQuery } from '@/generated/openapi/validators';

export async function listAppointments(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const query = ctx.req.valid('query') as ListAppointmentsQuery;
  const filters: AppointmentFilters = {};

  if (query.branchId) filters.branchId = query.branchId;
  if (query.dentistMemberId) filters.dentistMemberId = query.dentistMemberId;
  if (query.date) filters.date = query.date;
  if (query.status) filters.status = query.status;

  // Additional filters not in TypeSpec (read from raw query)
  const rawQuery = ctx.req.query();
  const patientId = rawQuery['patientId'];
  if (patientId) filters.patientId = patientId;

  // Pagination (not in TypeSpec — read from raw query)
  const limit = Math.min(parseInt(rawQuery['limit'] ?? '50', 10) || 50, 200);
  const offset = Math.max(parseInt(rawQuery['offset'] ?? '0', 10) || 0, 0);

  const db = ctx.get('database') as DatabaseInstance;

  // Build conditions
  const conditions = [];

  // Authorization: scope results to branches the user has access to
  if (filters.branchId) {
    await assertBranchAccess(db, user.id, filters.branchId);
    conditions.push(eq(dentalAppointments.branchId, filters.branchId));
  } else {
    // No branchId filter — restrict to branches where user has active membership
    const memberships = await db
      .select({ branchId: dentalMemberships.branchId })
      .from(dentalMemberships)
      .where(and(eq(dentalMemberships.personId, user.id), eq(dentalMemberships.status, 'active')));
    const accessibleBranchIds = memberships.map(m => m.branchId);
    if (accessibleBranchIds.length === 0) return ctx.json([]);
    conditions.push(inArray(dentalAppointments.branchId, accessibleBranchIds));
  }

  if (filters.dentistMemberId) conditions.push(eq(dentalAppointments.dentistMemberId, filters.dentistMemberId));
  if (filters.status) conditions.push(eq(dentalAppointments.status, filters.status));
  if (filters.patientId) conditions.push(eq(dentalAppointments.patientId, filters.patientId));
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset);

  const appointments = rows.map((row) => {
    const { firstName, lastName, ...appt } = row;
    const patientName = firstName
      ? [firstName, lastName].filter(Boolean).join(' ')
      : undefined;
    return { ...appt, patientName };
  });

  return ctx.json(appointments);
}
