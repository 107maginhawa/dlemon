/**
 * getAppointment handler
 *
 * GET /dental/appointments/:appointmentId
 * Returns appointment with patientName resolved.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { assertBranchAccess } from './utils/assert-branch-access';
import type { User } from '@/types/auth';
import { eq } from 'drizzle-orm';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import type { GetAppointmentParams } from '@/generated/openapi/validators';

export async function getAppointment(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { appointmentId } = ctx.req.valid('param') as GetAppointmentParams;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalAppointmentRepository(db);

  const appt = await repo.findOneById(appointmentId);
  if (!appt) throw new NotFoundError('Appointment');

  await assertBranchAccess(db, user.id, appt.branchId);

  // Resolve patient name
  const patientRows = await db
    .select({ firstName: persons.firstName, lastName: persons.lastName })
    .from(patients)
    .leftJoin(persons, eq(persons.id, patients.person))
    .where(eq(patients.id, appt.patientId));

  const personRow = patientRows[0];
  const patientName = personRow?.firstName
    ? [personRow.firstName, personRow.lastName].filter(Boolean).join(' ')
    : undefined;

  return ctx.json({ ...appt, patientName });
}
