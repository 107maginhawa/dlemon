/**
 * chart-export — P0-B structured chart export (pure builder).
 *
 * Composes a portable, self-contained snapshot of a visit's chart: header
 * (patient/provider/branch/date), the odontogram tooth/surface table with each
 * tooth's derived display layer, a legend, and a proposed/completed/declined
 * treatment summary.
 *
 * SHARED LAYER-PRECEDENCE CONTRACT (keep in sync with the FE living-document chart
 * `apps/dentalemon/src/features/workspace/lib/chart-layers.ts` → deriveChartLayerSets):
 *   precedence: completed > proposed > declined > baseline (else unset)
 *   completed = treatment status performed | verified
 *   proposed  = status diagnosed | planned ; declined = status declined
 * The two implementations can't share a function across the module boundary, so they
 * are maintained independently and MUST agree. The precedence is pinned in
 * chart-export.test.ts ("derived tooth layers" / "completed wins …"); changing it here
 * requires the same change in chart-layers.ts (and vice versa).
 * Kept pure (no DB) so the layer/summary logic is unit-tested directly.
 */
import type { ToothChartState, ChartEntryClassification } from '../repos/dental-chart.schema';

export interface ChartExportTreatmentInput {
  toothNumber?: number | null;
  cdtCode: string;
  description: string;
  surfaces?: string[] | null;
  status: string;
  priceCents: number;
}

export interface ChartExportInput {
  patient: { id: string; name: string; dateOfBirth?: string | null };
  visit: { id: string; date: Date; status: string; providerMemberId?: string | null; branchId: string };
  branchName?: string | null;
  providerName?: string | null;
  chartTeeth: ToothChartState[];
  treatments: ChartExportTreatmentInput[];
  generatedAt: Date;
}

export interface ChartExportTooth {
  toothNumber: number;
  state: string;
  layer: string;
  surfaces?: string[];
  conditionCode?: string;
  entryClassification?: ChartEntryClassification;
  note?: string;
}

export interface ChartExportTreatment {
  toothNumber?: number;
  cdtCode: string;
  description: string;
  surfaces?: string[];
  status: string;
  priceCents: number;
}

export interface ChartExport {
  patientId: string;
  patientName: string;
  patientDateOfBirth?: string;
  visitId: string;
  visitDate: Date;
  visitStatus: string;
  providerMemberId?: string;
  providerName?: string;
  branchId: string;
  branchName?: string;
  notation: string;
  generatedAt: Date;
  teeth: ChartExportTooth[];
  treatments: ChartExportTreatment[];
  summary: { proposedCount: number; completedCount: number; declinedCount: number; totalProposedCents: number };
  legend: Array<{ key: string; label: string }>;
}

export const CHART_EXPORT_LEGEND: Array<{ key: string; label: string }> = [
  { key: 'baseline', label: 'Existing / baseline' },
  { key: 'proposed', label: 'Proposed' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
];

const BASELINE_CLASSES = new Set<ChartEntryClassification>(['existing', 'existing_other']);

/** Derive the proposed/completed/declined tooth-number sets from the treatments. */
function deriveLayerSets(treatments: ChartExportTreatmentInput[]) {
  const completed = new Set<number>();
  const proposed = new Set<number>();
  const declined = new Set<number>();
  for (const t of treatments) {
    if (t.toothNumber == null) continue;
    if (t.status === 'performed' || t.status === 'verified') completed.add(t.toothNumber);
  }
  for (const t of treatments) {
    const n = t.toothNumber;
    if (n == null || completed.has(n)) continue; // completed wins
    if (t.status === 'diagnosed' || t.status === 'planned') proposed.add(n);
    else if (t.status === 'declined') declined.add(n);
  }
  // proposed supersedes a declined item on the same tooth
  for (const n of proposed) declined.delete(n);
  return { completed, proposed, declined };
}

export function buildChartExport(input: ChartExportInput): ChartExport {
  const { completed, proposed, declined } = deriveLayerSets(input.treatments);

  function layerFor(tooth: ToothChartState): string {
    if (completed.has(tooth.toothNumber)) return 'completed';
    if (proposed.has(tooth.toothNumber)) return 'proposed';
    if (declined.has(tooth.toothNumber)) return 'declined';
    if (tooth.entryClassification && BASELINE_CLASSES.has(tooth.entryClassification)) return 'baseline';
    return 'unset';
  }

  const teeth: ChartExportTooth[] = [...input.chartTeeth]
    .sort((a, b) => a.toothNumber - b.toothNumber)
    .map((t) => ({
      toothNumber: t.toothNumber,
      state: t.state,
      layer: layerFor(t),
      surfaces: t.surfaces,
      conditionCode: t.conditionCode,
      entryClassification: t.entryClassification,
      note: t.note,
    }));

  const treatments: ChartExportTreatment[] = input.treatments.map((t) => ({
    toothNumber: t.toothNumber ?? undefined,
    cdtCode: t.cdtCode,
    description: t.description,
    surfaces: t.surfaces ?? undefined,
    status: t.status,
    priceCents: t.priceCents,
  }));

  const totalProposedCents = input.treatments
    .filter((t) => t.status === 'diagnosed' || t.status === 'planned')
    .reduce((sum, t) => sum + t.priceCents, 0);

  return {
    patientId: input.patient.id,
    patientName: input.patient.name,
    patientDateOfBirth: input.patient.dateOfBirth ?? undefined,
    visitId: input.visit.id,
    visitDate: input.visit.date,
    visitStatus: input.visit.status,
    providerMemberId: input.visit.providerMemberId ?? undefined,
    providerName: input.providerName ?? undefined,
    branchId: input.visit.branchId,
    branchName: input.branchName ?? undefined,
    notation: 'FDI',
    generatedAt: input.generatedAt,
    teeth,
    treatments,
    summary: {
      proposedCount: proposed.size,
      completedCount: completed.size,
      declinedCount: declined.size,
      totalProposedCents,
    },
    legend: CHART_EXPORT_LEGEND,
  };
}
