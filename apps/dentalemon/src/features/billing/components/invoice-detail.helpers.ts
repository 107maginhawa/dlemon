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

export function formatCents(cents: number): string {
  const pesos = cents / 100;
  return `₱${pesos.toFixed(2)}`;
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-500';
    case 'issued':
      return 'bg-blue-100 text-blue-700';
    case 'partial':
      return 'bg-orange-100 text-orange-700';
    case 'paid':
      return 'bg-green-100 text-green-700';
    case 'overdue':
      return 'bg-red-100 text-red-700';
    case 'voided':
      return 'bg-gray-100 text-gray-400 line-through';
    default:
      return 'bg-gray-100 text-gray-500';
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
  };
  return map[status] ?? status;
}

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer'] as const;
export const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};
