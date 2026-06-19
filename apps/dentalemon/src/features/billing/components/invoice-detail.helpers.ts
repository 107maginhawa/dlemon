export interface LineItem {
  id: string;
  description: string;
  cdtCode?: string;
  toothNumber?: number;
  surface?: string;
  priceCents: number;
  status?: string;
}

export interface Payment {
  id: string;
  amountCents: number;
  method: string;
  receiptNumber: string;
  recordedByMemberId?: string;
  recordedByName?: string;
  createdAt: string;
  // FIX-004: void is a soft-delete — a voided payment stays in the list as a
  // reversal row (isVoid=true) with its reason preserved, never removed.
  isVoid?: boolean;
  voidedAt?: string;
  voidReason?: string;
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  status: string;
  patientId: string;
  patientName?: string;
  visitDate?: string;
  issueDate?: string;
  dueDate?: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  lineItems: LineItem[];
  payments: Payment[];
}

export function canIssue(status: string): boolean {
  return status === 'draft';
}

export function canVoid(status: string): boolean {
  return status === 'issued' || status === 'partial' || status === 'overdue';
}

export function canRecord(status: string): boolean {
  return status === 'issued' || status === 'partial' || status === 'overdue';
}

// BR-013: write off an outstanding invoice. Same source statuses as void; the
// backend enforces the transition and owner-only role.
export function canMarkUncollectible(status: string): boolean {
  return status === 'issued' || status === 'partial' || status === 'overdue';
}

// ---------------------------------------------------------------------------
// Action-button visibility (status x role). J-RBAC-001: issue/void are billing
// WRITE lifecycle operations gated by role (`canWrite`); recording a payment is
// always allowed when status permits, so staff_full / billing_staff can record
// payments without seeing issue/void.
// ---------------------------------------------------------------------------

export function showIssueButton(status: string, canWrite: boolean): boolean {
  return canWrite && canIssue(status);
}

export function showVoidButton(status: string, canWrite: boolean): boolean {
  return canWrite && canVoid(status);
}

export function showRecordButton(status: string): boolean {
  return canRecord(status);
}

export function showMarkUncollectibleButton(status: string, canWrite: boolean): boolean {
  return canWrite && canMarkUncollectible(status);
}

// FIX-003: applying a discount is an OWNER-ONLY money write-down (backend
// assertBranchRole(['dentist_owner'])). Offered on the same live-billable set as
// void/record (issued/partial/overdue); the backend also blocks paid/voided.
export function showDiscountButton(status: string, isOwner: boolean): boolean {
  return isOwner && (status === 'issued' || status === 'partial' || status === 'overdue');
}

// FIX-004: an owner may void a single recorded payment that is not already
// voided. The whole-invoice void (footer) is a separate, broader action.
export function canVoidPaymentRow(isOwner: boolean, payment: { isVoid?: boolean }): boolean {
  return isOwner && !payment.isVoid;
}

// FIX-005: offer "Create Payment Plan" on a live, billable invoice with an
// outstanding balance. Gated by canWrite (owner||associate) per the backend create
// gate; the backend additionally rejects voided/zero-balance/existing-plan.
export function showCreatePlanButton(status: string, canWrite: boolean, balanceCents: number): boolean {
  return canWrite && balanceCents > 0 && (status === 'issued' || status === 'partial' || status === 'overdue');
}

// FIX-003: mirror the backend discount gates client-side. percentageRate is a
// 0–100 PERCENTAGE (not cents, not a 0–1 fraction); a meaningful discount is
// >0 and ≤100. reason is required (the backend 422s DISCOUNT_REASON_REQUIRED on
// an empty/whitespace reason).
export function validateDiscountForm(form: { percentageRate: number; reason: string }): string[] {
  const errors: string[] = [];
  if (!form.reason.trim()) errors.push('Discount reason is required');
  if (!Number.isFinite(form.percentageRate) || form.percentageRate <= 0 || form.percentageRate > 100) {
    errors.push('Discount must be greater than 0 and at most 100 percent');
  }
  return errors;
}

export function validatePaymentForm(form: {
  amountCents: number;
  method: string;
  receiptNumber: string;
}): string[] {
  const errors: string[] = [];
  if (!form.amountCents || form.amountCents <= 0) errors.push('Amount must be greater than zero');
  if (!form.method.trim()) errors.push('Payment method is required');
  if (!form.receiptNumber.trim()) errors.push('Receipt number is required');
  return errors;
}

export function buildPaymentPayload(form: {
  amountCents: number;
  method: string;
  receiptNumber: string;
  recordedByMemberId: string;
}) {
  return {
    amountCents: form.amountCents,
    method: form.method.trim(),
    receiptNumber: form.receiptNumber.trim(),
    recordedByMemberId: form.recordedByMemberId.trim(),
  };
}

export function calcChangeAmount(tenderedCents: number, totalCents: number): number {
  return Math.max(0, tenderedCents - totalCents);
}

// Grouped ₱ / en-PH formatting via the shared single-source formatter.
export { formatCents } from '@/lib/format-currency';

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-muted text-muted-foreground';
    case 'issued':
      return 'bg-info/15 text-info-foreground';
    case 'partial':
      return 'bg-warning/15 text-warning-foreground';
    case 'paid':
      return 'bg-success/15 text-success-foreground';
    case 'overdue':
      return 'bg-destructive/15 text-destructive-emphasis';
    case 'voided':
      return 'bg-muted text-muted-foreground line-through';
    case 'uncollectible':
      return 'bg-muted text-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    issued: 'Issued',
    partial: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
    voided: 'Voided',
    uncollectible: 'Written Off',
  };
  return map[status] ?? status;
}

/**
 * Format an invoice date string for display. The SDK serializes `dueDate` as a
 * full ISO timestamp (`2026-06-19T16:05:51.990Z`) while `visitDate` is a
 * calendar date (`2026-06-19`); both were rendered raw, leaking the timestamp
 * to the UI (QA ISSUE-009). Date-only strings are parsed as local midnight to
 * avoid the UTC-midnight timezone shift that would display the previous day.
 * Falls back to the raw value if unparseable (never worse than before).
 */
export function formatInvoiceDate(value: string | undefined): string {
  if (!value) return '';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = dateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer'] as const;
export const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};
