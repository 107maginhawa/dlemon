/**
 * tooth-layer-explanation — P0-D "why does this tooth show this color/layer?".
 *
 * Derives the layer from the SAME resolveToothLayer the odontogram renders with,
 * then attaches a human-readable reason. Because the layer comes from the chart's
 * own function, the explanation can never disagree with the rendered color.
 */
import { resolveToothLayer, type ChartLayer } from './dental-chart.helpers';
import type { ChartEntryClassification } from './dental-chart.helpers';

export interface ToothLayerExplanation {
  layer: ChartLayer;
  label: string;
  reason: string;
}

const LABELS: Record<ChartLayer, string> = {
  baseline: 'Baseline',
  proposed: 'Proposed',
  completed: 'Treated', // item 2 — never reads as the visit/card "Completed" status
  declined: 'Declined',
};

export function explainToothLayer(
  toothNumber: number,
  entryClassification: ChartEntryClassification | undefined,
  sets?: { completed?: ReadonlySet<number>; proposed?: ReadonlySet<number>; declined?: ReadonlySet<number> },
): ToothLayerExplanation {
  const layer = resolveToothLayer(toothNumber, entryClassification, sets);

  let reason: string;
  switch (layer) {
    case 'completed':
      reason = 'A treatment on this tooth has been performed or verified.';
      break;
    case 'proposed':
      reason = 'There is planned (diagnosed/planned) work on this tooth.';
      break;
    case 'declined':
      reason = 'A recommended treatment on this tooth was declined by the patient.';
      break;
    case 'baseline':
    default:
      reason = entryClassification === 'existing' || entryClassification === 'existing_other'
        ? 'Recorded as existing dentition (baseline).'
        : 'No active treatment on this tooth — shown at baseline.';
      break;
  }

  return { layer, label: LABELS[layer], reason };
}
