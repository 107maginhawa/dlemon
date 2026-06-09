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
 * Clinical precedence: completed > proposed > declined. A tooth that has been
 * treated is shown done even if another planned/declined item still references it
 * (e.g. a second recommendation on the same tooth). This keeps the chart honest —
 * the Completed layer never double-counts a tooth as still pending.
 */
import type { TreatmentPlanData } from '../hooks/use-treatment-plan';

export interface ChartLayerSets {
  proposed: Set<number>;
  completed: Set<number>;
  declined: Set<number>;
  carriedOver: Set<number>;
}

export function deriveChartLayerSets(plan: TreatmentPlanData | null | undefined): ChartLayerSets {
  const completed = new Set<number>(plan?.completedToothNumbers ?? []);
  const proposed = new Set<number>();
  const declined = new Set<number>();
  const carriedOver = new Set<number>();

  for (const t of plan?.treatments ?? []) {
    const n = t.toothNumber;
    if (n == null) continue;
    if (completed.has(n)) continue; // completed wins — never re-list as pending
    if (t.status === 'diagnosed' || t.status === 'planned') {
      proposed.add(n);
      if (t.carriedOver) carriedOver.add(n);
    } else if (t.status === 'declined') {
      declined.add(n);
    }
  }

  // proposed wins over declined for the same tooth (a fresh recommendation
  // supersedes a refusal already in the list).
  for (const n of proposed) declined.delete(n);

  return { proposed, completed, declined, carriedOver };
}
