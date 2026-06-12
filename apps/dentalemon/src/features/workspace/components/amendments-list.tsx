/**
 * AmendmentsList — read-only list of amendments (corrections) recorded against a
 * completed/locked visit's records.
 *
 * FIX-007 / FR1.16 ("original + correction both visible"): amendments were
 * write-only — `listAmendments` had zero consumers, so a correction, once filed,
 * was invisible in the product. This surfaces them alongside the original record
 * in the read-only review area (the tooth slideout footer), closing the
 * write→read loop next to where "Add Amendment" lives.
 *
 * Data: the generated `listAmendments` SDK fn → GET /dental/visits/{visitId}/amendments,
 * which returns the offset envelope `{ data: Amendment[], pagination }` (§15 list-shape
 * trap — unwrap `data.data`, NOT a bare array / `{items}`). Direct-SDK + local state,
 * matching amendment-form.tsx (the write side).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { listAmendments, type Amendment } from '@monobase/sdk-ts/generated';
import { APP_LOCALE } from '@/constants/brand';

/** Human labels for the polymorphic `originalRecordType` so a reader can identify
 *  which record a correction amends without knowing the internal type strings. */
const RECORD_TYPE_LABELS: Record<string, string> = {
  tooth_treatment: 'Tooth treatment',
  treatment: 'Treatment',
  prescription: 'Prescription',
  consent: 'Consent form',
  consentForm: 'Consent form',
  labOrder: 'Lab order',
  medicalHistory: 'Medical history',
  note: 'Note',
};
function recordTypeLabel(type: string): string {
  return RECORD_TYPE_LABELS[type] ?? type;
}

/** Reason values mirror amendment-form.tsx's AMENDMENT_REASONS. */
const REASON_LABELS: Record<string, string> = {
  correction: 'Correction',
  additional_finding: 'Additional Finding',
  clarification: 'Clarification',
};
function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(APP_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface AmendmentsListProps {
  visitId: string;
  /** Bump to force a refetch (e.g. after a new amendment is saved in the same view). */
  reloadToken?: number;
}

export function AmendmentsList({ visitId, reloadToken = 0 }: AmendmentsListProps) {
  const [items, setItems] = useState<Amendment[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Guard against a late response from a previous visitId/reloadToken overwriting
    // newer state (stale-response race) — ignore is set in cleanup.
    let ignore = false;
    (async () => {
      setError(false);
      // throwOnError defaults to false: resolves with `{ error }` on network/non-2xx.
      const { data, error: apiError } = await listAmendments({ path: { visitId } });
      if (ignore) return;
      if (apiError || !data) {
        setError(true);
        setItems([]);
        return;
      }
      // §15 list-shape trap: unwrap the offset envelope.
      setItems(data.data ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [visitId, reloadToken]);

  // Deterministic display order: newest correction first. The list endpoint does not
  // order rows, so order here rather than rely on Postgres heap order.
  const ordered = useMemo(
    () =>
      items
        ? [...items].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
        : null,
    [items],
  );

  const loading = items === null && !error;

  return (
    <section
      data-testid="amendments-list"
      aria-label="Amendments"
      className="border-t bg-secondary/20 px-4 py-3 flex flex-col gap-2"
    >
      <h3 className="text-sm font-semibold">Amendments</h3>

      {loading && <p className="text-xs text-muted-foreground">Loading amendments…</p>}

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          Failed to load amendments. Please try again.
        </p>
      )}

      {!loading && !error && ordered!.length === 0 && (
        <p className="text-xs text-muted-foreground">No amendments recorded for this visit.</p>
      )}

      {!error && ordered && ordered.length > 0 && (
        <ul className="flex flex-col gap-2">
          {ordered.map((a) => (
            <li
              key={a.id}
              data-testid="amendment-row"
              className="rounded-lg border border-border bg-background px-3 py-2 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  {reasonLabel(a.reason)}
                  <span className="font-normal text-muted-foreground">
                    {' · '}
                    {recordTypeLabel(a.originalRecordType)}
                  </span>
                </span>
                <time className="text-[10px] text-muted-foreground shrink-0">
                  {formatDate(a.createdAt)}
                </time>
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap">{a.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
