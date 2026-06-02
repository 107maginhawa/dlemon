/**
 * CasePresentationPanel — container that wires useCasePresentation to the view.
 *
 * P1-20 Phase 1: staff opens this on the operatory iPad (existing bearerAuth session)
 * and hands the patient the device to accept (e-sign) or decline. No public
 * tokenized access in this pass.
 */
import React from 'react';
import { useCasePresentation } from './use-case-presentation';
import { CasePresentationView } from './case-presentation-view';

interface CasePresentationPanelProps {
  patientId: string;
  presentationId: string;
}

export function CasePresentationPanel({ patientId, presentationId }: CasePresentationPanelProps) {
  const { aggregate, isLoading, isError, accept, isAccepting, reject, isRejecting } =
    useCasePresentation(patientId, presentationId);

  if (isLoading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Loading your plan…</p>;
  }
  if (isError || !aggregate) {
    return (
      <p className="p-8 text-center text-sm text-destructive">
        Couldn’t load this treatment plan. Please ask the front desk.
      </p>
    );
  }

  return (
    <CasePresentationView
      aggregate={aggregate}
      isAccepting={isAccepting}
      isRejecting={isRejecting}
      onAccept={(input) => { void accept(input); }}
      onReject={(input) => { void reject(input); }}
    />
  );
}
