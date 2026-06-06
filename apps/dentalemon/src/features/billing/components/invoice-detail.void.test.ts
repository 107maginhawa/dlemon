/**
 * InvoiceDetail — void flow (Theme A latent bug)
 *
 * The void contract (docs/product/modules/dental-billing/API_CONTRACTS.md §void)
 * requires a `reason` (min 5, required) so the void is auditable. The shipped
 * handleVoid POSTed an empty body, capturing no reason. These tests render the
 * SHIPPED InvoiceDetail and assert the void flow collects a reason and sends it
 * in the request body.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';

const VOIDABLE_INVOICE = {
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
  const voidCalls: Array<{ body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.includes('/void')) {
      const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
      voidCalls.push({ body: raw ? JSON.parse(raw) : undefined });
      return json({ ...VOIDABLE_INVOICE, status: 'voided' });
    }
    return json(VOIDABLE_INVOICE);
  }) as unknown as typeof fetch;
  return { voidCalls, restore: () => { global.fetch = original; } };
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

describe('InvoiceDetail — void requires a reason', () => {
  test('voiding collects a reason and sends it in the request body', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      // Wait for the invoice to load (Void action visible).
      const voidBtn = await screen.findByRole('button', { name: /^void$/i });
      await user.click(voidBtn);

      // A reason field must appear before the void is submitted.
      const reasonField = await screen.findByLabelText(/reason/i);
      await user.type(reasonField, 'Duplicate invoice — billed twice');

      await user.click(screen.getByRole('button', { name: /confirm void|void invoice/i }));

      await waitFor(() => expect(f.voidCalls.length).toBe(1));
      expect((f.voidCalls[0].body as { reason: string }).reason).toContain('Duplicate invoice');
    } finally {
      f.restore();
    }
  });

  test('void is not submitted when the reason is empty', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDetail();
      const voidBtn = await screen.findByRole('button', { name: /^void$/i });
      await user.click(voidBtn);

      // Confirm with no reason → no request should be sent (client-side guard).
      const confirm = await screen.findByRole('button', { name: /confirm void|void invoice/i });
      await user.click(confirm);

      // Give any (incorrect) request a chance to fire, then assert none did.
      await new Promise((r) => setTimeout(r, 50));
      expect(f.voidCalls.length).toBe(0);
    } finally {
      f.restore();
    }
  });
});
