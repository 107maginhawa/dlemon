/**
 * visit-billing.facade.ts
 *
 * Facade exposing dental-visit repo data to dental-billing handlers.
 * Isolates cross-module access behind typed functions — dental-billing
 * imports only this file, never the underlying repos directly.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalVisits } from './visit.schema';
import { TreatmentRepository } from './treatment.repo';
import type { DentalTreatment } from './treatment.schema';

export async function getVisitForBilling(
  db: DatabaseInstance,
  visitId: string,
): Promise<{ id: string; completedAt: Date | null; branchId: string; patientId: string } | null> {
  const [visit] = await db
    .select({
      id: dentalVisits.id,
      completedAt: dentalVisits.completedAt,
      branchId: dentalVisits.branchId,
      patientId: dentalVisits.patientId,
    })
    .from(dentalVisits)
    .where(eq(dentalVisits.id, visitId))
    .limit(1);
  return visit ?? null;
}

export async function getTreatmentsForInvoice(db: DatabaseInstance, visitId: string): Promise<DentalTreatment[]> {
  return new TreatmentRepository(db).findByVisit(visitId);
}

export async function markTreatmentsAsBilled(
  db: DatabaseInstance,
  treatmentIds: string[],
  invoiceId: string,
): Promise<void> {
  return new TreatmentRepository(db).setBilledInvoiceId(treatmentIds, invoiceId);
}
