/**
 * chart-layers — derive the odontogram's cumulative layer sets from the
 * patient-level treatment-plan aggregate.
 *
 * The dental chart is a living document. Its Proposed / Completed / Declined
 * layers are status-filtered views over the patient's treatments across ALL
 * visits, not the current visit alone:
 *   - completed  = teeth with a performed/verified treatment (cumulative; comes
 *                  from the aggregate's `completedToothNumbers`).
 *   - proposed   = teeth with a live planned treatment (status diagnosed/planned).
 *   - declined   = teeth whose recommended treatment the patient refused.
 *   - carriedOver = proposed teeth first proposed in a prior visit (carriedOver flag).
 *
 * Clinical precedence: proposed > completed > declined (> baseline). A tooth with
 * outstanding planned/diagnosed work is shown Planned even when it also carries a
 * performed treatment, so new work is never hidden behind a Treated ring (item 6
 * flip). A fresh proposal also supersedes a prior declination on the same tooth.
 *
 * SHARED LAYER-PRECEDENCE CONTRACT (keep in sync with the backend chart export
 * `services/api-ts/src/handlers/dental-visit/chart/chart-export.ts` → deriveLayerSets):
 *   precedence: proposed > completed > declined > baseline (else unset)
 *   completed = treatment status performed | verified
 *   proposed  = status diagnosed | planned ; declined = status declined
 * The two implementations can't share a function across the module boundary, so they
 * are maintained independently and MUST agree. Changing precedence here requires the
 * same change in chart-export.ts (pinned in chart-export.test.ts).
 */
import { statusToLayer, type TreatmentLayerStatus } from '../components/dental-chart.helpers';
import type { TreatmentPlanData } from '../hooks/use-treatment-plan';

export interface ChartLayerSets {
  proposed: Set<number>;
  completed: Set<number>;
  declined: Set<number>;
  carriedOver: Set<number>;
}

export function deriveChartLayerSets(
  plan: TreatmentPlanData | null | undefined,
  terminalToothNumbers?: ReadonlySet<number>,
): ChartLayerSets {
  const completed = new Set<number>(plan?.completedToothNumbers ?? []);
  const proposed = new Set<number>();
  const declined = new Set<number>();
  const carriedOver = new Set<number>();

  for (const t of plan?.treatments ?? []) {
    const n = t.toothNumber;
    if (n == null) continue;
    // P0-2: derive the layer through the shared statusToLayer() fold so the chart
    // and the treatment list can never disagree on what a tooth's status means.
    const layer = statusToLayer(t.status as TreatmentLayerStatus);
    if (layer === 'proposed') {
      proposed.add(n);
      if (t.carriedOver) carriedOver.add(n);
    } else if (layer === 'declined') {
      declined.add(n);
    }
    // 'completed' here would come from completedToothNumbers (handled above);
    // null (dismissed) is off-chart and intentionally skipped.
  }

  // Item 6 flip — proposed wins: a fresh planned/diagnosed item supersedes BOTH a
  // completed treatment AND a prior refusal on the same tooth, so outstanding work
  // is never hidden behind a Treated ring. Keep the sets disjoint (proposed owns
  // the tooth) so the layer counts/visibility agree with resolveToothLayer.
  for (const n of proposed) {
    completed.delete(n);
    declined.delete(n);
  }

  // Terminal precedence (LOCKED, mirror BE resolveTerminalTeeth + deriveLayerSetsAsOf):
  // missing/extracted outrank every actionable layer — a gone tooth has no Planned/
  // Treated/Declined lifecycle, so strip it from all sets.
  if (terminalToothNumbers) {
    for (const n of terminalToothNumbers) {
      proposed.delete(n);
      completed.delete(n);
      declined.delete(n);
      carriedOver.delete(n);
    }
  }

  return { proposed, completed, declined, carriedOver };
}
