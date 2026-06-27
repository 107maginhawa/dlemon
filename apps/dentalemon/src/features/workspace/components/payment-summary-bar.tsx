/**
 * PaymentSummaryBar — the workspace footer summary + payment CTA.
 *
 * Extracted from the route so its cross-element coherence is independently
 * testable. The figures it shows describe the BILLABLE set — only `performed`/
 * `verified` treatments — because that is exactly what the server mints into an
 * invoice (createDentalInvoice.ts:79). Showing the all-status total here was the
 * bug (billing-audit-2026-06-27 G1/G2/G7): it advertised a payable ₱X + an
 * enabled "Continue to Payment (N)" that the server 422s on. `pendingCount`
 * (diagnosed|planned) is informational context only — never a payable total.
 */
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { isBillableTreatment, type Treatment } from '../hooks/use-treatments';

interface PaymentSummaryBarProps {
  treatments: Treatment[];
  isReadOnly: boolean;
  onContinue: () => void;
  /** Issue 2: jump the dentist to the pending treatments (scrolls/focuses the
   *  Treatment Breakdown). Optional — when absent the count is plain text. */
  onReviewPending?: () => void;
}

export function PaymentSummaryBar({ treatments, isReadOnly, onContinue, onReviewPending }: PaymentSummaryBarProps) {
  // Billable set == the server's invoice gate (performed|verified) == exactly
  // what WorkspacePaymentModal will bill. Anything else is context, not money.
  const billable = treatments.filter((t) => isBillableTreatment(t.status));
  const billableCount = billable.length;
  const pendingCount = treatments.filter(
    (t) => t.status === 'diagnosed' || t.status === 'planned',
  ).length;
  const totalAmount = billable.reduce((sum, t) => sum + (t.priceAmount ?? 0), 0);

  // Estimate = active planned work (diagnosed|planned). Non-payable, but a
  // first-class object the dentist can review/present (Square/Stripe). When
  // nothing is billable yet, the CTA opens this estimate instead of dead-ending.
  const estimateAmount = treatments
    .filter((t) => t.status === 'diagnosed' || t.status === 'planned')
    .reduce((sum, t) => sum + (t.priceAmount ?? 0), 0);
  const hasEstimate = estimateAmount > 0;
  const estimateOnly = billableCount === 0 && hasEstimate;

  // Issue 2: name WHAT is pending, and when there's anything pending make it a
  // clickable affordance that routes to the Treatment Breakdown.
  const pendingLabel = `${pendingCount} treatment${pendingCount === 1 ? '' : 's'} pending`;
  const pendingNode =
    pendingCount > 0 && onReviewPending ? (
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
    );

  return (
    <footer className="flex h-14 shrink-0 items-center justify-between border-t px-4 backdrop-blur-xl bg-white/70 supports-[backdrop-filter]:bg-white/70">
      <span className="text-sm text-muted-foreground" data-testid="treatment-summary">
        {treatments.length === 0 ? (
          'No treatments yet'
        ) : billableCount === 0 ? (
          // Nothing billable yet: show the (non-payable) estimate total + WHY,
          // never a payable "billable" total. Used to 422 on click; now reviewable.
          <>
            {pendingNode}
            {' · '}
            <span className="font-semibold text-foreground" data-testid="estimate-amount">
              {CURRENCY_SYMBOL}
              {estimateAmount.toLocaleString(APP_LOCALE)} estimate
            </span>
          </>
        ) : (
          <>
            {pendingCount > 0 && (
              <>
                {pendingNode}
                {' · '}
              </>
            )}
            <span className="font-semibold text-foreground" data-testid="treatment-total">
              {CURRENCY_SYMBOL}
              {totalAmount.toLocaleString(APP_LOCALE)} billable
            </span>
          </>
        )}
      </span>

      {/* PAY-01/PAY-02: open payment modal inline */}
      <button
        type="button"
        disabled={billableCount === 0 && !hasEstimate && !isReadOnly}
        onClick={onContinue}
        className="rounded-lg bg-lemon px-5 py-2 text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover min-h-[44px] disabled:opacity-50"
        data-testid="continue-to-payment-btn"
      >
        {isReadOnly
          ? 'View Invoice'
          : estimateOnly
            ? 'Review Estimate'
            : `Continue to Payment (${billableCount})`}
      </button>
    </footer>
  );
}
