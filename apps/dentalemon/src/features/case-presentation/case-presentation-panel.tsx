/**
 * CasePresentationPanel — container that wires useCasePresentation to the view.
 *
 * P1-20 Phase 1: staff opens this on the operatory iPad (existing bearerAuth session)
 * and hands the patient the device to accept (e-sign) or decline. No public
 * tokenized access in this pass.
 */
import React from 'react';
import { Skeleton } from '@monobase/ui';
import { useCasePresentation } from './use-case-presentation';
import { CasePresentationView } from './case-presentation-view';
import { AcceptedPlanViewer } from './accepted-plan-viewer';

interface CasePresentationPanelProps {
  patientId: string;
  presentationId: string;
}

export function CasePresentationPanel({ patientId, presentationId }: CasePresentationPanelProps) {
  const { aggregate, isLoading, isError, accept, isAccepting, acceptError, reject, isRejecting, rejectError } =
    useCasePresentation(patientId, presentationId);

  if (isLoading) {
    // Hold the plan view's footprint: a title/header block, then stacked plan-item
    // blocks, so the content doesn't pop in and shift the layout (reduce CLS).
    return (
      <div data-testid="case-presentation-loading" className="p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  if (isError || !aggregate) {
    return (
      <p className="p-8 text-center text-sm text-destructive">
        Couldn’t load this treatment plan. Please ask the front desk.
      </p>
    );
  }

  // FIX-002: once the patient has decided, the presentation is a signed legal record —
  // show the read-only signed-acceptance viewer (who signed, when, the itemized plan)
  // instead of the interactive sign controls. This is the read-back entry point that
  // makes the previously-write-only artifact visible whenever the presentation is opened.
  if (aggregate.presentation.decision !== null) {
    return <AcceptedPlanViewer aggregate={aggregate} />;
  }

  return (
    <CasePresentationView
      aggregate={aggregate}
      isAccepting={isAccepting}
      isRejecting={isRejecting}
      acceptError={acceptError}
      rejectError={rejectError}
      // .catch swallows the rejection at the call site (the error is surfaced to the
      // patient via accept/rejectError below) so it doesn't become an unhandled
      // promise rejection.
      onAccept={(input) => { accept(input).catch(() => {}); }}
      onReject={(input) => { reject(input).catch(() => {}); }}
    />
  );
}
