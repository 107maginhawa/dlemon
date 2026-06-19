/**
 * Payment-terms resolution (BR-048).
 *
 * Pure, side-effect-free. At issue, an invoice's dueDate derives from payment
 * terms (in days) with this precedence:
 *   1. invoice override (per-invoice paymentTermsDays, set at create)
 *   2. the MAX of the line-item service terms (per-procedure paymentTermsDays)
 *   3. the clinic/branch default (branch settings defaultPaymentTermsDays)
 *   4. 0 (due on receipt)
 * The resolved value is bounded to [0, 365] days. Net-0 = due on receipt.
 */

const MAX_TERMS_DAYS = 365;

function clampDays(n: number): number {
  return Math.min(MAX_TERMS_DAYS, Math.max(0, Math.floor(n)));
}

export interface PaymentTermsInput {
  /** Per-invoice override. `0` is a real value (due on receipt), so only
   *  null/undefined count as "no override". */
  invoiceOverrideDays?: number | null;
  /** Per-procedure terms from the invoice's line items; nulls are ignored. */
  serviceTermsDays?: Array<number | null | undefined>;
  /** Clinic/branch default (branch settings). */
  clinicDefaultDays?: number | null;
}

export function resolvePaymentTermsDays(input: PaymentTermsInput): number {
  if (input.invoiceOverrideDays != null) return clampDays(input.invoiceOverrideDays);

  const services = (input.serviceTermsDays ?? []).filter((d): d is number => d != null);
  if (services.length > 0) return clampDays(Math.max(...services));

  if (input.clinicDefaultDays != null) return clampDays(input.clinicDefaultDays);

  return 0;
}

/** dueDate = issuedAt + resolvedDays (whole days). */
export function dueDateFromTerms(issuedAt: Date, termsDays: number): Date {
  const due = new Date(issuedAt);
  due.setUTCDate(due.getUTCDate() + clampDays(termsDays));
  return due;
}
