/**
 * AcceptedPlanViewer — read-only signed-acceptance record (case-presentation FIX-002,
 * GAP-1; also closes dental-visit GAP-3).
 *
 * The e-sign acceptance was write-only: after the moment of signing, the legal artifact
 * (who accepted, when, and the immutable itemized plan they accepted) was invisible.
 * This viewer surfaces it read-only from the case-presentation aggregate — no backend,
 * no SDK regen, strictly read-only. The interactive sign/accept/reject affordances live
 * in CasePresentationView (pre-decision); this is the post-decision read-back.
 */
import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { formatCents } from '@/lib/format-currency';
import { APP_LOCALE } from '@/constants/brand';
import type { CasePresentationAggregate } from './use-case-presentation';

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(APP_LOCALE, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function AcceptedPlanViewer({ aggregate }: { aggregate: CasePresentationAggregate }) {
  const { presentation, phases, grandTotalCents } = aggregate;
  const decided = presentation.decision !== null;
  const accepted = presentation.decision === 'accepted';

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4" data-testid="accepted-plan-viewer">
      {!decided ? (
        <div
          data-testid="accepted-plan-undecided"
          className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground"
        >
          This treatment plan has not been decided yet — no signed acceptance to show.
        </div>
      ) : (
        <div
          data-testid="accepted-plan-record"
          className={`flex flex-col gap-1 rounded-xl border p-4 ${
            accepted ? 'border-success/30 bg-success/15' : 'border-destructive/30 bg-destructive/15'
          }`}
        >
          <div className="flex items-center gap-2">
            {accepted ? (
              <CheckCircle2 className="h-5 w-5 text-success-foreground" />
            ) : (
              <X className="h-5 w-5 text-destructive-emphasis" />
            )}
            <span className={`text-sm font-semibold ${accepted ? 'text-success-foreground' : 'text-destructive-emphasis'}`}>
              {accepted ? 'Signed acceptance' : 'Plan declined'}
            </span>
          </div>
          {accepted ? (
            <p className="text-sm text-success-foreground">
              Accepted by{' '}
              <span data-testid="signer-name" className="font-medium">
                {presentation.signerName ?? '—'}
              </span>{' '}
              on{' '}
              <span data-testid="decision-timestamp" className="font-medium">
                {fmtDateTime(presentation.decisionAt)}
              </span>
              .
            </p>
          ) : (
            <p className="text-sm text-destructive-emphasis">
              Declined on{' '}
              <span data-testid="decision-timestamp" className="font-medium">
                {fmtDateTime(presentation.decisionAt)}
              </span>
              {presentation.rejectionReason ? <> — {presentation.rejectionReason}</> : null}.
            </p>
          )}
        </div>
      )}

      {/* The immutable itemized plan that was presented and decided. */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Treatment plan
        </h3>
        {phases.map((phase) => (
          <div key={phase.phase ?? 'other'} data-testid={`phase-${phase.phase ?? 'other'}`}>
            <div className="flex items-center justify-between border-b border-border pb-1">
              <span className="text-sm font-medium capitalize">
                {(phase.phase ?? 'Other').replace(/_/g, ' ')}
              </span>
              <span className="text-sm font-semibold">{formatCents(phase.subtotalCents)}</span>
            </div>
            <ul className="mt-1 flex flex-col gap-1">
              {phase.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.toothNumber != null ? `#${item.toothNumber} · ` : ''}
                    {item.description}
                  </span>
                  <span className="tabular-nums">{formatCents(item.priceCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-base font-bold" data-testid="grand-total">
            {formatCents(grandTotalCents)}
          </span>
        </div>
      </section>
    </div>
  );
}
