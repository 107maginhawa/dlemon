/**
 * ChartConflictBanner — P0-A offline conflict visibility & resolution (FE).
 *
 * Surfaces chart writes the server rejected as stale offline edits (the only
 * data-integrity hole in the charting subsystem: the backend persisted them but
 * nothing could see or resolve them). For each open conflict a clinician can:
 *   - Accept: the offline edit becomes the truth (re-applied with a NEW clock).
 *   - Dismiss: keep the current value; discard the offline edit (reason required).
 *
 * The headline count is derived from the SAME source as the rendered rows
 * (chart-conflict.helpers) to avoid the "summary ≠ body" bug class.
 */
import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useChartConflicts } from '../hooks/use-chart-conflicts';

export interface ChartConflictBannerProps {
  patientId: string;
}

export function ChartConflictBanner({ patientId }: ChartConflictBannerProps) {
  const { conflicts, rejectedCount, resolve, isResolving } = useChartConflicts(patientId);
  const [dismissingVisitId, setDismissingVisitId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (conflicts.length === 0) return null;

  async function handleResolve(visitId: string, resolution: 'accept' | 'dismiss', why?: string) {
    await resolve(visitId, resolution, why);
    setDismissingVisitId(null);
    setReason('');
  }

  return (
    <div
      data-testid="chart-conflict-banner"
      role="alert"
      className="mx-4 my-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
        <span>
          <span data-testid="chart-conflict-count">{rejectedCount}</span> unsynced edit
          {rejectedCount === 1 ? '' : 's'} need review
        </span>
      </div>

      <ul className="mt-2 space-y-2">
        {conflicts.map((c) => {
          const isDismissing = dismissingVisitId === c.visitId;
          return (
            <li key={c.visitId} className="rounded border border-amber-200 bg-white/60 p-2">
              <p className="text-xs text-amber-800">
                Recorded offline, rejected as a stale edit:
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {(c.rejectedTeeth ?? []).map((t, i) => (
                  <li
                    key={`${c.visitId}-${t.toothNumber}-${i}`}
                    data-testid="conflict-tooth-row"
                    className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium"
                  >
                    #{t.toothNumber} {t.state}
                  </li>
                ))}
              </ul>

              {isDismissing ? (
                <div className="mt-2 space-y-1.5">
                  <textarea
                    data-testid={`conflict-reason-${c.visitId}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is the offline edit being discarded? (required, ≥5 chars)"
                    rows={2}
                    className="w-full rounded border border-amber-300 px-2 py-1 text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-testid={`conflict-dismiss-confirm-${c.visitId}`}
                      disabled={reason.trim().length < 5 || isResolving}
                      onClick={() => handleResolve(c.visitId, 'dismiss', reason.trim())}
                      className="rounded bg-amber-600 px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-50"
                    >
                      Confirm dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDismissingVisitId(null); setReason(''); }}
                      className="rounded border border-amber-300 px-2 py-0.5 text-[11px] font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    data-testid={`conflict-accept-${c.visitId}`}
                    disabled={isResolving}
                    onClick={() => handleResolve(c.visitId, 'accept')}
                    className="rounded bg-amber-600 px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-50"
                  >
                    Accept offline edit
                  </button>
                  <button
                    type="button"
                    data-testid={`conflict-dismiss-${c.visitId}`}
                    onClick={() => setDismissingVisitId(c.visitId)}
                    className="rounded border border-amber-300 px-2 py-0.5 text-[11px] font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
