/**
 * PatientCredits (Phase 4.1) — credit balance + add/apply actions.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { PatientCredits } from './patient-credits';

const PATIENT = 'aa000000-0000-1000-8000-00000000c4a1';
const INVOICE = 'ff000000-0000-1000-8000-00000000c4a1';
const originalFetch = global.fetch;
let posts: Array<{ url: string; body: Record<string, unknown> }> = [];
let balance = 7500;

beforeEach(() => {
  posts = [];
  balance = 7500;
  global.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = req ? req.url : String(input);
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'POST') {
      let body: Record<string, unknown> = {};
      if (init?.body) body = JSON.parse(init.body as string);
      else if (req) { try { body = await req.clone().json(); } catch { /* none */ } }
      posts.push({ url, body });
      if (url.includes('/apply-credit')) return jsonResponse({ invoiceId: INVOICE, appliedCents: body['amountCents'], invoiceBalanceCents: 0, invoiceStatus: 'paid', remainingCreditCents: 2500 });
      return jsonResponse({ id: 'c1', patientId: PATIENT, branchId: 'b', amountCents: body['amountCents'], source: body['source'], createdAt: '2026-06-19T00:00:00Z' }, 201);
    }
    return jsonResponse({ patientId: PATIENT, balanceCents: balance, credits: [] });
  }) as typeof fetch;
});

afterEach(() => { global.fetch = originalFetch; cleanup(); });

function renderCredits() {
  render(
    React.createElement(PatientCredits, {
      patientId: PATIENT,
      outstandingInvoices: [{ id: INVOICE, invoiceNumber: 'INV-001', balanceCents: 5000 }],
    }),
    { wrapper: makeWrapper(freshClientWithMutations()) },
  );
}

describe('PatientCredits', () => {
  test('shows the available balance', async () => {
    renderCredits();
    await waitFor(() => expect(screen.getByTestId('patient-credit-balance').textContent).toContain('75'));
  });

  test('Add credit POSTs amount (pesos→cents) + source', async () => {
    renderCredits();
    fireEvent.change(screen.getByTestId('add-credit-amount'), { target: { value: '30' } });
    fireEvent.change(screen.getByTestId('add-credit-source'), { target: { value: 'overpayment' } });
    fireEvent.click(screen.getByTestId('add-credit-btn'));

    await waitFor(() => expect(posts.some((p) => p.url.includes('/credits') && !p.url.includes('apply'))).toBe(true));
    const add = posts.find((p) => p.url.includes('/credits') && !p.url.includes('apply'))!;
    expect(add.body.amountCents).toBe(3000);
    expect(add.body.source).toBe('overpayment');
  });

  test('Apply credit POSTs to the selected invoice', async () => {
    renderCredits();
    await waitFor(() => expect(screen.getByTestId('patient-credit-balance').textContent).toContain('75'));
    fireEvent.change(screen.getByTestId('apply-credit-amount'), { target: { value: '50' } });
    fireEvent.click(screen.getByTestId('apply-credit-btn'));

    await waitFor(() => expect(posts.some((p) => p.url.includes('/apply-credit'))).toBe(true));
    const apply = posts.find((p) => p.url.includes('/apply-credit'))!;
    expect(apply.url).toContain(`/invoices/${INVOICE}/apply-credit`);
    expect(apply.body.amountCents).toBe(5000);
  });
});
