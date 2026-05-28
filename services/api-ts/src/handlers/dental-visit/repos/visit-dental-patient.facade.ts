/**
 * visit-dental-patient.facade.ts
 *
 * Facade exposing dental-visit data to dental-patient handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DentalChartRepository } from './dental-chart.repo';
import { TreatmentRepository } from './treatment.repo';

/** Get chart for a visit (for visit/condition lists). */
export async function getChartForPatientVisit(db: DatabaseInstance, visitId: string) {
  return new DentalChartRepository(db).findByVisit(visitId);
}

/** Get treatments for condition list. */
export async function getTreatmentsForPatientConditions(
  db: DatabaseInstance,
  visitId: string,
) {
  return new TreatmentRepository(db).findByVisit(visitId);
}
