/**
 * InvoiceDetail — issue + record-payment interaction tests
 *
 * The void flow is covered in invoice-detail.void.test.ts; the helper logic in
 * invoice-detail.test.ts. The two remaining state-changing actions —
 * handleIssue (PATCH /issue) and handleRecordPayment (POST /payments) — had only
 * logic-helper coverage and no test that actually clicks the button, fires the
 * mutation, and asserts the request. These render the SHIPPED InvoiceDetail and
 * drive both.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceDetail } from './invoice-detail';
import { useOrgContextStore } from '@/stores/org-context.store';

// The recording staff member is sourced from the PIN-authenticated org context.
const TEST_MEMBER_ID = '11111111-1111-4111-8111-111111111111';

function baseInvoice(status: string) {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-0001',
    status,
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
}

function installFetch(initialStatus: string) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.endsWith('/issue')) return json({ ...baseInvoice('issued') });
    if (url.endsWith('/payments')) return json({ ...baseInvoice('paid'), balanceCents: 0 });
    return json(baseInvoice(initialStatus));
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

beforeEach(() => {
  // After login the org context store holds the active membership id; payment
  // recording must send it as recordedByMemberId.
  useOrgContextStore.setState({ memberId: TEST_MEMBER_ID, branchId: 'b-1', orgId: 'o-1', role: 'dentist_owner' });
});
afterEach(() => {
  cleanup();
  useOrgContextStore.setState({ memberId: null, branchId: null, orgId: null, role: null });
});

function renderDetail(props: Partial<React.ComponentProps<typeof InvoiceDetail>> = {}) {
  const onUpdated = props.onUpdated ?? mock(() => {});
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(InvoiceDetail, {
        invoiceId: 'inv-1',
        open: true,
        onClose: () => {},
        onUpdated,
        ...props,
      }),
    ),
  );
  return { onUpdated };
}

describe('InvoiceDetail — issue', () => {
  test('clicking Issue Invoice fires PATCH /issue and notifies onUpdated', async () => {
    const user = userEvent.setup();
    const f = installFetch('draft');
    try {
      const { onUpdated } = renderDetail();
      const issueBtn = await screen.findByRole('button', { name: /issue invoice/i });
      await user.click(issueBtn);

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'PATCH' && c.url.endsWith('/invoices/inv-1/issue'))).toBe(true),
      );
      await waitFor(() => expect((onUpdated as any).mock.calls.length).toBeGreaterThanOrEqual(1));
    } finally {
      f.restore();
    }
  });
});

describe('InvoiceDetail — record payment', () => {
  test('blocks submit and shows validation errors when amount + receipt are empty', async () => {
    const user = userEvent.setup();
    const f = installFetch('issued');
    try {
      renderDetail();
      await user.click(await screen.findByRole('button', { name: /record payment/i }));
      // submit the inline form with nothing filled
      await user.click(screen.getByRole('button', { name: /^record$/i }));

      expect(screen.getByText('Amount must be greater than zero')).not.toBeNull();
      expect(screen.getByText('Receipt number is required')).not.toBeNull();
      expect(f.calls.some(c => c.method === 'POST' && c.url.endsWith('/payments'))).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('records a payment: POST /payments with the entered amount/method/receipt', async () => {
    const user = userEvent.setup();
    const f = installFetch('issued');
    try {
      const { onUpdated } = renderDetail();
      await user.click(await screen.findByRole('button', { name: /record payment/i }));

      await user.type(screen.getByLabelText(/amount/i), '100.00');
      await user.type(screen.getByLabelText(/receipt/i), 'R-A-0001');
      await user.click(screen.getByRole('button', { name: /^record$/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.endsWith('/invoices/inv-1/payments'))).toBe(true),
      );
      const post = f.calls.find(c => c.method === 'POST' && c.url.endsWith('/payments'))!;
      expect(post.body.amountCents).toBe(10000);
      expect(post.body.method).toBe('cash');
      expect(post.body.receiptNumber).toBe('R-A-0001');
      // Regression: the backend rejects an empty recordedByMemberId with
      // 400 "Invalid UUID", so the UI must send the active member id.
      expect(post.body.recordedByMemberId).toBe(TEST_MEMBER_ID);
      await waitFor(() => expect((onUpdated as any).mock.calls.length).toBeGreaterThanOrEqual(1));
    } finally {
      f.restore();
    }
  });

  test('blocks submit with an error when there is no member context', async () => {
    useOrgContextStore.setState({ memberId: null });
    const user = userEvent.setup();
    const f = installFetch('issued');
    try {
      renderDetail();
      await user.click(await screen.findByRole('button', { name: /record payment/i }));
      await user.type(screen.getByLabelText(/amount/i), '100.00');
      await user.type(screen.getByLabelText(/receipt/i), 'R-A-0002');
      await user.click(screen.getByRole('button', { name: /^record$/i }));

      // Must NOT fire a POST with an empty recordedByMemberId (would 400).
      await new Promise((r) => setTimeout(r, 150));
      expect(f.calls.some(c => c.method === 'POST' && c.url.endsWith('/payments'))).toBe(false);
    } finally {
      f.restore();
    }
  });
});
