/**
 * PaymentSummaryBar — cross-element coherence guard for the workspace payment footer.
 *
 * Bug class (summary-vs-body coherence): the footer count/total a clinician reads
 * ("N pending · ₱X", "Continue to Payment (N)") must equal what tapping the button
 * can actually CHARGE. The server bills ONLY performed|verified treatments
 * (BR-009 — services/api-ts/.../createDentalInvoice.ts), so the PAYABLE total is the
 * billable subset, never "every treatment in the visit". An all-planned visit has a
 * ₱0 payable total and must route to the ESTIMATE, not present a "Continue to
 * Payment (N) · ₱X" that 422s on click. These cases pin that invariant via the
 * shared `splitBillable` SoT.
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

describe('PaymentSummaryBar — payable figures match the billable set (BR-009)', () => {
  test('all-planned visit: ₱0 payable, button routes to the estimate (no pay dead-end)', () => {
    const treatments = [tx('diagnosed', 1000), tx('planned', 4500)];
    render(<PaymentSummaryBar treatments={treatments} isReadOnly={false} onContinue={() => {}} />);

    // No payable total is shown (nothing is billable) — and crucially no "Continue
    // to Payment (N)" that would 422.
    expect(screen.queryByTestId('treatment-total')).toBeNull();
    const btn = screen.getByTestId('continue-to-payment-btn') as HTMLButtonElement;
    expect(btn.textContent).toMatch(/estimate/i);
    expect(btn.disabled).toBe(false); // reachable — opens the modal to show the estimate
  });

  test('mixed visit: button count + total are the PERFORMED subset only', () => {
    // 2 planned + 1 performed → only the ₱2,000 performed item bills.
    const treatments = [tx('diagnosed', 1000), tx('planned', 4500), tx('performed', 2000)];
    render(<PaymentSummaryBar treatments={treatments} isReadOnly={false} onContinue={() => {}} />);

    const total = parseMoney(screen.getByTestId('treatment-total').textContent);
    assertTotalExplainedByRows({ total, rowAmounts: [2000] }); // billable subset only
    assertCountMatchesItems({ count: buttonCount(), itemCount: 1, label: 'pay button' });
  });

  test('all-performed active visit: enabled pay button equals the billable subtotal', () => {
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
