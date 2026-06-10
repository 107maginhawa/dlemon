/**
 * chart-conflict.helpers — pure derivations for the P0-A offline conflict UI.
 *
 * A "conflict" is a chart write the server rejected as a stale offline edit
 * (lower clock). These helpers derive the teeth to mark on the odontogram and
 * the headline count, kept pure so both the banner and the chart marker read
 * the SAME source (guards the "summary ≠ body" bug class).
 */
import type { ChartConflict } from '@monobase/sdk-ts/generated';

/** FDI numbers of every tooth rejected across all open conflicts (deduped). */
export function conflictedToothNumbers(conflicts: ChartConflict[]): Set<number> {
  const set = new Set<number>();
  for (const c of conflicts) {
    for (const t of c.rejectedTeeth ?? []) {
      if (typeof t.toothNumber === 'number') set.add(t.toothNumber);
    }
  }
  return set;
}

/** Total number of rejected teeth across all conflicts — the banner's headline count. */
export function totalRejectedTeeth(conflicts: ChartConflict[]): number {
  return conflicts.reduce((n, c) => n + (c.rejectedTeeth?.length ?? 0), 0);
}
