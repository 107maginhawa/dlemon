/**
 * listAppointments handler
 *
 * GET /dental/appointments
 * Lists dental appointments with optional filters.
 * Joins patient+person for patientName.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { listAppointmentsWithPatientName } from './repos/appointment-patient.facade';
import type { User } from '@/types/auth';
import { eq, gte, lt, type SQL } from 'drizzle-orm';
import { dentalAppointments } from './repos/dental-appointment.schema';
import { assertBranchAccess } from './utils/assert-branch-access';
import type { ListAppointmentsQuery } from '@/generated/openapi/validators';
import { toWire } from './appointment-wire';

const MAX_RANGE_DAYS = 31;
const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;

export async function listAppointments(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const query = ctx.req.valid('query') as ListAppointmentsQuery;
  const rawQuery = ctx.req.query();

  // V-SCH-004: branchId, date_from and date_to are required calendar-window params.
  const branchId = query.branchId ?? rawQuery['branchId'];
  const dateFrom = (query as { dateFrom?: string }).dateFrom ?? rawQuery['date_from'];
  const dateTo = (query as { dateTo?: string }).dateTo ?? rawQuery['date_to'];
  if (!branchId) throw new ValidationError('branchId is required');
  if (!dateFrom || !dateTo) throw new ValidationError('date_from and date_to are required');

  const windowStart = new Date(dateFrom + 'T00:00:00.000Z');
  const windowEnd = new Date(dateTo + 'T23:59:59.999Z');
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
    throw new ValidationError('date_from and date_to must be valid dates');
  }
  if (windowEnd.getTime() < windowStart.getTime()) {
    throw new ValidationError('date_to must be on or after date_from');
  }
  // 31-day cap (inclusive).
  const rangeDays = Math.floor((windowEnd.getTime() - windowStart.getTime()) / 86_400_000) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    throw new ValidationError(`date range must not exceed ${MAX_RANGE_DAYS} days`);
  }

  // Pagination: page/per_page (1-based).
  const providerId = (query as { providerId?: string }).providerId ?? rawQuery['providerId'];
  const patientId = (query as { patientId?: string }).patientId ?? rawQuery['patientId'];
  const status = query.status as string | undefined;
  const page = Math.max(parseInt(rawQuery['page'] ?? '1', 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(rawQuery['per_page'] ?? String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
  const limit = perPage;
  const offset = (page - 1) * perPage;

  const db = ctx.get('database') as DatabaseInstance;

  // Authorization: caller must have access to the requested branch.
  await assertBranchAccess(db, user.id, branchId);

  const conditions: (SQL<unknown> | undefined)[] = [
    eq(dentalAppointments.branchId, branchId),
    gte(dentalAppointments.scheduledAt, windowStart),
    lt(dentalAppointments.scheduledAt, new Date(windowEnd.getTime() + 1)),
  ];

  if (providerId) conditions.push(eq(dentalAppointments.dentistMemberId, providerId));
  if (status) conditions.push(eq(dentalAppointments.status, status as typeof dentalAppointments.status._.data));
  if (patientId) conditions.push(eq(dentalAppointments.patientId, patientId));

  const appointments = await listAppointmentsWithPatientName(db, conditions, limit, offset);
  return ctx.json(appointments.map((a) => toWire(a)));
}
