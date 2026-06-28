/**
 * ChartExportOverlay — P0-B: fetches a visit's structured chart export and shows
 * it in a print-ready overlay (window.print()). The toolbar is hidden in print.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { exportDentalChartOptions } from '@monobase/sdk-ts/generated/react-query';
import type { ChartExport } from '@monobase/sdk-ts/generated';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { ChartExportView } from './chart-export-view';

export interface ChartExportOverlayProps {
  visitId: string;
  open: boolean;
  onClose: () => void;
}

export function ChartExportOverlay({ visitId, open, onClose }: ChartExportOverlayProps) {
  const query = useQuery({
    ...exportDentalChartOptions({ path: { visitId } }),
    enabled: open,
  });

  // WCAG 2.1.2 / 2.4.3: Escape closes + Tab is trapped within the overlay,
  // focus returns to the opener on close (matches the other sheets).
  const { containerRef } = useSheetA11y({ open, onClose });

  if (!open) return null;

  const data = query.data as ChartExport | undefined;

  return (
    <div
      ref={containerRef}
      data-testid="chart-export-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Chart export"
      className="fixed inset-0 z-50 overflow-auto bg-black/40 p-4 print:bg-white print:p-0"
    >
      <div className="mx-auto max-w-3xl rounded-lg bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-center justify-end gap-2 border-b px-4 py-2 print:hidden">
          <button
            type="button"
            data-testid="chart-export-print"
            onClick={() => window.print()}
            className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          >
            Print
          </button>
          <button
            type="button"
            data-testid="chart-export-close"
            onClick={onClose}
            className="rounded border px-3 py-1 text-xs font-medium"
          >
            Close
          </button>
        </div>
        {query.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading export…</div>
        ) : data ? (
          <ChartExportView exportDoc={data} />
        ) : (
          <div className="p-6 text-sm text-destructive">Failed to load chart export.</div>
        )}
      </div>
    </div>
  );
}
