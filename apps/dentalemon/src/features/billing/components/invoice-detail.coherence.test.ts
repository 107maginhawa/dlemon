/**
 * InvoiceDetail — cross-element coherence guard.
 *
 * Billing is currently coherent (the stored total is built from the same line items
 * that render, and invoice creation guarantees ≥1 line item). This is a regression
 * pin for the bug class "a money total a human reads with no visible line items
 * explaining it." If a future change ever filters/decouples the rendered rows from
 * the total, this goes red.
 *
 * Uses global.fetch mocking (NOT mock.module) per repo convention. The org-context
 * Zustand store needs no provider (module singleton), so a bare render works.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import { InvoiceDetail } from './invoice-detail';

const originalFetch = global.fetch;
function makeWrapper() {
  return makeWrapperBase(freshClient());
}
afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

const INVOICE = {
  id: 'inv-1',
  invoiceNumber: 'INV-001',
  status: 'issued',
  patientName: 'Juan dela Cruz',
  subtotalCents: 350000,
  discountCents: 0,
  taxCents: 0,
  totalCents: 350000,
  paidCents: 0,
  balanceCents: 350000,
  lineItems: [
    { id: 'li-1', description: 'Adult prophylaxis', cdtCode: 'D1110', toothNumber: null, priceCents: 250000 },
    { id: 'li-2', description: 'Periodic oral evaluation', cdtCode: 'D0120', toothNumber: null, priceCents: 100000 },
  ],
  payments: [],
};

describe('InvoiceDetail — non-zero total is backed by visible line items', () => {
  test('a ₱3500.00 total renders both line-item rows (no orphaned money)', async () => {
    global.fetch = mock(() => jsonResponse(INVOICE));
    render(
      React.createElement(InvoiceDetail, { invoiceId: 'inv-1', open: true, onClose: () => {} }),
      { wrapper: makeWrapper() },
    );
    await screen.findByTestId('invoice-detail');
    // the total a human reads...
    await waitFor(() => expect(screen.getAllByText(/₱3500\.00/).length).toBeGreaterThan(0));
    // ...is explained by visible line items
    expect(screen.getByText('Adult prophylaxis')).not.toBeNull();
    expect(screen.getByText('Periodic oral evaluation')).not.toBeNull();
  });
});
