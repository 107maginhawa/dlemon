/**
 * getAppointment handler
 *
 * GET /dental/appointments/:appointmentId
 * Returns appointment with patientName resolved.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getAppointmentWithPatientName } from './repos/appointment-patient.facade';
import { assertBranchAccess } from './utils/assert-branch-access';
import type { User } from '@/types/auth';
import type { GetAppointmentParams } from '@/generated/openapi/validators';

export async function getAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { appointmentId } = ctx.req.valid('param') as GetAppointmentParams;
  const db = ctx.get('database') as DatabaseInstance;

  const appt = await getAppointmentWithPatientName(db, appointmentId);
  if (!appt) throw new NotFoundError('Appointment');

  await assertBranchAccess(db, user.id, appt.branchId);

  return ctx.json(appt);
}
