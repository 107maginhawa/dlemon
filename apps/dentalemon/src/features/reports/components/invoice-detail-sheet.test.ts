/**
 * InvoiceDetailSheet — component smoke tests
 *
 * RPT-01: sheet opens when an invoice row is clicked (open prop)
 * RPT-02: sheet shows line items and payment history
 *
 * Coverage:
 * - Returns null when open=false (closed state)
 * - Renders role="dialog" when open=true
 * - Shows "Loading…" while data fetches
 * - Shows error message on fetch failure
 * - Shows invoice number and patient name in header
 * - Shows "Line Items" section (RPT-02)
 * - Shows treatment description in line items table
 * - Shows "Payment History" section (RPT-02)
 * - Shows "No payments recorded" when payments empty
 * - Calls onClose when close button clicked
 * - Calls onClose when backdrop clicked
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock useInvoiceDetail — swap result per test via a mutable reference
// ---------------------------------------------------------------------------

type MockHookResult = {
  invoice: Record<string, unknown> | null;
  isLoading: boolean;
  error: Error | null;
};

let mockResult: MockHookResult = { invoice: null, isLoading: false, error: null };

mock.module('../../billing/hooks/use-invoice-detail', () => ({
  useInvoiceDetail: (_id: string | null) => mockResult,
}));

// Import component AFTER mock is registered
const { InvoiceDetailSheet } = await import('./invoice-detail-sheet');

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INVOICE = {
  id: 'inv1',
  invoiceNumber: 'INV-2026-001',
  patientId: 'p1',
  patientName: 'Maria Santos',
  visitId: 'v1a',
  visitDate: '2026-04-28',
  status: 'partial',
  subtotalCents: 1450000,
  totalCents: 1450000,
  paidCents: 1100000,
  balanceCents: 350000,
  createdAt: '2026-04-28T11:00:00',
  lineItems: [
    {
      id: 'li1',
      invoiceId: 'inv1',
      cdtCode: 'D0120',
      description: 'Periodic Exam',
      priceCents: 50000,
      amountCents: 50000,
    },
  ],
  payments: [
    {
      id: 'pay1',
      invoiceId: 'inv1',
      amountCents: 1100000,
      method: 'card',
      createdAt: '2026-04-28T12:00:00',
    },
  ],
};

function renderSheet(props: { open: boolean; onClose?: () => void }) {
  return render(
    React.createElement(InvoiceDetailSheet, {
      invoiceId: 'inv1',
      open: props.open,
      onClose: props.onClose ?? (() => {}),
    }),
  );
}

// ---------------------------------------------------------------------------
// Open / closed state (RPT-01)
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — open/closed (RPT-01)', () => {
  test('renders nothing when open=false', () => {
    mockResult = { invoice: null, isLoading: false, error: null };
    renderSheet({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('renders dialog element when open=true', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    renderSheet({ open: true });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  test('dialog has aria-label "Invoice Detail"', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    renderSheet({ open: true });
    expect(screen.getByRole('dialog', { name: 'Invoice Detail' })).toBeTruthy();
  });

  test('close button calls onClose', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    let closed = false;
    renderSheet({ open: true, onClose: () => { closed = true; } });
    fireEvent.click(screen.getByLabelText('Close'));
    expect(closed).toBe(true);
  });

  test('clicking backdrop calls onClose', () => {
    mockResult = { invoice: null, isLoading: true, error: null };
    let closed = false;
    renderSheet({ open: true, onClose: () => { closed = true; } });
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(closed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loading and error states
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — loading / error states', () => {
  test('shows "Loading…" while isLoading=true', () => {
    mockResult = { invoice: null, isLoading: true, error: null };
    renderSheet({ open: true });
    expect(screen.getByText(/Loading/)).toBeTruthy();
  });

  test('shows error message on fetch failure', () => {
    mockResult = { invoice: null, isLoading: false, error: new Error('500') };
    renderSheet({ open: true });
    expect(screen.getByText(/Failed to load invoice details/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Invoice header (RPT-01)
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — invoice header (RPT-01)', () => {
  test('shows invoice number in header', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    renderSheet({ open: true });
    expect(screen.getByText('Invoice INV-2026-001')).toBeTruthy();
  });

  test('shows patient name in header', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    renderSheet({ open: true });
    expect(screen.getByText('Maria Santos')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Line items section (RPT-02)
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — line items (RPT-02)', () => {
  test('shows "Line Items" section heading', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    renderSheet({ open: true });
    expect(screen.getByText('Line Items')).toBeTruthy();
  });

  test('shows treatment description in line items table', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    renderSheet({ open: true });
    expect(screen.getByText('Periodic Exam')).toBeTruthy();
  });

  test('shows CDT code in line items table', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    renderSheet({ open: true });
    expect(screen.getByText('D0120')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Payment history section (RPT-02)
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — payment history (RPT-02)', () => {
  test('shows "Payment History" section heading', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    renderSheet({ open: true });
    expect(screen.getByText('Payment History')).toBeTruthy();
  });

  test('shows payment method label', () => {
    mockResult = { invoice: INVOICE, isLoading: false, error: null };
    renderSheet({ open: true });
    // method: 'card' maps to METHOD_LABELS['card'] = 'Card'
    expect(screen.getByText('Card')).toBeTruthy();
  });

  test('shows "No payments recorded" when payments array is empty', () => {
    mockResult = {
      invoice: { ...INVOICE, payments: [] },
      isLoading: false,
      error: null,
    };
    renderSheet({ open: true });
    expect(screen.getByText('No payments recorded')).toBeTruthy();
  });
});
