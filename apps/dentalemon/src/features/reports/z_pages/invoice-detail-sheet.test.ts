/**
 * InvoiceDetailSheet — component smoke tests
 *
 * RPT-01: sheet opens when an invoice row is clicked (open prop)
 * RPT-02: sheet shows line items and payment history
 *
 * Third-party mocks (lucide-react) and useInvoiceDetail are in test-setup.ts.
 * Uses global.__mockInvoiceDetail for per-test hook state.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClient, makeWrapper as makeWrapperBase } from '@/test-utils';

// ─── Hook mock (safe: z_pages/ runs after hooks/) ─────────────────────────

;(globalThis as Record<string, unknown>).__mockInvoiceDetail = {
  invoice: null,
  isLoading: false,
  error: null,
}

mock.module('../../billing/hooks/use-invoice-detail', () => ({
  useInvoiceDetail: (_id: string | null) =>
    (globalThis as Record<string, unknown>).__mockInvoiceDetail as {
      invoice: Record<string, unknown> | null
      isLoading: boolean
      error: Error | null
    },
}))

const { InvoiceDetailSheet } = await import('../components/invoice-detail-sheet');

function makeWrapper() {
  return makeWrapperBase(freshClient());
}

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

function setMock(overrides: Partial<{ invoice: Record<string, unknown> | null; isLoading: boolean; error: Error | null }>) {
  (globalThis as Record<string, unknown>).__mockInvoiceDetail = {
    invoice: null,
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function renderSheet(props: { open: boolean; onClose?: () => void }) {
  return render(
    React.createElement(InvoiceDetailSheet, {
      invoiceId: 'inv1',
      open: props.open,
      onClose: props.onClose ?? (() => {}),
    }),
    { wrapper: makeWrapper() },
  );
}

// ---------------------------------------------------------------------------
// Open / closed state (RPT-01)
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — open/closed (RPT-01)', () => {
  test('renders nothing when open=false', () => {
    setMock({ invoice: null });
    renderSheet({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('renders dialog element when open=true', () => {
    setMock({ invoice: INVOICE });
    renderSheet({ open: true });
    expect(screen.getByRole('dialog')).not.toBeNull();
  });

  test('dialog has aria-label "Invoice Detail"', () => {
    setMock({ invoice: INVOICE });
    renderSheet({ open: true });
    expect(screen.getByRole('dialog', { name: 'Invoice Detail' })).not.toBeNull();
  });

  test('close button calls onClose', async () => {
    const user = userEvent.setup();
    setMock({ invoice: INVOICE });
    let closed = false;
    renderSheet({ open: true, onClose: () => { closed = true; } });
    await user.click(screen.getByLabelText('Close'));
    expect(closed).toBe(true);
  });

  test('clicking backdrop calls onClose', async () => {
    const user = userEvent.setup();
    setMock({ invoice: null, isLoading: true });
    let closed = false;
    renderSheet({ open: true, onClose: () => { closed = true; } });
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);
    expect(closed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loading and error states
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — loading / error states', () => {
  test('shows "Loading..." while isLoading=true', () => {
    setMock({ invoice: null, isLoading: true });
    renderSheet({ open: true });
    expect(screen.getByText(/Loading/)).not.toBeNull();
  });

  test('shows error message on fetch failure', () => {
    setMock({ invoice: null, error: new Error('500') });
    renderSheet({ open: true });
    expect(screen.getByText(/Failed to load invoice details/)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Invoice header (RPT-01)
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — invoice header (RPT-01)', () => {
  test('shows invoice number in header', () => {
    setMock({ invoice: INVOICE });
    renderSheet({ open: true });
    expect(screen.getByText('Invoice INV-2026-001')).not.toBeNull();
  });

  test('shows patient name in header', () => {
    setMock({ invoice: INVOICE });
    renderSheet({ open: true });
    expect(screen.getByText('Maria Santos')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Line items section (RPT-02)
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — line items (RPT-02)', () => {
  test('shows "Line Items" section heading', () => {
    setMock({ invoice: INVOICE });
    renderSheet({ open: true });
    expect(screen.getByText('Line Items')).not.toBeNull();
  });

  test('shows treatment description in line items table', () => {
    setMock({ invoice: INVOICE });
    renderSheet({ open: true });
    expect(screen.getByText('Periodic Exam')).not.toBeNull();
  });

  test('shows CDT code in line items table', () => {
    setMock({ invoice: INVOICE });
    renderSheet({ open: true });
    expect(screen.getByText('D0120')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Payment history section (RPT-02)
// ---------------------------------------------------------------------------

describe('InvoiceDetailSheet — payment history (RPT-02)', () => {
  test('shows "Payment History" section heading', () => {
    setMock({ invoice: INVOICE });
    renderSheet({ open: true });
    expect(screen.getByText('Payment History')).not.toBeNull();
  });

  test('shows payment method label', () => {
    setMock({ invoice: INVOICE });
    renderSheet({ open: true });
    // method: 'card' maps to METHOD_LABELS['card'] = 'Card'
    expect(screen.getByText('Card')).not.toBeNull();
  });

  test('shows "No payments recorded" when payments array is empty', () => {
    setMock({ invoice: { ...INVOICE, payments: [] } });
    renderSheet({ open: true });
    expect(screen.getByText('No payments recorded')).not.toBeNull();
  });
});
