/**
 * aggregate.ts — P1-20 case-presentation aggregate assembly.
 *
 * Builds the denormalized, patient-readable view from existing stores (no new
 * clinical writes): plan items grouped by clinical phase with per-phase + grand ₱
 * totals, alternate-case option groups with the recommended option flagged, and
 * refs to the patient's own annotated images. ₱-native; no insurance estimation.
 */

import type { DatabaseInstance } from '@/core/database';
import {
  CasePresentationRepository,
  type CasePresentationItem,
} from '../repos/case-presentation.repo';
import { TREATMENT_PHASE_ORDER, type DentalTreatmentPhase } from '../../dental-visit/repos/treatment.schema';
import {
  listPatientAnnotatedImages,
  type CasePresentationImageRef,
} from '../repos/case-presentation-imaging.facade';
import type { DentalCasePresentation } from '../repos/case-presentation.schema';
import type { DentalTreatmentPlan } from '../repos/treatment-plan.schema';

export interface CasePresentationPhase {
  phase: string | null;
  items: CasePresentationItem[];
  subtotalCents: number;
}

export interface CasePresentationOptionGroup {
  optionGroupId: string;
  options: CasePresentationItem[];
}

export interface CasePresentationAggregate {
  presentation: DentalCasePresentation;
  plan: DentalTreatmentPlan;
  patientFirstName: string;
  phases: CasePresentationPhase[];
  optionGroups: CasePresentationOptionGroup[];
  images: CasePresentationImageRef[];
  grandTotalCents: number;
}

/** Clinical rank for a phase key; null/unphased sorts last. */
function phaseRank(p: string | null): number {
  if (p && p in TREATMENT_PHASE_ORDER) return TREATMENT_PHASE_ORDER[p as DentalTreatmentPhase];
  return 99;
}

export async function buildCasePresentationAggregate(
  db: DatabaseInstance,
  repo: CasePresentationRepository,
  presentation: DentalCasePresentation,
  plan: DentalTreatmentPlan,
  patientFirstName: string,
): Promise<CasePresentationAggregate> {
  const items = await repo.findPlanItems(plan.id, presentation.patientId);

  // Group line items by clinical phase, preserving a null bucket for unphased items.
  const byPhase = new Map<string | null, CasePresentationItem[]>();
  for (const item of items) {
    const key = item.phase ?? null;
    const bucket = byPhase.get(key) ?? [];
    bucket.push(item);
    byPhase.set(key, bucket);
  }

  const phases: CasePresentationPhase[] = [...byPhase.entries()]
    .map(([phase, phaseItems]) => ({
      phase,
      items: phaseItems,
      subtotalCents: phaseItems.reduce((sum, i) => sum + i.priceCents, 0),
    }))
    .sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase));

  // Alternate-case option groups (P1-19): items that carry an optionGroupId.
  const byOption = new Map<string, CasePresentationItem[]>();
  for (const item of items) {
    if (!item.optionGroupId) continue;
    const bucket = byOption.get(item.optionGroupId) ?? [];
    bucket.push(item);
    byOption.set(item.optionGroupId, bucket);
  }
  const optionGroups: CasePresentationOptionGroup[] = [...byOption.entries()].map(
    ([optionGroupId, options]) => ({ optionGroupId, options }),
  );

  const grandTotalCents = items.reduce((sum, i) => sum + i.priceCents, 0);
  const images = await listPatientAnnotatedImages(db, presentation.patientId);

  return { presentation, plan, patientFirstName, phases, optionGroups, images, grandTotalCents };
}
