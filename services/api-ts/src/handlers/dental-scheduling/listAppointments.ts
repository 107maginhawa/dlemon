/**
 * listAppointments handler
 *
 * GET /dental/appointments
 * Lists dental appointments with optional filters.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import type { AppointmentFilters } from './repos/dental-appointment.repo';
import type { User } from '@/types/auth';

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
  const repo = new DentalAppointmentRepository(db);

  const appointments = await repo.findMany(
    Object.keys(filters).length > 0 ? filters : undefined
  );

  return ctx.json(appointments);
}
