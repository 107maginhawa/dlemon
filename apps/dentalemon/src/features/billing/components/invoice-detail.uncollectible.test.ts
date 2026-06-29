/**
 * InvoiceDetail — BR-013 mark-uncollectible (write-off) flow
 *
 * Renders the shipped InvoiceDetail and asserts the write-off affordance:
 * the "Mark Uncollectible" action appears for an outstanding invoice, prompts
 * a terminal-action confirmation, and POSTs to the /uncollectible endpoint with
 * credentials and no body.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';

const OUTSTANDING_INVOICE = {
  id: 'inv-1',
  invoiceNumber: 'INV-0001',
  status: 'issued',
  patientId: 'p-1',
  patientName: 'Juan dela Cruz',
  visitDate: '2024-01-10',
  dueDate: '2024-02-10',
  lineItems: [
    { id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 16, priceCents: 250000 },
  ],
  payments: [],
  subtotalCents: 250000,
  discountCents: 0,
  taxCents: 0,
  totalCents: 250000,
  balanceCents: 250000,
};

function installFetch() {
  const writeOffCalls: Array<{ method: string; credentials?: RequestCredentials; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.includes('/uncollectible')) {
      const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
      writeOffCalls.push({ method, credentials: init?.credentials, body: raw ? JSON.parse(raw) : undefined });
      return json({ ...OUTSTANDING_INVOICE, status: 'uncollectible' });
    }
    return json(OUTSTANDING_INVOICE);
  }) as unknown as typeof fetch;
  return { writeOffCalls, restore: () => { global.fetch = original; } };
}

afterEach(cleanup);

function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(InvoiceDetail, {
        invoiceId: 'inv-1',
        open: true,
        onClose: () => {},
      }),
    ),
  );
}

describe('InvoiceDetail — BR-013 mark uncollectible', () => {
  test('writes off an outstanding invoice via POST /uncollectible after confirmation', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      await user.click(await screen.findByTestId('invoice-more-btn'));
      const btn = await screen.findByTestId('mark-uncollectible-btn');
      await user.click(btn);

      // Terminal action requires explicit confirmation.
      expect(await screen.findByTestId('uncollectible-confirm')).not.toBeNull();
      await user.click(screen.getByRole('button', { name: /confirm write-off/i }));

      await waitFor(() => expect(f.writeOffCalls.length).toBe(1));
      expect(f.writeOffCalls[0].method).toBe('POST');
      expect(f.writeOffCalls[0].credentials).toBe('include');
      // No request body — server derives everything from the path + session.
      expect(f.writeOffCalls[0].body).toBeUndefined();
    } finally {
      f.restore();
    }
  });

  test('cancelling the confirmation does not send a write-off request', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      await user.click(await screen.findByTestId('invoice-more-btn'));
      await user.click(await screen.findByTestId('mark-uncollectible-btn'));
      await user.click(await screen.findByRole('button', { name: /cancel/i }));

      await new Promise((r) => setTimeout(r, 50));
      expect(f.writeOffCalls.length).toBe(0);
    } finally {
      f.restore();
    }
  });
});
