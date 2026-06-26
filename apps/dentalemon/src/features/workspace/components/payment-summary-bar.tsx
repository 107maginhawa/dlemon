/**
 * PaymentSummaryBar — the workspace footer summary + payment CTA.
 *
 * Extracted from the route so its cross-element coherence is independently
 * testable. The figures it shows MUST describe the billable set — every
 * treatment in the visit — because that is exactly what WorkspacePaymentModal
 * renders as line items and bills. `pendingCount` (diagnosed|planned) is shown as
 * informational context only; it never drives the total or the button count, or
 * the footer would read "Continue to Payment (0)" / "No pending treatments" on an
 * all-performed visit that still bills ₱X.
 */
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import type { Treatment } from '../hooks/use-treatments';

interface PaymentSummaryBarProps {
  treatments: Treatment[];
  isReadOnly: boolean;
  onContinue: () => void;
  /** Issue 2: jump the dentist to the pending treatments (scrolls/focuses the
   *  Treatment Breakdown). Optional — when absent the count is plain text. */
  onReviewPending?: () => void;
}

export function PaymentSummaryBar({ treatments, isReadOnly, onContinue, onReviewPending }: PaymentSummaryBarProps) {
  // Billable set == exactly what WorkspacePaymentModal receives as lineItems.
  const billableCount = treatments.length;
  const pendingCount = treatments.filter(
    (t) => t.status === 'diagnosed' || t.status === 'planned',
  ).length;
  const totalAmount = treatments.reduce((sum, t) => sum + (t.priceAmount ?? 0), 0);

  // Issue 2: name WHAT is pending, and when there's anything pending make it a
  // clickable affordance that routes to the Treatment Breakdown.
  const pendingLabel = `${pendingCount} treatment${pendingCount === 1 ? '' : 's'} pending`;

  return (
    <footer className="flex h-14 shrink-0 items-center justify-between border-t px-4 backdrop-blur-xl bg-white/70 supports-[backdrop-filter]:bg-white/70">
      <span className="text-sm text-muted-foreground" data-testid="treatment-summary">
        {billableCount === 0 ? (
          'No treatments yet'
        ) : (
          <>
            {pendingCount > 0 && onReviewPending ? (
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
              pendingLabel
            )}{' · '}
            <span className="font-semibold text-foreground" data-testid="treatment-total">
              {CURRENCY_SYMBOL}
              {totalAmount.toLocaleString(APP_LOCALE)} total
            </span>
          </>
        )}
      </span>

      {/* PAY-01/PAY-02: open payment modal inline */}
      <button
        type="button"
        disabled={billableCount === 0 && !isReadOnly}
        onClick={onContinue}
        className="rounded-lg bg-lemon px-5 py-2 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover min-h-[44px] disabled:opacity-50"
        data-testid="continue-to-payment-btn"
      >
        {isReadOnly ? 'View Invoice' : `Continue to Payment (${billableCount})`}
      </button>
    </footer>
  );
}
