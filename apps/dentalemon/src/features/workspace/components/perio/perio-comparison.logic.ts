/**
 * Pure logic for the perio multi-exam comparison view.
 *
 * Charts arrive newest-first (the API orders by completedAt desc). For every
 * periodontal metric LOWER is better (less bleeding, shallower pockets, less
 * attachment loss), so a decrease over time is an improvement.
 *
 * These functions are intentionally side-effect-free so the trend/delta maths
 * is unit-tested independently of React.
 */

import type { PerioChart, PerioToothReading } from '@monobase/sdk-ts/generated';

const DEPTH_FIELDS = ['depthBM', 'depthBC', 'depthBD', 'depthLM', 'depthLC', 'depthLD'] as const;

export type TrendDir = 'up' | 'down' | 'flat';

export interface MetricDelta {
  dir: TrendDir;
  /** For perio metrics, a downward move is an improvement. */
  better: boolean;
  /** Signed change vs the immediately-older exam (newer − older). */
  amount: number;
}

export interface SummaryRow {
  key: 'bop' | 'meanDepth' | 'deepPockets';
  label: string;
  /** One value per exam, aligned to the (newest-first) exam order. null = not recorded. */
  values: (number | null)[];
  /** Delta vs the immediately-older exam; aligned to exams. null for the oldest column or when incomparable. */
  deltas: (MetricDelta | null)[];
}

export interface ToothPdRow {
  toothNumber: number;
  /** Max probing depth for the tooth per exam (newest-first); null when the tooth wasn't charted that exam. */
  maxPd: (number | null)[];
  /** True when this exam's max PD is deeper than the immediately-older exam (worsening). Aligned to exams. */
  worse: boolean[];
}

/** Max probing depth across the 6 sites of one reading (null when no depths recorded). */
export function readingMaxPd(r: Pick<PerioToothReading, (typeof DEPTH_FIELDS)[number]>): number | null {
  let max: number | null = null;
  for (const f of DEPTH_FIELDS) {
    const v = r[f];
    if (typeof v === 'number') max = max === null ? v : Math.max(max, v);
  }
  return max;
}

function num(v: number | string | null | undefined): number | null {
  // `numeric` summary columns can arrive as strings ("37.50") over the wire.
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

function delta(newer: number | null, older: number | null): MetricDelta | null {
  if (newer === null || older === null) return null;
  const amount = newer - older;
  const dir: TrendDir = amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat';
  return { dir, better: dir === 'down', amount };
}

/** Three headline-metric rows (BOP%, mean depth, deep-pocket count) across exams. */
export function buildSummaryRows(charts: PerioChart[]): SummaryRow[] {
  const defs: { key: SummaryRow['key']; label: string; pick: (c: PerioChart) => number | null }[] = [
    { key: 'bop', label: 'Bleeding on probing', pick: (c) => num(c.summaryBopPercent) },
    { key: 'meanDepth', label: 'Mean pocket depth', pick: (c) => num(c.summaryMeanDepth) },
    { key: 'deepPockets', label: 'Deep pockets (≥5mm)', pick: (c) => num(c.summaryDeepPocketCount) },
  ];
  return defs.map(({ key, label, pick }) => {
    const values = charts.map(pick);
    const deltas = values.map((v, i) => (i < values.length - 1 ? delta(v, values[i + 1]!) : null));
    return { key, label, values, deltas };
  });
}

/**
 * Per-tooth max-PD trend grid. Rows = every tooth charted in any exam (FDI
 * ascending); columns = exams (newest-first). A cell is "worse" when its max PD
 * exceeds the immediately-older exam's max PD for the same tooth.
 */
export function buildToothPdRows(charts: PerioChart[]): ToothPdRow[] {
  const teeth = new Set<number>();
  const byChartTooth: Map<number, Map<number, number | null>> = new Map();
  charts.forEach((c, idx) => {
    const m = new Map<number, number | null>();
    for (const r of c.readings ?? []) {
      teeth.add(r.toothNumber);
      m.set(r.toothNumber, readingMaxPd(r));
    }
    byChartTooth.set(idx, m);
  });

  return [...teeth]
    .sort((a, b) => a - b)
    .map((toothNumber) => {
      const maxPd = charts.map((_, idx) => byChartTooth.get(idx)?.get(toothNumber) ?? null);
      const worse = maxPd.map((v, i) => {
        const older = maxPd[i + 1];
        return i < maxPd.length - 1 && v !== null && older != null && v > older;
      });
      return { toothNumber, maxPd, worse };
    });
}

/** Format a chart's completion date for a column header (falls back to created/updated). */
export function examDateLabel(c: PerioChart): string {
  const iso = c.completedAt ?? c.updatedAt ?? c.createdAt;
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
