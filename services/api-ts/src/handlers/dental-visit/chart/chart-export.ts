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
 *   precedence: proposed > completed > declined > baseline (else unset)  [item 6 flip]
 *   completed = treatment status performed | verified
 *   proposed  = status diagnosed | planned ; declined = status declined
 * Outstanding planned/diagnosed work wins so it is never hidden behind a completed
 * (Treated) layer. The two implementations can't share a function across the module
 * boundary, so they are maintained independently and MUST agree. The precedence is
 * pinned in chart-export.test.ts ("derived tooth layers" / "proposed wins …");
 * changing it here requires the same change in chart-layers.ts (and vice versa).
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
  // Labels mirror the on-screen chart's layer terms (FE LAYER_LABELS:
  // proposed→Planned, completed→Treated) so the printed legend matches what the
  // dentist sees. Keys are unchanged. BE can't import the FE helper across the
  // module boundary, so this constant is the BE source of truth.
  { key: 'baseline', label: 'Existing' },
  { key: 'proposed', label: 'Planned' },
  { key: 'completed', label: 'Treated' },
  { key: 'declined', label: 'Declined' },
];

const BASELINE_CLASSES = new Set<ChartEntryClassification>(['existing', 'existing_other']);

/** Derive the proposed/completed/declined tooth-number sets from the treatments. */
export function deriveLayerSets(treatments: ChartExportTreatmentInput[]) {
  const completed = new Set<number>();
  const proposed = new Set<number>();
  const declined = new Set<number>();
  for (const t of treatments) {
    if (t.toothNumber == null) continue;
    if (t.status === 'performed' || t.status === 'verified') completed.add(t.toothNumber);
  }
  for (const t of treatments) {
    const n = t.toothNumber;
    if (n == null) continue;
    if (t.status === 'diagnosed' || t.status === 'planned') proposed.add(n);
    else if (t.status === 'declined') declined.add(n);
  }
  // Item 6 flip — proposed wins: a planned/diagnosed item supersedes BOTH a
  // completed treatment AND a declined item on the same tooth, so outstanding work
  // is never hidden behind a completed (Treated) layer. Keep the sets disjoint.
  for (const n of proposed) {
    completed.delete(n);
    declined.delete(n);
  }
  return { completed, proposed, declined };
}

/**
 * Cumulative as-of layer derivation. Unlike deriveLayerSets (per-visit, status-only),
 * this answers "what is each tooth's lifecycle layer AS OF a given visit date", across
 * the patient's whole charted treatment history. Completed-as-of is exact via
 * performedAt; proposed/declined-as-of use the origin/owning-visit date (no dedicated
 * transition timestamp exists — see treatment.lifecycle.characterization.test.ts).
 *
 * `changed` = teeth whose layer transitioned IN the as-of visit (same-day), driving the
 * "changed this visit" cue. Precedence is identical to deriveLayerSets (proposed wins
 * over completed and declined) so the FE/BE contract holds.
 */
export interface AsOfTreatment {
  toothNumber: number | null;
  status: string;
  performedAt: Date | null;
  visitId: string;
  sourceVisitId: string | null;
  carriedOver: boolean;
}

export function deriveLayerSetsAsOf(
  treatments: AsOfTreatment[],
  asOf: Date,
  visitDateById: Map<string, Date>,
) {
  const proposed = new Set<number>();
  const completed = new Set<number>();
  const declined = new Set<number>();
  const changed = new Set<number>();

  const dateOf = (id: string | null) => (id ? visitDateById.get(id) ?? null : null);
  const onOrBefore = (d: Date | null) => d != null && d.getTime() <= asOf.getTime();
  const sameDay = (d: Date | null) => d != null && d.getTime() === asOf.getTime();

  for (const t of treatments) {
    const n = t.toothNumber;
    if (n == null) continue;
    // "origin date" = when the work was first proposed (sourceVisitId for carry-overs,
    // else the row's own visit).
    const originDate = dateOf(t.sourceVisitId) ?? dateOf(t.visitId);
    const visitDate = dateOf(t.visitId);

    if (t.status === 'performed' || t.status === 'verified') {
      if (onOrBefore(t.performedAt)) {
        completed.add(n);
        if (sameDay(t.performedAt)) changed.add(n);
      } else if (onOrBefore(originDate)) {
        // Performed in the FUTURE relative to as-of, but already proposed → Planned then.
        proposed.add(n);
        if (sameDay(originDate)) changed.add(n);
      }
      continue;
    }
    if (t.status === 'declined') {
      if (onOrBefore(visitDate)) { declined.add(n); if (sameDay(visitDate)) changed.add(n); }
      continue;
    }
    if (t.status === 'diagnosed' || t.status === 'planned') {
      if (onOrBefore(originDate)) { proposed.add(n); if (sameDay(originDate)) changed.add(n); }
      continue;
    }
    // dismissed → off-chart, skip.
  }

  // Precedence (LOCKED, must match deriveLayerSets + chart-layers.ts): a fresh proposal
  // supersedes both a completed treatment and a prior refusal. Keep the sets disjoint.
  for (const n of proposed) { completed.delete(n); declined.delete(n); }
  return { proposed, completed, declined, changed };
}

/**
 * Terminal tooth states have no actionable lifecycle: a missing/extracted tooth can't
 * be Planned/Treated/Declined. Callers strip these from the actionable layers and paint
 * them at top precedence (mirror of FE resolveToothLayer terminal handling).
 */
const TERMINAL_STATES = new Set(['missing', 'extracted']);
export function resolveTerminalTeeth(teeth: Array<{ toothNumber: number; state: string }>): Set<number> {
  const out = new Set<number>();
  for (const t of teeth) if (TERMINAL_STATES.has(t.state)) out.add(t.toothNumber);
  return out;
}

export function buildChartExport(input: ChartExportInput): ChartExport {
  const { completed, proposed, declined } = deriveLayerSets(input.treatments);

  function layerFor(tooth: ToothChartState): string {
    if (proposed.has(tooth.toothNumber)) return 'proposed';
    if (completed.has(tooth.toothNumber)) return 'completed';
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
