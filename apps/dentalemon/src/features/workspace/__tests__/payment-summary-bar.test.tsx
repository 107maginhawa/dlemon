/**
 * PaymentSummaryBar — cross-element coherence guard for the workspace payment footer.
 *
 * Bug class (billing-audit-2026-06-27 G1/G2/G7): the footer count/total were summed
 * over EVERY treatment status, while the server bills ONLY `performed`/`verified`
 * (createDentalInvoice.ts:79). So an all-pending visit advertised a payable "₱X total"
 * + an enabled "Continue to Payment (N)" that the server rejects with a 422
 * (NO_BILLABLE_TREATMENTS) only after the click — a summary-vs-gate contradiction.
 *
 * Honest invariant (now): the footer figures describe the BILLABLE set
 * (`performed`/`verified` only) — exactly what the server will mint into an invoice.
 * Non-billable (diagnosed/planned) treatments are surfaced as informational context,
 * never as a payable total, and never enable the Pay button.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { parseMoney, assertTotalExplainedByRows, assertCountMatchesItems } from '@/test-utils';
import { PaymentSummaryBar } from '../components/payment-summary-bar';
import type { Treatment } from '../hooks/use-treatments';

afterEach(cleanup);

let _id = 0;
function tx(status: string, priceAmount: number): Treatment {
  _id += 1;
  return {
    id: `t-${_id}`,
    status,
    priceAmount,
    description: `Treatment ${_id}`,
    cdtCode: 'D0000',
    toothNumber: null,
  } as unknown as Treatment;
}

/** The integer inside "Continue to Payment (N)". */
function buttonCount(): number {
  const label = screen.getByTestId('continue-to-payment-btn').textContent ?? '';
  const m = label.match(/\((\d+)\)/);
  return m ? Number(m[1]) : NaN;
}

describe('PaymentSummaryBar — footer figures match the billable (performed|verified) set', () => {
  test('all-pending visit: no payable total, but an actionable "Review Estimate" (not a dead-end)', () => {
    const treatments = [tx('diagnosed', 1000), tx('planned', 4500)];
    render(<PaymentSummaryBar treatments={treatments} isReadOnly={false} onContinue={() => {}} />);

    // No payable "billable" total is advertised when nothing is billable…
    expect(screen.queryByTestId('treatment-total')).toBeNull();
    // …but the estimate is surfaced and the button is an enabled, non-payable
    // "Review Estimate" (Square/Stripe: estimates are viewable, never dead-ends).
    expect(screen.getByTestId('estimate-amount').textContent ?? '').toMatch(/5,500|5500/);
    const btn = screen.getByTestId('continue-to-payment-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent ?? '').toMatch(/review estimate/i);
    // It is NOT labelled as a payable "Continue to Payment (N)".
    expect(btn.textContent ?? '').not.toMatch(/continue to payment \(/i);
  });

  test('mixed visit: count + total are the BILLABLE subset, not every treatment', () => {
    // 2 pending + 1 performed → only the performed row (₱2,000) is billable.
    const treatments = [tx('diagnosed', 1000), tx('planned', 4500), tx('performed', 2000)];
    render(<PaymentSummaryBar treatments={treatments} isReadOnly={false} onContinue={() => {}} />);

    const total = parseMoney(screen.getByTestId('treatment-total').textContent);
    assertTotalExplainedByRows({ total, rowAmounts: [2000] }); // billable only
    assertCountMatchesItems({ count: buttonCount(), itemCount: 1, label: 'pay button' });
    expect((screen.getByTestId('continue-to-payment-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  test('all-performed/verified visit: enabled pay button, total = billable subtotal', () => {
    const treatments = [tx('performed', 2000), tx('verified', 3000)];
    render(<PaymentSummaryBar treatments={treatments} isReadOnly={false} onContinue={() => {}} />);

    const summary = screen.getByTestId('treatment-summary').textContent ?? '';
    expect(summary).not.toMatch(/no treatments/i);
    const total = parseMoney(screen.getByTestId('treatment-total').textContent);
    expect(total).toBe(5000);
    const btn = screen.getByTestId('continue-to-payment-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    assertCountMatchesItems({ count: buttonCount(), itemCount: 2, label: 'pay button' });
  });

  test('empty visit: explicit empty state and a disabled pay button', () => {
    render(<PaymentSummaryBar treatments={[]} isReadOnly={false} onContinue={() => {}} />);
    expect(screen.getByTestId('treatment-summary').textContent).toMatch(/no treatments/i);
    expect(screen.queryByTestId('treatment-total')).toBeNull();
    expect((screen.getByTestId('continue-to-payment-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  test('read-only (completed) visit: shows View Invoice', () => {
    render(<PaymentSummaryBar treatments={[tx('performed', 2000)]} isReadOnly onContinue={() => {}} />);
    expect(screen.getByTestId('continue-to-payment-btn').textContent).toMatch(/view invoice/i);
  });
});
