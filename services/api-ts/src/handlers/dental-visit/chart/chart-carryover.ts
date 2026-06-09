/**
 * chart-carryover — build a new visit's chart from the patient baseline.
 *
 * The odontogram is a living document: a returning patient's new visit inherits
 * their cumulative existing dentition rather than starting blank. The baseline
 * (`dental_patient_chart_baseline`) is already the last-write-wins, existing-
 * protected current mouth state, so it is carried forward VERBATIM — no
 * classification filtering, which would risk silently dropping performed
 * restorations. Today's new findings are charted on top this visit.
 *
 * This is a READ-TIME synthetic chart (not a persisted `dental_chart` row); the
 * first save creates the real row via upsertDentalChart. The sentinel id flags
 * that — and is safe because the per-tooth edit route is visitId-based, not
 * chartId-based, and the FE reads only `.teeth`.
 */
import type { DentalPatientChartBaseline } from '../repos/dental-chart-baseline.schema';
import type { ToothChartState } from '../repos/dental-chart.schema';

/** Sentinel id for a baseline-derived chart that has no persisted `dental_chart` row yet. */
export const CARRYOVER_CHART_ID = '00000000-0000-0000-0000-000000000000';

export interface CarryOverChart {
  id: string;
  visitId: string;
  patientId: string;
  teeth: ToothChartState[];
  createdAt: Date;
  updatedAt: Date;
}

export function chartFromBaseline(
  baseline: Pick<DentalPatientChartBaseline, 'teeth'> & { snapshotAt?: Date; updatedAt?: Date },
  visit: { id: string; patientId: string },
  now: Date = new Date(),
): CarryOverChart {
  return {
    id: CARRYOVER_CHART_ID,
    visitId: visit.id,
    patientId: visit.patientId,
    teeth: baseline.teeth,
    createdAt: baseline.snapshotAt ?? now,
    updatedAt: baseline.updatedAt ?? baseline.snapshotAt ?? now,
  };
}
