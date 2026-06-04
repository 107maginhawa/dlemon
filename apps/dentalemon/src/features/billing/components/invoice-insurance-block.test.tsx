/**
 * InvoiceInsuranceBlock — P1-26 coverage-split rendering + cash-patient hiding.
 *
 * Plan R3: insurance surfaces are HIDDEN unless an active profile exists, so the
 * cash-patient majority is never slowed. Asserted here.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { InvoiceInsuranceBlock } from './invoice-insurance-block';

afterEach(() => cleanup());

describe('InvoiceInsuranceBlock', () => {
  test('renders nothing for a cash patient (no active profile) — R3', () => {
    const { container } = render(
      React.createElement(InvoiceInsuranceBlock, {
        hasActiveProfile: false,
        estimatedCoveredCents: 200000,
        estimatedPatientPortionCents: 800000,
      }),
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('invoice-insurance-block')).toBeNull();
  });

  test('shows the HMO covers / you pay split for an insured patient', () => {
    render(
      React.createElement(InvoiceInsuranceBlock, {
        hasActiveProfile: true,
        estimatedCoveredCents: 200000,
        estimatedPatientPortionCents: 800000,
        claimNumber: 'CLM-2026-ABCD1234',
      }),
    );
    expect(screen.getByTestId('invoice-insurance-block')).not.toBeNull();
    expect(screen.getByTestId('coverage-split').textContent).toBe('HMO covers ₱2,000.00 · You pay ₱8,000.00');
    expect(screen.getByTestId('claim-ref').textContent).toContain('CLM-2026-ABCD1234');
  });
});
