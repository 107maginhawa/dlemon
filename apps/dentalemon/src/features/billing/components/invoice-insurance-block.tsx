/**
 * InvoiceInsuranceBlock — P1-26 "HMO covers ₱X / patient pays ₱Y" split.
 *
 * Rendered on an invoice only when the patient has insurance coverage in play
 * (an estimate or a linked claim). Hidden entirely for cash patients so the FFS
 * majority is never slowed (plan R3). ₱ / en-PH.
 */

import React from 'react';
import { formatPeso, coverageSplitLabel } from './insurance.helpers';

export interface InvoiceInsuranceBlockProps {
  /** Whether the patient has an active insurance profile. When false → hidden. */
  hasActiveProfile: boolean;
  estimatedCoveredCents: number;
  estimatedPatientPortionCents: number;
  /** Optional payer reference / claim number to show alongside the split. */
  claimNumber?: string | null;
}

export function InvoiceInsuranceBlock({
  hasActiveProfile,
  estimatedCoveredCents,
  estimatedPatientPortionCents,
  claimNumber,
}: InvoiceInsuranceBlockProps) {
  // Cash-patient guard: render nothing so the cash path is untouched.
  if (!hasActiveProfile) return null;

  return (
    <div className="bg-lemon/20 rounded-xl px-4 py-3 flex flex-col gap-1" data-testid="invoice-insurance-block">
      <span className="text-xs font-semibold tracking-wider uppercase text-lemon-foreground/70">
        Insurance estimate
      </span>
      <span className="text-[14px] font-semibold text-lemon-foreground" data-testid="coverage-split">
        {coverageSplitLabel(estimatedCoveredCents, estimatedPatientPortionCents)}
      </span>
      <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
        <span>HMO: <span className="tabular-nums">{formatPeso(estimatedCoveredCents)}</span></span>
        <span>Patient: <span className="tabular-nums font-medium text-foreground">{formatPeso(estimatedPatientPortionCents)}</span></span>
        {claimNumber ? <span data-testid="claim-ref">Claim {claimNumber}</span> : null}
      </div>
    </div>
  );
}
