/**
 * Pure helpers for the P1-26 insurance / revenue-cycle surfaces.
 *
 * Side-effect-free so they unit-test without a DOM or network. Money is integer
 * centavos; display uses ₱ / en-PH (matches collections-view.helpers).
 */

export type InsuranceClaimStatus =
  | 'draft'
  | 'ready'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'partially_paid'
  | 'paid'
  | 'denied'
  | 'appealed'
  | 'written_off';

export interface InsuranceClaimRow {
  id: string;
  claimNumber: string;
  patientId: string;
  insuranceProfileId: string;
  status: InsuranceClaimStatus;
  billedAmountCents: number;
  paidByPayerCents: number;
  disallowedCents: number | null;
  patientPortionCents: number;
  payerReference: string | null;
  submittedAt: string | null;
}

export interface PayerArRow {
  insuranceProfileId: string;
  payerName: string;
  currentCents: number;
  days30Cents: number;
  days60Cents: number;
  days90PlusCents: number;
  totalOutstandingCents: number;
  claimCount: number;
  oldestClaimDays: number;
}

export interface PayerArSummary {
  currentCents: number;
  days30Cents: number;
  days60Cents: number;
  days90PlusCents: number;
  totalOutstandingCents: number;
  payerCount: number;
  claimCount: number;
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
