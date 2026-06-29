/**
 * DentalChartThumbnail
 *
 * Compact pip-grid preview of a patient's dental chart.
 * 2 rows × 16 columns (upper jaw + lower jaw) using FDI notation.
 */

import type { ToothState } from '@/lib/dental-chart-types';

// Upper jaw: 11–18 (patient's right) + 21–28 (patient's left)
const UPPER_JAW = [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28];
// Lower jaw: 31–38 (patient's left) + 41–48 (patient's right)
const LOWER_JAW = [31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48];

export function getThumbnailPipClass(state: ToothState): string {
  switch (state) {
    case 'healthy':
      return 'bg-muted';
    case 'caries':
      return 'bg-dental-caries/60';
    case 'fractured':
      return 'bg-dental-fractured/70';
    case 'filled':
      return 'bg-dental-filled';
    case 'crown':
      return 'bg-dental-crown';
    case 'extracted':
      return 'border border-dashed border-muted-foreground bg-transparent';
    case 'missing':
      return 'bg-dental-missing/50';
    case 'implant':
      return 'bg-dental-implant';
    case 'watchlist':
      return 'bg-dental-crown/50';
    default:
      return 'bg-muted';
  }
}

interface DentalChartThumbnailProps {
  teeth: Array<{ toothNumber: number; state: ToothState }>;
}

export function DentalChartThumbnail({ teeth }: DentalChartThumbnailProps) {
  const toothMap = new Map<number, ToothState>(
    teeth.map((t) => [t.toothNumber, t.state])
  );

  const renderRow = (toothNumbers: number[]) => (
    <div
      style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
      className="grid gap-px"
    >
      {toothNumbers.map((toothNumber) => {
        const state = toothMap.get(toothNumber) ?? 'healthy';
        return (
          <div
            key={toothNumber}
            data-tooth={toothNumber}
            className={`w-1 h-1 rounded-sm ${getThumbnailPipClass(state)}`}
          />
        );
      })}
    </div>
  );

  return (
    <div
      data-testid="dental-chart-thumbnail"
      aria-label="Dental chart thumbnail"
      className="flex flex-col gap-0.5 px-3 pb-2"
    >
      {renderRow(UPPER_JAW)}
      {renderRow(LOWER_JAW)}
    </div>
  );
}
