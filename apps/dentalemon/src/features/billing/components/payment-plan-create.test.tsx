/**
 * PaymentPlanCreate — create-plan dialog (FIX-005)
 *
 * The headline PH installment feature. The dialog must: surface the invoice balance
 * read-only, bound the installment count to 2–24 client-side, require frequency +
 * start date, POST the right body (NO amount — the backend derives the total from the
 * balance), and surface backend 4xx legibly via the flat SdkError envelope. RED-first.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentPlanCreate } from './payment-plan-create';

function planResponse() {
  return {
    id: 'plan-1', invoiceId: 'inv-1', patientId: 'p-1', totalCents: 30000,
    numberOfInstallments: 6, frequency: 'monthly', startDate: '2026-07-01T00:00:00.000Z',
    amountPerInstallmentCents: 5000, status: 'on_track',
    createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z', installments: [],
  };
}

function installFetch(opts: { errorStatus?: number; errorBody?: unknown } = {}) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/plan')) {
      if (opts.errorStatus) return json(opts.errorBody, opts.errorStatus);
      return json(planResponse(), 201);
    }
    return json({}, 200);
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

afterEach(cleanup);

function renderDialog(props: Partial<React.ComponentProps<typeof PaymentPlanCreate>> = {}) {
  const onCreated = props.onCreated ?? mock(() => {});
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(React.createElement(QueryClientProvider, { client: qc },
    React.createElement(PaymentPlanCreate, {
      invoiceId: 'inv-1', patientId: 'p-1', balanceCents: 30000, open: true, onClose: () => {}, onCreated, ...props,
    })));
  return { onCreated };
}

describe('PaymentPlanCreate', () => {
  test('shows the balance to split and the create action', () => {
    const f = installFetch();
    try {
      renderDialog();
      expect(screen.getByText('₱300.00')).not.toBeNull();
      expect(screen.getByRole('button', { name: /create plan/i })).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('blocks submit when the installment count is below 2', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDialog();
      fireEvent.change(screen.getByLabelText(/number of installments/i), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-07-01' } });
      await user.click(screen.getByRole('button', { name: /create plan/i }));

      expect(screen.getByText(/between 2 and 24/i)).not.toBeNull();
      expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/plan'))).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('blocks submit when the installment count is above 24', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDialog();
      fireEvent.change(screen.getByLabelText(/number of installments/i), { target: { value: '25' } });
      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-07-01' } });
      await user.click(screen.getByRole('button', { name: /create plan/i }));

      expect(screen.getByText(/between 2 and 24/i)).not.toBeNull();
      expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/plan'))).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('blocks submit when the start date is missing', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderDialog();
      // default 6 installments + monthly; no start date
      await user.click(screen.getByRole('button', { name: /create plan/i }));

      expect(screen.getByText(/start date is required/i)).not.toBeNull();
      expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/plan'))).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('creates a 6×monthly plan: POST /plan with {patientId, numberOfInstallments, frequency, startDate} and NO amount', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      const { onCreated } = renderDialog();
      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-07-01' } });
      await user.click(screen.getByRole('button', { name: /create plan/i }));

      await waitFor(() =>
        expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/invoices/inv-1/plan'))).toBe(true),
      );
      const post = f.calls.find((c) => c.method === 'POST' && c.url.endsWith('/plan'))!;
      expect(post.body.patientId).toBe('p-1');
      expect(post.body.numberOfInstallments).toBe(6);
      expect(post.body.frequency).toBe('monthly');
      expect(String(post.body.startDate)).toContain('2026-07-01');
      // The backend derives the total from the invoice balance — the dialog must NOT send one.
      expect(post.body.amountCents).toBeUndefined();
      expect(post.body.totalCents).toBeUndefined();
      await waitFor(() => expect((onCreated as any).mock.calls.length).toBeGreaterThanOrEqual(1));
    } finally {
      f.restore();
    }
  });

  test('surfaces a backend PLAN_EXISTS error legibly', async () => {
    const user = userEvent.setup();
    const f = installFetch({ errorStatus: 422, errorBody: { code: 'PLAN_EXISTS', message: 'Invoice already has a payment plan', statusCode: 422 } });
    try {
      const { onCreated } = renderDialog();
      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-07-01' } });
      await user.click(screen.getByRole('button', { name: /create plan/i }));

      await waitFor(() => expect(screen.getByText(/already has a payment plan/i)).not.toBeNull());
      expect((onCreated as any).mock.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });
});
