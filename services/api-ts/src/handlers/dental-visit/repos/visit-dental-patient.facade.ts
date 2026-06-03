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
import { VisitRepository } from './visit.repo';
import type { ToothChartState } from './dental-chart.schema';

/** Re-exported so dental-patient handlers can type tooth-chart payloads without
 *  importing dental-visit's schema directly (Phase 10 boundary lint). */
export type { ToothChartState } from './dental-chart.schema';

/** Treatment-phase ordering + type, re-exported for dental-patient's
 *  case-presentation aggregate (avoids a direct treatment.schema import). */
export { TREATMENT_PHASE_ORDER } from './treatment.schema';
export type { DentalTreatmentPhase } from './treatment.schema';

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

/** Fetch a visit by id (dentition init needs its branchId for authorization). */
export async function getVisitById(db: DatabaseInstance, visitId: string) {
  return new VisitRepository(db).findOneById(visitId);
}

/** Upsert a visit's tooth chart (dentition initialization). */
export async function upsertDentitionChart(
  db: DatabaseInstance,
  input: { visitId: string; patientId: string; teeth: ToothChartState[] },
  logger?: unknown,
) {
  return new DentalChartRepository(db, logger as never).upsert(input);
}
