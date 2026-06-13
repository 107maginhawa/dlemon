/**
 * appointment-portal.facade.ts
 *
 * Facade exposing a patient's OWN appointments to the patient-portal module
 * (dental-portal). The portal must not import the dental-scheduling schema
 * directly (Phase 10 boundary lint) — it consumes only this facade.
 *
 * Scope is deliberately narrow: read appointments by patientId, excluding
 * soft-archived rows, newest first. No staff filters, no writes.
 */

import { eq, and, isNull, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAppointments, type DentalAppointment } from './dental-appointment.schema';

/** A patient's live (non-archived) appointments, newest first. */
export async function getAppointmentsByPatientId(
  db: DatabaseInstance,
  patientId: string,
): Promise<DentalAppointment[]> {
  return db
    .select()
    .from(dentalAppointments)
    .where(and(eq(dentalAppointments.patientId, patientId), isNull(dentalAppointments.deletedAt)))
    .orderBy(desc(dentalAppointments.scheduledAt));
}
