/**
 * PaymentSummaryBar — cross-element coherence guard for the workspace payment footer.
 *
 * Bug class: the count/total a clinician reads in the footer ("N pending · ₱X",
 * "Continue to Payment (N)") was computed from `pendingCount` (diagnosed|planned
 * only), while tapping the button bills EVERY treatment in the visit (the payment
 * modal's line items + subtotal). On a visit with any performed treatment the
 * button under-counts; on an all-performed (but not-yet-completed) visit the footer
 * read "No pending treatments" + an enabled "Continue to Payment (0)" that still
 * billed ₱X. The honest invariant: the footer figures match the BILLABLE set
 * (every visit treatment), i.e. exactly what the payment modal renders.
 *
 * The all-pending seed state masked this — which is why the suite never caught it.
 * These cases deliberately exercise the mixed / all-performed / empty states.
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

describe('PaymentSummaryBar — footer figures match the billable set', () => {
  test('all-pending visit: count + total match the treatments billed', () => {
    const treatments = [tx('diagnosed', 1000), tx('planned', 4500)];
    render(<PaymentSummaryBar treatments={treatments} isReadOnly={false} onContinue={() => {}} />);

    const total = parseMoney(screen.getByTestId('treatment-total').textContent);
    assertTotalExplainedByRows({ total, rowAmounts: treatments.map((t) => t.priceAmount) });
    assertCountMatchesItems({ count: buttonCount(), itemCount: treatments.length, label: 'pay button' });
  });

  test('mixed visit: button count is the billable count, not the pending count', () => {
    // 2 pending + 1 performed → payment bills 3 items; old code showed "(2)".
    const treatments = [tx('diagnosed', 1000), tx('planned', 4500), tx('performed', 2000)];
    render(<PaymentSummaryBar treatments={treatments} isReadOnly={false} onContinue={() => {}} />);

    const total = parseMoney(screen.getByTestId('treatment-total').textContent);
    // total reflects ALL treatments (= modal subtotal), not just pending
    assertTotalExplainedByRows({ total, rowAmounts: treatments.map((t) => t.priceAmount) });
    assertCountMatchesItems({ count: buttonCount(), itemCount: 3, label: 'pay button' });
  });

  test('all-performed active visit: enabled pay button is not paired with "nothing to bill"', () => {
    const treatments = [tx('performed', 2000), tx('verified', 3000)];
    render(<PaymentSummaryBar treatments={treatments} isReadOnly={false} onContinue={() => {}} />);

    const summary = screen.getByTestId('treatment-summary').textContent ?? '';
    expect(summary).not.toMatch(/no treatments|no pending/i); // must not claim nothing is billable
    const total = parseMoney(screen.getByTestId('treatment-total').textContent);
    expect(total).toBe(5000); // visible, non-zero, equals the billable subtotal
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
