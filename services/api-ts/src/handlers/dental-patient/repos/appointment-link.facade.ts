/**
 * appointment-link.facade.ts
 *
 * Narrow read surface so the dental-patient treatment-plan handlers can verify an
 * appointment exists and belongs to the patient before linking a plan item to it
 * (P1-21), without importing the full dental-scheduling repo across the boundary.
 * Uses a relative schema import (the same loose-coupling pattern treatment-plan.repo
 * already uses to read dental-visit treatments).
 */

import { and, eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAppointments } from '../../dental-scheduling/repos/dental-appointment.schema';

/** Returns true if an appointment with this id exists for the given patient. */
export async function appointmentExistsForPatient(
  db: DatabaseInstance,
  appointmentId: string,
  patientId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: dentalAppointments.id })
    .from(dentalAppointments)
    .where(and(eq(dentalAppointments.id, appointmentId), eq(dentalAppointments.patientId, patientId)));
  return Boolean(row);
}
