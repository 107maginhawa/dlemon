/**
 * listMyAppointments — GET /me/appointments  (E4 portal, self-scoped read)
 *
 * Returns the AUTHENTICATED patient's OWN appointments. IDOR-free by
 * construction: the patientId is derived server-side from the session via
 * `resolveSelfPatientIdOrThrow` — there is no client-supplied patientId to
 * tamper. A staff-only account (no linked patient) gets 403; an unauthenticated
 * caller gets 401.
 *
 * Patient-appropriate projection: only schedule-facing fields are returned
 * (no internal staff fields like dentistMemberId, notes, cancellationReason).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { resolveSelfPatientIdOrThrow } from '@/handlers/shared/assert-self-patient';
import { getAppointmentsByPatientId } from '@/handlers/dental-scheduling/repos/appointment-portal.facade';
import { computeEndAt } from '@/handlers/dental-scheduling/appointment-wire';

export async function listMyAppointments(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Derive the caller's OWN patient id from the session — never from the client.
  const patientId = await resolveSelfPatientIdOrThrow(db, user.id);

  // Facade returns live (non-archived) appointments newest-first already.
  const rows = await getAppointmentsByPatientId(db, patientId);

  // Patient-appropriate projection.
  const appointments = rows
    .map((a) => ({
      id: a.id,
      branchId: a.branchId,
      startAt: a.scheduledAt.toISOString(),
      endAt: computeEndAt(a.scheduledAt, a.durationMinutes).toISOString(),
      visitType: a.serviceType,
      status: a.status,
      confirmedAt: a.confirmedAt ? a.confirmedAt.toISOString() : null,
    }));

  logger?.info(
    { action: 'listMyAppointments', patientId, count: appointments.length },
    'Patient self-service appointments retrieved',
  );

  return ctx.json(appointments, 200);
}
