/**
 * MyInvoicesView tests (E4 portal).
 *
 * Covers pure helpers + rendered states. Two endpoints feed this view
 * (/me/invoices + /me/balance), so the fetch mock routes by URL. Pins:
 *  - balance summary reflects the /me/balance roll-up
 *  - voided invoices that the API hides do not appear (the API already filters;
 *    the view simply renders what it gets — we assert it renders honestly)
 *  - NO payment affordance in Phase 1 (read-only honesty)
 *  - error vs empty distinction
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import {
  MyInvoicesView,
  formatInvoiceStatus,
  invoiceStatusVariant,
  formatInvoiceDate,
} from './my-invoices-view';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

const INVOICE_A = {
  id: 'inv-a',
  invoiceNumber: 'INV-A-1',
  status: 'issued',
  totalCents: 10000,
  paidCents: 4000,
  balanceCents: 6000,
  dueDate: null,
  issuedAt: '2030-01-05T00:00:00.000Z',
};

const BALANCE = {
  totalBilledCents: 10000,
  totalPaidCents: 4000,
  outstandingBalanceCents: 6000,
  overdueAmountCents: 0,
  invoiceCount: 1,
};

/** Route the SDK's fetch to the right fixture by URL path. */
function routedFetch(invoices: unknown, balance: unknown, opts?: { invoiceStatus?: number }) {
  return mock((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url.includes('/me/balance')) return jsonResponse(balance);
    if (url.includes('/me/invoices')) {
      if (opts?.invoiceStatus && opts.invoiceStatus >= 400) {
        return Promise.resolve(new Response('err', { status: opts.invoiceStatus }));
      }
      return jsonResponse(invoices);
    }
    return jsonResponse([]);
  });
}

function renderView() {
  const qc = freshClient();
  render(React.createElement(MyInvoicesView), { wrapper: makeWrapper(qc) });
  return qc;
}

describe('MyInvoicesView helpers', () => {
  test('formatInvoiceStatus humanizes', () => {
    expect(formatInvoiceStatus('overdue')).toBe('Overdue');
  });
  test('invoiceStatusVariant maps overdue→destructive, paid→secondary', () => {
    expect(invoiceStatusVariant('overdue')).toBe('destructive');
    expect(invoiceStatusVariant('paid')).toBe('secondary');
    expect(invoiceStatusVariant('issued')).toBe('default');
  });
  test('formatInvoiceDate handles null', () => {
    expect(formatInvoiceDate(null)).toBe('—');
  });
});

describe('MyInvoicesView rendering', () => {
  test('shows the outstanding-balance roll-up from /me/balance', async () => {
    global.fetch = routedFetch([INVOICE_A], BALANCE);
    renderView();
    await waitFor(() => expect(screen.getByTestId('portal-balance-summary')).not.toBeNull());
    // ₱60.00 (6000 cents)
    expect(screen.getByTestId('portal-balance-amount').textContent).toContain('60');
  });

  test('renders the patient own invoices', async () => {
    global.fetch = routedFetch([INVOICE_A], BALANCE);
    renderView();
    await waitFor(() => expect(screen.getByTestId('portal-invoices-list')).not.toBeNull());
    expect(screen.getByText('INV-A-1')).not.toBeNull();
    expect(screen.getAllByTestId('portal-invoice-card').length).toBe(1);
  });

  test('read-only honesty: NO payment affordance (deferred)', async () => {
    global.fetch = routedFetch([INVOICE_A], BALANCE);
    renderView();
    await waitFor(() => expect(screen.getByTestId('portal-invoices-list')).not.toBeNull());
    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull();
    expect(screen.queryByText(/pay now/i)).toBeNull();
  });

  test('empty state when no invoices', async () => {
    global.fetch = routedFetch([], { ...BALANCE, outstandingBalanceCents: 0, invoiceCount: 0 });
    renderView();
    await waitFor(() => expect(screen.getByTestId('portal-invoices-empty')).not.toBeNull());
    expect(screen.queryByTestId('portal-invoices-list')).toBeNull();
  });

  test('error state (403) shows a denial message, not empty', async () => {
    global.fetch = routedFetch([], BALANCE, { invoiceStatus: 403 });
    renderView();
    await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());
    expect(screen.queryByTestId('portal-invoices-empty')).toBeNull();
  });
});
