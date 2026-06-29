/**
 * PaymentSummaryBar — the workspace footer summary + payment CTA.
 *
 * Coherence rule (PRODUCT.md design principle #4): every number here must be one the
 * clinician can trust. The server bills ONLY performed|verified treatments (BR-009),
 * so the PAYABLE total + the "Continue to Payment (N)" count are the BILLABLE subset
 * — never "every treatment in the visit". An all-planned visit has nothing to bill:
 * it shows an ESTIMATE and a "View Estimate" entry point, never a "Continue to
 * Payment" that 422s on click. Billable/estimate come from the shared `splitBillable`
 * SoT so this footer and the payment modal can never drift.
 */
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { splitBillable } from '../lib/billable';
import type { Treatment } from '../hooks/use-treatments';

interface PaymentSummaryBarProps {
  treatments: Treatment[];
  isReadOnly: boolean;
  onContinue: () => void;
  /** Issue 2: jump the dentist to the pending treatments (scrolls/focuses the
   *  Treatment Breakdown). Optional — when absent the count is plain text. */
  onReviewPending?: () => void;
}

function money(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString(APP_LOCALE)}`;
}

export function PaymentSummaryBar({ treatments, isReadOnly, onContinue, onReviewPending }: PaymentSummaryBarProps) {
  const { billable, estimate } = splitBillable(treatments);
  const billableTotal = billable.reduce((sum, t) => sum + (t.priceAmount ?? 0), 0);
  const estimateTotal = estimate.reduce((sum, t) => sum + (t.priceAmount ?? 0), 0);
  const hasWork = billable.length > 0 || estimate.length > 0;

  // Issue 2: name WHAT is pending and route to it.
  const pendingLabel = `${estimate.length} treatment${estimate.length === 1 ? '' : 's'} pending`;
  const reviewPending =
    estimate.length > 0 && onReviewPending ? (
      <button
        type="button"
        data-testid="review-pending-btn"
        onClick={onReviewPending}
        title="Review pending treatments"
        className="rounded px-1 -mx-1 font-medium text-foreground underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {pendingLabel}
      </button>
    ) : (
      <span className="font-medium text-foreground">{pendingLabel}</span>
    );

  // Footer figures depend on what's payable RIGHT NOW.
  const summary = !hasWork ? (
    'No treatments yet'
  ) : billable.length > 0 ? (
    // Something is billable → show the PAYABLE total (performed subset).
    <>
      {estimate.length > 0 && <>{reviewPending}{' · '}</>}
      <span className="font-semibold text-foreground" data-testid="treatment-total">
        {money(billableTotal)} total
      </span>
    </>
  ) : (
    // All-planned → an estimate, clearly not payable yet.
    <>
      {reviewPending}{' · '}
      <span className="font-medium text-muted-foreground" data-testid="treatment-estimate-total">
        {money(estimateTotal)} estimate
      </span>
    </>
  );

  const ctaLabel = isReadOnly
    ? 'View Invoice'
    : billable.length > 0
      ? `Continue to Payment (${billable.length})`
      : estimate.length > 0
        ? 'View Estimate'
        : 'Continue to Payment (0)';

  return (
    <footer className="flex h-14 shrink-0 items-center justify-between border-t px-4 backdrop-blur-xl bg-white/70 supports-[backdrop-filter]:bg-white/70">
      <span className="text-sm text-muted-foreground" data-testid="treatment-summary">
        {summary}
      </span>

      {/* PAY-01/PAY-02: open payment modal inline */}
      <button
        type="button"
        disabled={!isReadOnly && !hasWork}
        onClick={onContinue}
        className="rounded-lg bg-lemon px-5 py-2 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover min-h-[44px] disabled:opacity-50"
        data-testid="continue-to-payment-btn"
      >
        {ctaLabel}
      </button>
    </footer>
  );
}
