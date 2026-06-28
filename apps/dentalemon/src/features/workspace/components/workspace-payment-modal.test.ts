/**
 * Tests for WorkspacePaymentModal
 *
 * Covers: PAY-01 (initiate payment / create invoice), PAY-02 (view status)
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { WorkspacePaymentModal, type PaymentLineItem } from './workspace-payment-modal';
import { useOrgContextStore } from '@/stores/org-context.store';
import { jsonResponse, freshClientWithMutations } from '@/test-utils';

const originalFetch = global.fetch;
const mockFetch = mock(() => jsonResponse({ data: [] }));

// Real treatment FSM statuses — the server bills `performed`/`verified` only.
const LINE_ITEMS: PaymentLineItem[] = [
  { id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 14, priceCents: 12000, status: 'performed' },
  { id: 'li-2', description: 'Scaling', priceCents: 8000, status: 'verified' },
];

// All non-billable (diagnosed/planned) — the "₱6,300 + Pay button over planned
// work that 422s" bug (billing-audit-2026-06-27 G3/G4).
const NON_BILLABLE_ITEMS: PaymentLineItem[] = [
  { id: 'li-1', description: 'Periodic oral eval', cdtCode: 'D0120', toothNumber: 38, priceCents: 80000, status: 'diagnosed' },
  { id: 'li-2', description: 'Resin composite', cdtCode: 'D2392', toothNumber: 17, priceCents: 450000, status: 'planned' },
];

// One billable, one planned — subtotal must reflect only the billable row.
const MIXED_ITEMS: PaymentLineItem[] = [
  { id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 14, priceCents: 12000, status: 'performed' },
  { id: 'li-2', description: 'Crown (planned)', cdtCode: 'D2740', toothNumber: 19, priceCents: 90000, status: 'planned' },
];

const INVOICE = {
  id: 'inv-1',
  invoiceNumber: 'INV-001',
  patientId: 'pat-1',
  visitId: 'visit-1',
  subtotalCents: 20000,
  discountCents: 0,
  taxCents: 0,
  totalCents: 20000,
  paidCents: 0,
  balanceCents: 20000,
  status: 'draft',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lineItems: [
    { id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 14, priceCents: 12000, status: 'pending' },
    { id: 'li-2', description: 'Scaling', priceCents: 8000, status: 'done' },
  ],
  payments: [],
};

/** Wrap array in SDK list envelope (matches OpenAPI paginated response) */
function invoiceListResponse(invoices: (typeof INVOICE)[] = []) {
  return jsonResponse({
    data: invoices,
    pagination: { offset: 0, limit: 50, count: invoices.length, totalCount: invoices.length, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
  });
}

function renderModal(props: Partial<React.ComponentProps<typeof WorkspacePaymentModal>> = {}) {
  const qc = freshClientWithMutations();
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
    // Default: no existing invoices (SDK list envelope)
    mockFetch.mockImplementation(() => invoiceListResponse([]));
    // QA-004 + QA-008: the invoice list query is gated on branchId, and invoice
    // creation requires branchId + dentistMemberId from org context. Seed them so
    // the modal's data flows (without this the query stays disabled → no banner).
    useOrgContextStore.setState({ branchId: 'branch-1', memberId: 'member-1' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
    mockFetch.mockReset();
    useOrgContextStore.setState({ branchId: null, memberId: null });
  });

  it('does not render when open=false', () => {
    renderModal({ open: false });
    expect(screen.queryByTestId('workspace-payment-modal')).toBeNull();
  });

  it('renders modal with header when open=true', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /payment/i })).not.toBeNull();
    expect(screen.getByText('Payment')).not.toBeNull();
    expect(screen.getByText('John Doe')).not.toBeNull();
  });

  it('renders all line items', async () => {
    renderModal();
    expect(screen.getByTestId('line-item-li-1')).not.toBeNull();
    expect(screen.getByTestId('line-item-li-2')).not.toBeNull();
    expect(screen.getByText('Composite Filling')).not.toBeNull();
    expect(screen.getByText('Scaling')).not.toBeNull();
  });

  it('shows correct subtotal (PAY-01)', async () => {
    renderModal();
    // 120 + 80 = 200.00
    const row = screen.getByTestId('subtotal-row');
    expect(row).not.toBeNull();
    const amount = screen.getByTestId('subtotal-amount');
    expect(amount.textContent).toContain('200');
  });

  it('shows "Create Invoice" button when no invoice exists (PAY-01)', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('create-invoice-btn')).not.toBeNull();
    });
  });

  it('shows invoice banner when invoice exists (PAY-02)', async () => { // [BR-012]
    mockFetch.mockImplementation(() => invoiceListResponse([INVOICE]));

    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('invoice-banner')).not.toBeNull();
    });
    expect(screen.getByText('INV-001')).not.toBeNull();
  });

  it('shows "Record Payment" when invoice exists (PAY-01)', async () => {
    mockFetch.mockImplementation(() => invoiceListResponse([INVOICE]));

    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('open-invoice-detail-btn')).not.toBeNull();
    });
  });

  it('shows View Invoice link (PAY-02)', async () => {
    mockFetch.mockImplementation(() => invoiceListResponse([INVOICE]));

    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('view-invoice-btn')).not.toBeNull();
    });
  });

  it('calls onClose when backdrop clicked', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    renderModal({ onClose });
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button clicked', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    renderModal({ onClose });
    await user.click(screen.getByLabelText('Close payment modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Create Invoice" button is disabled with no line items', async () => { // [BR-009]
    renderModal({ lineItems: [] });
    await waitFor(() => {
      const btn = screen.getByTestId('create-invoice-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  it('creates invoice when "Create Invoice" clicked (PAY-01)', async () => {
    const user = userEvent.setup();
    let callCount = 0;
    mockFetch.mockImplementation((input: Request | string) => {
      callCount++;
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : 'GET';
      // POST → create invoice
      if (method === 'POST') return jsonResponse(INVOICE);
      // GET single invoice (InvoiceDetail)
      if (url.includes('/dental/billing/invoices/inv-1')) return jsonResponse(INVOICE);
      // GET list → empty first, then with invoice after create
      if (callCount <= 1) return invoiceListResponse([]);
      return invoiceListResponse([INVOICE]);
    });

    renderModal();
    await waitFor(() => {
      const btn = screen.getByTestId('create-invoice-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    await user.click(screen.getByTestId('create-invoice-btn'));
    await waitFor(() => {
      const calls = mockFetch.mock.calls as [Request | string, RequestInit?][];
      const postCall = calls.find(([input]) => {
        if (input instanceof Request) return input.method === 'POST';
        return false;
      });
      expect(postCall).not.toBeNull();
    });
  });

  it('subtotal reflects only billable rows; non-billable rows shown as context (G3)', async () => {
    renderModal({ lineItems: MIXED_ITEMS });
    // Both rows visible (planned row is context, not hidden)…
    expect(screen.getByTestId('line-item-li-1')).not.toBeNull();
    expect(screen.getByTestId('line-item-li-2')).not.toBeNull();
    // …but the payable subtotal is the billable row only (₱120.00), not ₱1,020.00.
    const amount = screen.getByTestId('subtotal-amount');
    expect(amount.textContent).toContain('120');
    expect(amount.textContent).not.toContain('1,020');
  });

  it('planned-only visit: no payable subtotal, deposit panel + enabled Collect Deposit (no dead-end, G4)', async () => {
    renderModal({ lineItems: NON_BILLABLE_ITEMS });
    await waitFor(() => {
      // No payable subtotal advertised for planned-only work (no post-click 422)…
      expect(screen.queryByTestId('subtotal-row')).toBeNull();
      // …and the old dead-end (disabled Create Invoice) is replaced by a REAL
      // action: collect a deposit against the estimate (§g).
      expect(screen.getByTestId('deposit-panel')).not.toBeNull();
      expect((screen.getByTestId('collect-deposit-btn') as HTMLButtonElement).disabled).toBe(false);
    });
    // Planned rows are still shown as context; no dead disabled Create-Invoice CTA.
    expect(screen.getByTestId('line-item-li-1')).not.toBeNull();
    expect(screen.queryByTestId('create-invoice-btn')).toBeNull();
  });

  it('shows an Estimate total for planned work, distinct from the payable Subtotal (item 11)', async () => {
    // performed ₱120 (billable) + planned ₱900 (estimate)
    renderModal({ lineItems: MIXED_ITEMS });
    const subtotal = screen.getByTestId('subtotal-amount');
    expect(subtotal.textContent).toContain('120'); // payable
    const estimate = screen.getByTestId('estimate-amount');
    expect(estimate.textContent).toContain('900'); // planned, NOT in subtotal
    // The estimate is explicitly not payable.
    expect(screen.getByTestId('estimate-row').textContent ?? '').toMatch(/estimate|not.*payable/i);
  });

  it('estimate-only visit: Estimate total shown, no payable Subtotal, Collect Deposit defaults to full estimate (§g)', async () => {
    // diagnosed ₱800 + planned ₱4,500 = ₱5,300 estimate, nothing billable
    renderModal({ lineItems: NON_BILLABLE_ITEMS });
    await waitFor(() => {
      expect(screen.getByTestId('estimate-amount').textContent).toContain('5,300');
      expect(screen.queryByTestId('subtotal-row')).toBeNull();
      const btn = screen.getByTestId('collect-deposit-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      // Default deposit = pay-in-full (the whole estimate).
      expect(btn.textContent).toContain('5,300');
    });
  });

  it('Full estimate button fills the deposit input with the estimate total (§g DQ1)', async () => {
    const user = userEvent.setup();
    renderModal({ lineItems: NON_BILLABLE_ITEMS });
    const input = (await screen.findByTestId('deposit-amount-input')) as HTMLInputElement;
    await user.click(screen.getByTestId('deposit-full-estimate-btn'));
    expect(input.value).toBe('5300.00');
  });

  it('Collect Deposit POSTs to /invoices/deposit then opens the deposit invoice for payment (§g)', async () => {
    const user = userEvent.setup();
    const DEPOSIT_INV = { ...INVOICE, id: 'inv-dep', invoiceNumber: 'INV-DEP', kind: 'deposit', status: 'issued', totalCents: 530000, balanceCents: 530000 };
    mockFetch.mockImplementation((input: Request | string) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : 'GET';
      if (method === 'POST' && url.includes('/invoices/deposit')) return jsonResponse(DEPOSIT_INV);
      if (url.includes('/dental/billing/invoices/inv-dep')) return jsonResponse(DEPOSIT_INV);
      return invoiceListResponse([]);
    });
    renderModal({ lineItems: NON_BILLABLE_ITEMS });
    await waitFor(() => expect((screen.getByTestId('collect-deposit-btn') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('collect-deposit-btn'));
    await waitFor(() => {
      const calls = mockFetch.mock.calls as [Request | string, RequestInit?][];
      const depositPost = calls.find(([input]) => input instanceof Request && input.method === 'POST' && input.url.includes('/invoices/deposit'));
      expect(depositPost).not.toBeUndefined();
    });
  });

  it('shows empty state when no line items and no invoice', async () => {
    renderModal({ lineItems: [] });
    await waitFor(() => {
      // Subtotal row should not be visible
      expect(screen.queryByTestId('subtotal-row')).toBeNull();
    });
  });

  it('ignores an invoice that belongs to a DIFFERENT visit — bills the CURRENT visit instead (item 11)', async () => {
    // Regression: the modal used the patient's latest invoice across ALL visits, so
    // a prior visit's paid invoice surfaced on the current (unbilled) visit — a
    // dead-end "Record Payment" on the wrong invoice + a Paid banner contradicting
    // the current visit's pending line items. Scope the invoice to props.visitId.
    const priorVisitInvoice = {
      ...INVOICE,
      id: 'inv-prior',
      invoiceNumber: 'INV-PRIOR',
      visitId: 'visit-OTHER',
      status: 'paid',
      paidCents: 350000,
      balanceCents: 0,
    };
    mockFetch.mockImplementation(() => invoiceListResponse([priorVisitInvoice]));

    renderModal({ visitId: 'visit-1' });
    await waitFor(() => {
      // No banner for the other visit's invoice…
      expect(screen.queryByTestId('invoice-banner')).toBeNull();
      // …and the current visit's create-invoice path is offered (no dead-end).
      expect(screen.getByTestId('create-invoice-btn')).not.toBeNull();
    });
    // The stale invoice number must not appear anywhere in the modal.
    expect(screen.queryByText('INV-PRIOR')).toBeNull();
  });

  it('filters out voided invoices when determining active invoice (PAY-02) [BR-011] [BR-012]', async () => {
    // A voided invoice should not be shown as the active invoice
    const voidedInvoice = { ...INVOICE, id: 'inv-voided', status: 'voided' };
    mockFetch.mockImplementation(() => invoiceListResponse([voidedInvoice]));

    renderModal();
    await waitFor(() => {
      // No invoice banner — voided invoice is filtered out
      expect(screen.queryByTestId('invoice-banner')).toBeNull();
      // Create Invoice button should appear since no active invoice
      expect(screen.getByTestId('create-invoice-btn')).not.toBeNull();
    });
  });
});
