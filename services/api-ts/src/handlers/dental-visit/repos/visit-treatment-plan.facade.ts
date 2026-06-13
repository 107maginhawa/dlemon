/**
 * visit-treatment-plan.facade.ts
 *
 * Facade exposing dental-visit's `dental_treatment` operations to dental-patient's
 * treatment-plan + case-presentation repos, which orchestrate plans/presentations
 * over the underlying treatment items. dental-patient imports only this facade,
 * never the treatment schema directly (Phase 10 boundary lint). Every query is
 * byte-identical to the former inline access — pure relocation, zero behavior
 * change.
 */

import { eq, and, inArray, isNull, ne } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalTreatments } from './treatment.schema';

/** Link the patient's unlinked diagnosed/planned treatments to a plan. Returns count linked. */
export async function linkPendingTreatmentsToPlan(
  db: DatabaseInstance,
  patientId: string,
  planId: string,
): Promise<number> {
  const linked = await db
    .update(dentalTreatments)
    .set({ treatmentPlanId: planId })
    .where(
      and(
        eq(dentalTreatments.patientId, patientId),
        inArray(dentalTreatments.status, ['diagnosed', 'planned']),
        isNull(dentalTreatments.treatmentPlanId),
      ),
    )
    .returning({ id: dentalTreatments.id });
  return linked.length;
}

/** Statuses of all treatments linked to a plan (for status derivation). */
export async function getTreatmentStatusesByPlan(
  db: DatabaseInstance,
  planId: string,
): Promise<Array<{ status: string }>> {
  return db
    .select({ status: dentalTreatments.status })
    .from(dentalTreatments)
    .where(eq(dentalTreatments.treatmentPlanId, planId)) as Promise<Array<{ status: string }>>;
}

/**
 * TP-BR-006: price cents of every treatment linked to a plan, patient-scoped.
 * Drives the plan's denormalized `totalEstimateCents` derivation (the item set is
 * the single source of truth for case money — same set `grandTotalCents` sums).
 */
export async function getTreatmentPriceCentsByPlan(
  db: DatabaseInstance,
  planId: string,
  patientId: string,
): Promise<Array<{ priceCents: number }>> {
  return db
    .select({ priceCents: dentalTreatments.priceCents })
    .from(dentalTreatments)
    .where(
      and(
        eq(dentalTreatments.treatmentPlanId, planId),
        eq(dentalTreatments.patientId, patientId),
      ),
    ) as Promise<Array<{ priceCents: number }>>;
}

/** Set (or clear, when appointmentId is null) a treatment's loose appointment ref. Patient-scoped. */
export async function setTreatmentAppointment(
  db: DatabaseInstance,
  treatmentId: string,
  patientId: string,
  appointmentId: string | null,
): Promise<{ id: string; appointmentId: string | null } | null> {
  const [row] = await db
    .update(dentalTreatments)
    .set({ appointmentId, updatedAt: new Date() })
    .where(and(eq(dentalTreatments.id, treatmentId), eq(dentalTreatments.patientId, patientId)))
    .returning({ id: dentalTreatments.id, appointmentId: dentalTreatments.appointmentId });
  return row ?? null;
}

/** The (planId, patientId) a treatment belongs to, if any. */
export async function getTreatmentPlanRef(
  db: DatabaseInstance,
  treatmentId: string,
): Promise<{ planId: string | null; patientId: string } | null> {
  const [row] = await db
    .select({ planId: dentalTreatments.treatmentPlanId, patientId: dentalTreatments.patientId })
    .from(dentalTreatments)
    .where(eq(dentalTreatments.id, treatmentId));
  return row ?? null;
}

/** Treatments in an alternate-case option group, patient-scoped. */
export async function getOptionGroupTreatments(
  db: DatabaseInstance,
  optionGroupId: string,
  patientId: string,
): Promise<Array<{ id: string; status: string; recommended: boolean }>> {
  return db
    .select({
      id: dentalTreatments.id,
      status: dentalTreatments.status,
      recommended: dentalTreatments.recommended,
    })
    .from(dentalTreatments)
    .where(
      and(
        eq(dentalTreatments.optionGroupId, optionGroupId),
        eq(dentalTreatments.patientId, patientId),
      ),
    ) as Promise<Array<{ id: string; status: string; recommended: boolean }>>;
}

/** Accept one option in a group (planned); decline non-terminal siblings. Returns post-state. */
export async function acceptTreatmentOption(
  db: DatabaseInstance,
  optionGroupId: string,
  chosenTreatmentId: string,
  patientId: string,
): Promise<Array<{ id: string; status: string; recommended: boolean }>> {
  const now = new Date();
  await db
    .update(dentalTreatments)
    .set({ status: 'planned', updatedAt: now })
    .where(
      and(
        eq(dentalTreatments.id, chosenTreatmentId),
        eq(dentalTreatments.optionGroupId, optionGroupId),
        eq(dentalTreatments.patientId, patientId),
      ),
    );
  await db
    .update(dentalTreatments)
    .set({ status: 'declined', refusalReason: 'Alternate option accepted', updatedAt: now })
    .where(
      and(
        eq(dentalTreatments.optionGroupId, optionGroupId),
        eq(dentalTreatments.patientId, patientId),
        inArray(dentalTreatments.status, ['diagnosed', 'planned']),
        ne(dentalTreatments.id, chosenTreatmentId),
      ),
    );
  return getOptionGroupTreatments(db, optionGroupId, patientId);
}

/** All treatment items linked to a plan, patient-scoped (case-presentation item list). */
export async function getTreatmentsByPlanForPatient(
  db: DatabaseInstance,
  planId: string,
  patientId: string,
) {
  return db
    .select()
    .from(dentalTreatments)
    .where(
      and(
        eq(dentalTreatments.treatmentPlanId, planId),
        eq(dentalTreatments.patientId, patientId),
      ),
    );
}

/** A representative visit id for a plan's linked items (consent e-sig anchor), or null. */
export async function getFirstVisitIdForPlan(
  db: DatabaseInstance,
  planId: string,
  patientId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ visitId: dentalTreatments.visitId })
    .from(dentalTreatments)
    .where(
      and(
        eq(dentalTreatments.treatmentPlanId, planId),
        eq(dentalTreatments.patientId, patientId),
      ),
    )
    .limit(1);
  return row?.visitId ?? null;
}
