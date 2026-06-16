/**
 * CasePresentationView — P1-20 patient-facing case-presentation read surface (Phase 1).
 *
 * Presentational + props-driven (testable without network): phased ₱ breakdown with
 * per-phase + grand totals, P1-19 alternates with the clinician-Recommended option
 * badged, annotated-imaging refs, and accept (e-sign) / reject (reason popover) CTAs.
 * ₱-native via formatCents; no insurance estimation. Lemon (#FFE97D) accent.
 */
import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover';
import { Image as ImageIcon, Star } from 'lucide-react';
import { formatCents } from '@/lib/format-currency';
import { SignaturePad } from './signature-pad';
import type { CasePresentationAggregate } from './use-case-presentation';

const PHASE_LABELS: Record<string, string> = {
  systemic: 'Urgent / Systemic',
  disease_control: 'Disease Control',
  re_evaluation: 'Re-evaluation',
  definitive: 'Definitive Care',
  maintenance: 'Maintenance',
};

function phaseLabel(phase: string | null): string {
  if (!phase) return 'Other';
  return PHASE_LABELS[phase] ?? phase;
}

interface CasePresentationViewProps {
  aggregate: CasePresentationAggregate;
  isAccepting: boolean;
  isRejecting: boolean;
  onAccept: (input: { signerName: string; signatureData: string }) => void;
  onReject: (input: { rejectionReason?: string }) => void;
}

export function CasePresentationView({
  aggregate,
  isAccepting,
  isRejecting,
  onAccept,
  onReject,
}: CasePresentationViewProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const decided = aggregate.presentation.decision !== null;
  const accepted = aggregate.presentation.decision === 'accepted';

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4" data-testid="case-presentation-view">
      <header>
        <h1 className="text-lg font-semibold">
          {aggregate.patientFirstName}, here is your treatment plan
        </h1>
        <p className="text-sm text-muted-foreground">
          Review the proposed care below, then accept or decline.
        </p>
      </header>

      {/* Phased ₱ breakdown */}
      <section className="flex flex-col gap-3">
        {aggregate.phases.map((phase) => (
          <div
            key={phase.phase ?? 'other'}
            className="rounded-xl border border-border bg-background p-3"
            data-testid={`phase-${phase.phase ?? 'other'}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{phaseLabel(phase.phase)}</h2>
              <span className="text-sm font-semibold">{formatCents(phase.subtotalCents)}</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {phase.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    {item.toothNumber != null && (
                      <span className="mr-1 font-medium">#{item.toothNumber}</span>
                    )}
                    {item.description}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatCents(item.priceCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Grand total */}
      <div className="flex items-center justify-between rounded-xl bg-lemon/40 px-4 py-3">
        <span className="text-sm font-semibold">Estimated total</span>
        <span className="text-base font-bold" data-testid="grand-total">
          {formatCents(aggregate.grandTotalCents)}
        </span>
      </div>

      {/* Alternate-case option groups (P1-19) */}
      {aggregate.optionGroups.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Treatment options</h2>
          {aggregate.optionGroups.map((group) => (
            <div
              key={group.optionGroupId}
              className="rounded-xl border border-border bg-background p-3"
              data-testid={`option-group-${group.optionGroupId}`}
            >
              <ul className="flex flex-col gap-2">
                {group.options.map((opt) => (
                  <li key={opt.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      {opt.description}
                      {opt.recommended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-lemon px-2 py-0.5 text-[10px] font-semibold text-foreground">
                          <Star className="h-3 w-3" /> Recommended
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground">{formatCents(opt.priceCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Annotated imaging refs */}
      {aggregate.images.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Your images</h2>
          <div className="flex flex-wrap gap-2">
            {aggregate.images.map((img) => (
              <div
                key={img.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs"
              >
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{img.imageType.replace(/_/g, ' ')}</span>
                {img.toothNumber != null && <span className="font-medium">#{img.toothNumber}</span>}
                {img.findingCount > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
                    {img.findingCount} finding{img.findingCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Decision */}
      {decided ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            accepted ? 'bg-success/15 text-success-foreground' : 'bg-destructive/15 text-destructive-emphasis'
          }`}
          data-testid="decision-banner"
        >
          {accepted ? 'You have accepted this treatment plan.' : 'You have declined this treatment plan.'}
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <SignaturePad isSubmitting={isAccepting} submitted={decided} onAccept={onAccept} />
          <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="reject-btn"
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Decline this plan
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              className="z-50 w-72 rounded-xl border border-border bg-background p-4 shadow-lg"
            >
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reason (optional)
              </label>
              <textarea
                aria-label="Rejection reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Want to think it over"
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                data-testid="reject-confirm-btn"
                disabled={isRejecting}
                onClick={() => {
                  onReject({ rejectionReason: reason.trim() || undefined });
                  setRejectOpen(false);
                }}
                className="mt-2 w-full rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
              >
                Confirm decline
              </button>
            </PopoverContent>
          </Popover>
        </section>
      )}
    </div>
  );
}
