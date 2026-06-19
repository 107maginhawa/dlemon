/**
 * PatientStatement (Phase 3.2) — itemized statement view + email action.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { PatientStatement } from './patient-statement';

const PATIENT = 'aa000000-0000-1000-8000-0000000003a2';
const BRANCH = 'bb000000-0000-1000-8000-0000000003a2';
const originalFetch = global.fetch;
let sendCalls = 0;

const statement = {
  patientId: PATIENT,
  patientName: 'Sofia Cruz',
  generatedAt: '2026-06-19T00:00:00.000Z',
  summary: { totalVisits: 2, totalInvoices: 2, totalPayments: 1, totalBilledCents: 800000, totalPaidCents: 500000, outstandingBalanceCents: 300000 },
  visits: [],
  invoices: [
    { id: 'i1', invoiceNumber: 'INV-001', status: 'partial', totalCents: 500000, paidCents: 200000, balanceCents: 300000, issuedAt: '2026-05-01T00:00:00.000Z', lineItems: [] },
  ],
  payments: [
    { id: 'p1', amountCents: 200000, method: 'cash', isVoid: false, receiptNumber: 'R-001', recordedAt: '2026-05-02T00:00:00.000Z' },
  ],
};

beforeEach(() => {
  sendCalls = 0;
  global.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = req ? req.url : String(input);
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'POST' && url.includes('/statement/send')) {
      sendCalls += 1;
      return jsonResponse({ patientId: PATIENT, sent: true, outstandingBalanceCents: 300000, channels: ['email', 'push'] });
    }
    if (url.includes(`/dental/patients/${PATIENT}/statement`)) return jsonResponse(statement);
    return jsonResponse({});
  }) as typeof fetch;
});

afterEach(() => { global.fetch = originalFetch; cleanup(); });

function renderStatement() {
  render(
    React.createElement(PatientStatement, { patientId: PATIENT, branchId: BRANCH, onClose: () => {} }),
    { wrapper: makeWrapper(freshClientWithMutations()) },
  );
}

describe('PatientStatement', () => {
  test('renders the statement (name, outstanding, invoice row)', async () => {
    renderStatement();
    expect(await screen.findByTestId('patient-statement-doc')).toBeDefined();
    expect(screen.getByText('Sofia Cruz')).toBeDefined();
    expect(screen.getByTestId('statement-outstanding').textContent).toContain('3,000');
    expect(screen.getByText('INV-001')).toBeDefined();
  });

  test('Email statement → POSTs to /statement/send', async () => {
    renderStatement();
    await screen.findByTestId('patient-statement-doc');
    fireEvent.click(screen.getByTestId('statement-email-btn'));
    await waitFor(() => expect(sendCalls).toBeGreaterThan(0));
  });
});
