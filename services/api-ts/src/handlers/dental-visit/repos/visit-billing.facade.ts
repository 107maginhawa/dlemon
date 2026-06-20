/**
 * visit-billing.facade.ts
 *
 * Facade exposing dental-visit repo data to dental-billing handlers.
 * Isolates cross-module access behind typed functions — dental-billing
 * imports only this file, never the underlying repos directly.
 */

import { eq, inArray, isNotNull, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalVisits } from './visit.schema';
import { dentalProcedureCodes } from './procedure-code.schema';
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

/**
 * WFG-004: locked (FOR UPDATE) read of a visit's treatments for the invoice-create
 * path. MUST be called inside the create transaction so concurrent createDentalInvoice
 * for the same visit serialize on the treatment rows (the loser then sees them billed
 * and is rejected) — closing the double-billing race the plain read leaves open.
 */
export async function getTreatmentsForInvoiceLocked(db: DatabaseInstance, visitId: string): Promise<DentalTreatment[]> {
  return new TreatmentRepository(db).findByVisitForUpdate(visitId);
}

/**
 * BR-048: per-procedure payment terms (days) for a set of CDT codes. Returns
 * only the non-null terms so the caller can take their MAX. Empty input or no
 * configured terms yields an empty array (→ falls through to the clinic default).
 */
export async function getProcedureTermsForCdtCodes(
  db: DatabaseInstance,
  cdtCodes: string[],
): Promise<number[]> {
  if (cdtCodes.length === 0) return [];
  const rows = await db
    .select({ termsDays: dentalProcedureCodes.paymentTermsDays })
    .from(dentalProcedureCodes)
    .where(and(inArray(dentalProcedureCodes.cdtCode, cdtCodes), isNotNull(dentalProcedureCodes.paymentTermsDays)));
  return rows.map((r) => r.termsDays).filter((d): d is number => d != null);
}

export async function markTreatmentsAsBilled(
  db: DatabaseInstance,
  treatmentIds: string[],
  invoiceId: string,
): Promise<void> {
  return new TreatmentRepository(db).setBilledInvoiceId(treatmentIds, invoiceId);
}
