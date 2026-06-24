/**
 * PerioCalCell — read-only display of the server-derived Clinical Attachment Level.
 *
 * CAL = probing depth + gingival margin is computed and returned by the backend
 * (`computeReadingCal`). This component renders that value verbatim and NEVER
 * recomputes or edits it — any local recomputation would risk drift from the
 * backend formula (a clinical-safety bug). A null/undefined CAL (a partial site
 * still missing depth or GM) shows a muted dash placeholder, never 0.
 */

import React from 'react';
import { PERIO_SITE_LABEL, type PerioSite } from './perio-types';

export interface PerioCalCellProps {
  tooth: number;
  site: PerioSite;
  value: number | null | undefined;
}

export function PerioCalCell({ tooth, site, value }: PerioCalCellProps) {
  const hasValue = typeof value === 'number';
  return (
    <span
      aria-label={`Tooth ${tooth} ${PERIO_SITE_LABEL[site]} clinical attachment level`}
      data-testid="perio-cal-cell"
      className="flex h-6 w-9 items-center justify-center text-xs font-medium tabular-nums text-zinc-500"
    >
      {hasValue ? value : '–'}
    </span>
  );
}
