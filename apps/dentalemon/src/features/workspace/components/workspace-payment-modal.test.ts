/**
 * Tests for WorkspacePaymentModal
 *
 * Covers: PAY-01 (initiate payment / create invoice), PAY-02 (view status)
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { WorkspacePaymentModal, type PaymentLineItem } from './workspace-payment-modal';

const mockFetch = mock(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
);

const LINE_ITEMS: PaymentLineItem[] = [
  { id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 14, priceCents: 12000, status: 'pending' },
  { id: 'li-2', description: 'Scaling', priceCents: 8000, status: 'done' },
];

const INVOICE = {
  id: 'inv-1',
  invoiceNumber: 'INV-001',
  patientId: 'pat-1',
  totalCents: 20000,
  paidCents: 0,
  balanceCents: 20000,
  status: 'draft',
  createdAt: '2026-01-01T00:00:00Z',
};

function renderModal(props: Partial<React.ComponentProps<typeof WorkspacePaymentModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const defaultProps = {
    patientId: 'pat-1',
    visitId: 'visit-1',
    patientName: 'John Doe',
    lineItems: LINE_ITEMS,
    open: true,
    onClose: () => {},
  };
  return {
    qc,
    ...render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(WorkspacePaymentModal, { ...defaultProps, ...props }),
      ),
    ),
  };
}

describe('WorkspacePaymentModal', () => {
  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    // Default: no existing invoices
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as any);
  });

  afterEach(() => {
    cleanup();
    mockFetch.mockReset();
  });

  it('does not render when open=false', () => {
    renderModal({ open: false });
    expect(screen.queryByTestId('workspace-payment-modal')).toBeNull();
  });

  it('renders modal with header when open=true', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /payment/i })).toBeTruthy();
    expect(screen.getByText('Payment')).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('renders all line items', async () => {
    renderModal();
    expect(screen.getByTestId('line-item-li-1')).toBeTruthy();
    expect(screen.getByTestId('line-item-li-2')).toBeTruthy();
    expect(screen.getByText('Composite Filling')).toBeTruthy();
    expect(screen.getByText('Scaling')).toBeTruthy();
  });

  it('shows correct subtotal (PAY-01)', async () => {
    renderModal();
    // 120 + 80 = 200.00
    const row = screen.getByTestId('subtotal-row');
    expect(row).toBeTruthy();
    const amount = screen.getByTestId('subtotal-amount');
    expect(amount.textContent).toContain('200');
  });

  it('shows "Create Invoice" button when no invoice exists (PAY-01)', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('create-invoice-btn')).toBeTruthy();
    });
  });

  it('shows invoice banner when invoice exists (PAY-02)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([INVOICE]),
    } as any);

    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('invoice-banner')).toBeTruthy();
    });
    expect(screen.getByText('INV-001')).toBeTruthy();
  });

  it('shows "Record Payment" when invoice exists (PAY-01)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([INVOICE]),
    } as any);

    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('open-invoice-detail-btn')).toBeTruthy();
    });
  });

  it('shows View Invoice link (PAY-02)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([INVOICE]),
    } as any);

    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('view-invoice-btn')).toBeTruthy();
    });
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = mock(() => {});
    renderModal({ onClose });
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button clicked', () => {
    const onClose = mock(() => {});
    renderModal({ onClose });
    fireEvent.click(screen.getByLabelText('Close payment modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Create Invoice" button is disabled with no line items', async () => {
    renderModal({ lineItems: [] });
    await waitFor(() => {
      const btn = screen.getByTestId('create-invoice-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  it('creates invoice when "Create Invoice" clicked (PAY-01)', async () => {
    // Step 1: invoice list → empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    } as any);
    // Step 2: create invoice
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(INVOICE),
    } as any);
    // Step 3: invalidated re-fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([INVOICE]),
    } as any);

    renderModal();
    await waitFor(() => {
      const btn = screen.getByTestId('create-invoice-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    fireEvent.click(screen.getByTestId('create-invoice-btn'));
    await waitFor(() => {
      const calls = mockFetch.mock.calls as [string, RequestInit][];
      const postCall = calls.find(([, opts]) => opts?.method === 'POST');
      expect(postCall).toBeTruthy();
      expect(postCall![0]).toContain('/dental/billing/invoices');
    });
  });

  it('shows empty state when no line items and no invoice', async () => {
    renderModal({ lineItems: [] });
    await waitFor(() => {
      // Subtotal row should not be visible
      expect(screen.queryByTestId('subtotal-row')).toBeNull();
    });
  });
});
