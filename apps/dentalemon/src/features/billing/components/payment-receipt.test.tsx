/**
 * PaymentReceipt tests — dental-billing AHA FIX-007 (GAP-4).
 *
 * The getDentalPaymentReceipt endpoint had zero FE consumers; cash practices had
 * no printable receipt artifact. These tests pin that the receipt renders the
 * real (contract-reconciled, nested) receipt data and — EC5 — shows a VOIDED
 * watermark when the payment was voided, on the shared PrintableDocument
 * primitive. global.fetch mock returns the contract-correct nested shape.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { PaymentReceipt } from './payment-receipt';

const INVOICE_ID = 'aa000000-0000-4000-8000-0000000inv01';
const PAYMENT_ID = 'pp000000-0000-4000-8000-0000000pay01';

function receiptBody(overrides: Record<string, any> = {}) {
  return {
    receiptNumber: 'RCT-2026-0001',
    isVoid: false,
    voidedAt: null,
    voidReason: null,
    payment: { id: PAYMENT_ID, amountCents: 50000, method: 'cash', recordedAt: '2031-07-15T09:00:00.000Z', notes: null },
    invoice: { id: INVOICE_ID, invoiceNumber: 'INV-2026-0009', totalCents: 120000, paidCents: 50000, balanceCents: 70000, status: 'partial' },
    patient: { id: 'patient-1', name: 'Maria Santos' },
    orNumber: 'RCT-2026-0001',
    clinic: { registeredName: 'Dela Cruz Dental Clinic', businessStyle: 'Dentalemon', tin: '123-456-789-000', address: '12 Mabini St', isVatRegistered: false },
    tax: { vatRate: 0, vatableCents: 0, vatExemptCents: 120000, zeroRatedCents: 0, vatCents: 0 },
    taxStatement: 'Non-VAT registered. THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.',
    generatedAt: '2026-02-02T10:00:00.000Z',
    ...overrides,
  };
}

const originalFetch = global.fetch;
let body = receiptBody();
let receiptUrl = '';

beforeEach(() => {
  receiptUrl = '';
  global.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/receipt')) { receiptUrl = url; return jsonResponse(body); }
    return jsonResponse({});
  }) as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  body = receiptBody();
  cleanup();
});

function renderReceipt() {
  const qc = freshClient();
  render(
    React.createElement(PaymentReceipt, { invoiceId: INVOICE_ID, paymentId: PAYMENT_ID }),
    { wrapper: makeWrapper(qc) },
  );
}

describe('PaymentReceipt — renders the receipt artifact', () => {
  test('shows receipt number, patient name, invoice number and amount', async () => {
    renderReceipt();
    await waitFor(() => expect(screen.getByText('RCT-2026-0001')).toBeDefined());
    expect(screen.getByText('Maria Santos')).toBeDefined();
    expect(screen.getByText('INV-2026-0009')).toBeDefined();
    // ₱500.00 from 50000 cents
    expect(screen.getByText(/500\.00/)).toBeDefined();
  });

  test('renders on the shared printable primitive with a Print action', async () => {
    renderReceipt();
    await waitFor(() => expect(screen.getByTestId('printable-document')).toBeDefined());
    expect(screen.getByRole('button', { name: /print/i })).toBeDefined();
  });

  test('renders the payment method label and the recorded date (transformer path)', async () => {
    renderReceipt();
    await waitFor(() => expect(screen.getByText('RCT-2026-0001')).toBeDefined());
    // Method label resolves via METHOD_LABELS ('cash' -> 'Cash').
    expect(screen.getByText('Cash')).toBeDefined();
    // recordedAt (ISO string → Date via the SDK transformer) renders. Year 2031
    // is unique to recordedAt (receipt#/invoice#/generatedAt use other years), so
    // this uniquely pins the recorded-date render path.
    expect(screen.getByText(/2031/)).toBeDefined();
  });

  test('fetches the receipt for the exact invoiceId + paymentId (no path-param swap)', async () => {
    renderReceipt();
    await waitFor(() => expect(receiptUrl).toContain('/receipt'));
    expect(receiptUrl).toContain(`/invoices/${INVOICE_ID}/payments/${PAYMENT_ID}/receipt`);
  });

  test('does NOT show a VOIDED watermark for a normal payment', async () => {
    renderReceipt();
    await waitFor(() => expect(screen.getByText('RCT-2026-0001')).toBeDefined());
    expect(screen.queryByTestId('receipt-void-watermark')).toBeNull();
  });
});

describe('PaymentReceipt — BIR fields + wording (BR-055)', () => {
  test('renders the BIR clinic header: registered name, business style, TIN', async () => {
    renderReceipt();
    await waitFor(() => expect(screen.getByText('Dela Cruz Dental Clinic')).toBeDefined());
    expect(screen.getByText(/Dentalemon/)).toBeDefined();
    expect(screen.getByText(/123-456-789-000/)).toBeDefined();
  });

  test('non-VAT receipt shows the BIR non-VAT statement', async () => {
    renderReceipt();
    await waitFor(() => expect(screen.getByText('RCT-2026-0001')).toBeDefined());
    expect(screen.getByText(/NOT VALID FOR CLAIM OF INPUT TAX/i)).toBeDefined();
  });

  test('VAT-registered receipt shows the VAT breakdown (VATable + VAT amount)', async () => {
    body = receiptBody({
      clinic: { registeredName: 'VAT Clinic', businessStyle: 'Dentalemon', tin: '999-888-777-000', address: 'QC', isVatRegistered: true },
      tax: { vatRate: 0.12, vatableCents: 107143, vatExemptCents: 0, zeroRatedCents: 0, vatCents: 12857 },
      taxStatement: 'VAT-registered. Price is VAT-inclusive; VAT is shown above.',
    });
    renderReceipt();
    await waitFor(() => expect(screen.getByText('RCT-2026-0001')).toBeDefined());
    expect(screen.getByTestId('receipt-vat-amount').textContent).toMatch(/128\.57/); // ₱12,857 cents
    expect(screen.getByText(/VAT-registered/i)).toBeDefined();
    expect(screen.queryByText(/NOT VALID FOR CLAIM OF INPUT TAX/i)).toBeNull();
  });
});

describe('PaymentReceipt — EC5 voided reprint', () => {
  test('shows a VOIDED watermark and the void reason when the payment is voided', async () => {
    body = receiptBody({ isVoid: true, voidedAt: '2026-02-03T08:00:00.000Z', voidReason: 'Keyed wrong amount' });
    renderReceipt();
    const watermark = await screen.findByTestId('receipt-void-watermark');
    expect(watermark.textContent).toMatch(/VOID/i);
    // The void reason is surfaced legibly (not just the watermark).
    expect(screen.getByText(/Keyed wrong amount/)).toBeDefined();
  });
});
