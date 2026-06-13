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
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import React from 'react';
import {
  freshClient,
  makeWrapper as makeWrapperBase,
  jsonResponse,
  parseMoney,
  assertTotalExplainedByRows,
} from '@/test-utils';
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

/** The price cell (last tabular-nums) of the line-item row containing `desc`. */
function rowPrice(desc: string): number {
  const row = screen.getByText(desc).closest('tr');
  if (!row) throw new Error(`no row for "${desc}"`);
  const cells = within(row as HTMLElement)
    .queryAllByText(/₱/)
    .map((el) => parseMoney(el.textContent));
  return cells[cells.length - 1];
}

/** The rendered "Total" figure (its own field on the invoice, not a row sum). */
function renderedTotal(): number {
  const totalLabel = screen.getByText('Total');
  const row = totalLabel.parentElement as HTMLElement;
  const value = within(row).getAllByText(/₱/).pop();
  return parseMoney(value?.textContent);
}

describe('InvoiceDetail — non-zero total is backed by visible line items', () => {
  test('the rendered total equals the sum of the rendered line-item rows', async () => {
    global.fetch = mock(() => jsonResponse(INVOICE));
    render(
      React.createElement(InvoiceDetail, { invoiceId: 'inv-1', open: true, onClose: () => {} }),
      { wrapper: makeWrapper() },
    );
    await screen.findByTestId('invoice-detail');
    await waitFor(() => expect(screen.queryByText('Adult prophylaxis')).not.toBeNull());

    // Oracle: derive the expected total FROM the rendered rows, not from a fixture
    // constant. If a future change reads the total from a field that diverges from
    // the visible rows, this goes red.
    const rowAmounts = ['Adult prophylaxis', 'Periodic oral evaluation'].map(rowPrice);
    assertTotalExplainedByRows({ total: renderedTotal(), rowAmounts, label: 'invoice total' });
  });
});
