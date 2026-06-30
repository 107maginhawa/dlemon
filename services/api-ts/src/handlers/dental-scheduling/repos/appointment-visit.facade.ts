/**
 * appointment-visit.facade.ts (G-12)
 *
 * Facade exposing the appointment↔visit lifecycle handoff to dental-visit
 * (Phase 10 boundary lint: dental-visit imports this facade, never the
 * dental-scheduling repo directly).
 */

import type { DatabaseInstance } from '@/core/database';
import { DentalAppointmentRepository } from './dental-appointment.repo';

/**
 * Advance the checked_in appointment linked to `visitId` to 'completed' when the
 * visit is completed. Idempotent and guarded (only a checked_in appointment is
 * touched). Returns true when an appointment was advanced, false when there was
 * nothing to advance (walk-in visit with no appointment, or already terminal).
 */
export async function completeAppointmentForVisit(
  db: DatabaseInstance,
  visitId: string,
  updatedBy?: string,
): Promise<boolean> {
  const updated = await new DentalAppointmentRepository(db).completeByVisit(visitId, updatedBy);
  return updated !== null;
}
