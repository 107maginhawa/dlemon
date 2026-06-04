/**
 * Pure helpers for the P1-26 insurance / revenue-cycle surfaces.
 *
 * Side-effect-free so they unit-test without a DOM or network. Money is integer
 * centavos; display uses ₱ / en-PH (matches collections-view.helpers).
 */

import type {
  InsuranceClaim,
  InsuranceClaimStatus as SdkInsuranceClaimStatus,
  PayerArRow as SdkPayerArRow,
  PayerArSummary as SdkPayerArSummary,
} from '@monobase/sdk-ts/generated';

// Cause-fix (oli QA_ESCAPES §6): these were hand-rolled duplicates of generated
// SDK types. The enum + aging rows match the SDK 1:1, so alias them for a single
// source of truth that cannot drift from the backend contract.
export type InsuranceClaimStatus = SdkInsuranceClaimStatus;
export type PayerArRow = SdkPayerArRow;
export type PayerArSummary = SdkPayerArSummary;

// The worklist row IS the SDK InsuranceClaim, with one ground-truthed correction:
// listInsuranceClaims has NO response transformer (transformers.gen.ts), so its
// timestamps arrive as ISO strings at runtime even though the SDK over-types them
// as Date. Override the date fields to string so the type matches reality (the
// previous local type was actually more accurate than the SDK here — a stale-spec
// the GAP-D detector must catch by ground-truthing the live response, §6).
export type InsuranceClaimRow = Omit<
  InsuranceClaim,
  'submittedAt' | 'decisionAt' | 'paidAt' | 'createdAt' | 'updatedAt'
> & {
  submittedAt?: string | null;
  decisionAt?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

/** Re-type a raw SDK claim to the runtime-honest row (string timestamps). */
export function toInsuranceClaimRow(c: InsuranceClaim): InsuranceClaimRow {
  return {
    ...c,
    submittedAt: c.submittedAt == null ? null : String(c.submittedAt),
    decisionAt: c.decisionAt == null ? null : String(c.decisionAt),
    paidAt: c.paidAt == null ? null : String(c.paidAt),
    createdAt: c.createdAt == null ? undefined : String(c.createdAt),
    updatedAt: c.updatedAt == null ? undefined : String(c.updatedAt),
  };
}

/** Format integer centavos as a Philippine Peso string (en-PH). */
export function formatPeso(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const CLAIM_STATUS_LABELS: Record<InsuranceClaimStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  denied: 'Denied',
  appealed: 'Appealed',
  written_off: 'Written off',
};

/** Worklist filter choices: every status plus an "all" sentinel. */
export const CLAIM_STATUS_FILTERS: Array<{ value: InsuranceClaimStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  ...(Object.keys(CLAIM_STATUS_LABELS) as InsuranceClaimStatus[]).map((s) => ({
    value: s,
    label: CLAIM_STATUS_LABELS[s],
  })),
];

/** Allowed next statuses (FSM) — mirrors the backend INSURANCE_CLAIM_FSM. */
export const CLAIM_FSM: Record<InsuranceClaimStatus, InsuranceClaimStatus[]> = {
  draft: ['ready'],
  ready: ['submitted'],
  submitted: ['under_review', 'approved', 'denied'],
  under_review: ['approved', 'denied'],
  approved: ['partially_paid', 'paid', 'denied'],
  partially_paid: ['paid', 'denied'],
  paid: [],
  denied: ['appealed', 'written_off'],
  appealed: ['submitted', 'written_off'],
  written_off: [],
};

export function canSubmitClaim(status: InsuranceClaimStatus): boolean {
  return CLAIM_FSM[status].includes('submitted');
}

export function canRecordRemittance(status: InsuranceClaimStatus): boolean {
  // A payer remittance is meaningful once the claim has been decided.
  return status === 'approved' || status === 'partially_paid' || status === 'submitted' || status === 'under_review';
}

/** Visual accent class for a claim status badge. */
export function claimStatusClass(status: InsuranceClaimStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-800';
    case 'denied':
    case 'written_off':
      return 'bg-red-100 text-red-800';
    case 'approved':
    case 'partially_paid':
      return 'bg-blue-100 text-blue-800';
    case 'submitted':
    case 'under_review':
    case 'appealed':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-secondary text-muted-foreground';
  }
}

/**
 * Outstanding amount the payer still owes on a claim:
 * billed − payer-paid − disallowed (write-off), clamped at 0.
 */
export function claimOutstandingCents(row: Pick<InsuranceClaimRow, 'billedAmountCents' | 'paidByPayerCents' | 'disallowedCents'>): number {
  return Math.max(0, row.billedAmountCents - row.paidByPayerCents - (row.disallowedCents ?? 0));
}

/**
 * One-line "HMO covers ₱X · You pay ₱Y" split for the invoice insurance block.
 */
export function coverageSplitLabel(coveredCents: number, patientCents: number): string {
  return `HMO covers ${formatPeso(coveredCents)} · You pay ${formatPeso(patientCents)}`;
}
