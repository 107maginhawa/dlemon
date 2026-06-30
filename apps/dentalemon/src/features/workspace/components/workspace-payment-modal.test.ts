/**
 * Tests for WorkspacePaymentModal
 *
 * Covers: PAY-01 (initiate payment / create invoice), PAY-02 (view status), and the
 * billable-vs-estimate coherence invariant (BR-009): only performed|verified are
 * payable; an all-planned visit must NOT present an enabled Pay that 422s.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { WorkspacePaymentModal, type PaymentLineItem } from './workspace-payment-modal';
import { useOrgContextStore } from '@/stores/org-context.store';
import { jsonResponse, freshClientWithMutations } from '@/test-utils';

const originalFetch = global.fetch;
const mockFetch = mock(() => jsonResponse({ data: [] }));

// A mixed visit: one performed (billable, ₱120) + one planned (estimate, ₱80).
const LINE_ITEMS: PaymentLineItem[] = [
  { id: 'li-1', description: 'Composite Filling', cdtCode: 'D2391', toothNumber: 14, priceCents: 12000, status: 'performed' },
  { id: 'li-2', description: 'Scaling', priceCents: 8000, status: 'planned' },
];

const PLANNED_ONLY: PaymentLineItem[] = [
  { id: 'p-1', description: 'Resin composite', cdtCode: 'D2330', toothNumber: 17, priceCents: 450000, status: 'planned' },
  { id: 'p-2', description: 'Periodic oral eval', priceCents: 100000, status: 'diagnosed' },
];

const INVOICE = {
  id: 'inv-1',
  invoiceNumber: 'INV-001',
  patientId: 'pat-1',
  visitId: 'visit-1',
  subtotalCents: 12000,
  discountCents: 0,
  taxCents: 0,
  totalCents: 12000,
  paidCents: 0,
  balanceCents: 12000,
  status: 'draft',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lineItems: [],
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
    mockFetch.mockImplementation(() => invoiceListResponse([]));
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

  it('renders billable + estimate line items in separate sections', async () => {
    renderModal();
    expect(screen.getByTestId('line-item-li-1')).not.toBeNull();
    expect(screen.getByTestId('line-item-li-2')).not.toBeNull();
    expect(screen.getByTestId('billable-section')).not.toBeNull();
    expect(screen.getByTestId('estimate-section')).not.toBeNull();
  });

  it('payable subtotal sums only the billable subset (PAY-01) [BR-009]', async () => {
    renderModal();
    // performed ₱120 is payable; planned ₱80 is NOT summed into the payable total.
    const amount = screen.getByTestId('subtotal-amount');
    expect(amount.textContent).toContain('120');
    expect(amount.textContent).not.toContain('200');
    // …and the planned item (₱80.00) shows as an estimate, not in the payable total.
    expect(screen.getByTestId('estimate-total').textContent).toContain('80.00');
  });

  it('shows "Create Invoice & Pay" when something is billable (PAY-01)', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByTestId('create-invoice-btn')).not.toBeNull();
    });
  });

  it('all-planned visit: NO Create-Invoice button (no 422 dead-end), shows estimate + guidance [BR-009]', async () => {
    renderModal({ lineItems: PLANNED_ONLY });
    await waitFor(() => {
      expect(screen.getByTestId('estimate-section')).not.toBeNull();
    });
    // The bug: an enabled "Create Invoice & Pay" that 422s. It must not exist.
    expect(screen.queryByTestId('create-invoice-btn')).toBeNull();
    // No payable subtotal at all.
    expect(screen.queryByTestId('subtotal-row')).toBeNull();
    // Human guidance + a clean exit, not a dead pay button.
    expect(screen.getByTestId('no-billable-note')).not.toBeNull();
    expect(screen.getByTestId('estimate-done-btn')).not.toBeNull();
    // NOT a dead-end: every estimate row offers an in-place forward action
    // (mark performed → becomes billable) so the clinician needn't leave the modal.
    expect(screen.getByTestId('mark-performed-p-1')).not.toBeNull();
    expect(screen.getByTestId('mark-performed-p-2')).not.toBeNull();
  });

  it('estimate state: Mark done is the PRIMARY affordance and Done is a quiet close', async () => {
    // The reported dead-end is a hierarchy bug, not a missing path: the forward
    // action (Mark done) was a faint ghost button buried under a dominant bordered
    // "Done" exit, so the modal read as terminal. Lock the inverted hierarchy:
    // Mark done = filled-lemon primary; Done = low-emphasis close, not a big block.
    renderModal({ lineItems: PLANNED_ONLY });
    const markBtn = await screen.findByTestId('mark-performed-p-1');
    expect(markBtn.className).toContain('bg-lemon'); // forward action = primary CTA

    const doneBtn = screen.getByTestId('estimate-done-btn');
    expect(doneBtn.className).not.toContain('bg-lemon');
    // No longer a full bordered block that out-shouts Mark done.
    expect(doneBtn.className).not.toContain('border-border');
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

  it('no line items at all: empty state, no Create Invoice button [BR-009]', async () => {
    renderModal({ lineItems: [] });
    await waitFor(() => {
      expect(screen.queryByTestId('create-invoice-btn')).toBeNull();
      expect(screen.queryByTestId('subtotal-row')).toBeNull();
      expect(screen.queryByTestId('estimate-section')).toBeNull();
      // A clean exit is still offered.
      expect(screen.getByTestId('estimate-done-btn')).not.toBeNull();
    });
  });

  it('creates invoice when "Create Invoice & Pay" clicked (PAY-01)', async () => {
    const user = userEvent.setup();
    let callCount = 0;
    mockFetch.mockImplementation((input: Request | string) => {
      callCount++;
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : 'GET';
      if (method === 'POST') return jsonResponse(INVOICE);
      if (url.includes('/dental/billing/invoices/inv-1')) return jsonResponse(INVOICE);
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
      const postCall = calls.find(([input]) => input instanceof Request && input.method === 'POST');
      expect(postCall).not.toBeNull();
    });
  });

  it('opens straight to the Record-payment form after Create Invoice & Pay (no extra tap)', async () => {
    const user = userEvent.setup();
    const issued = { ...INVOICE, status: 'issued' };
    mockFetch.mockImplementation((input: Request | string) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : 'GET';
      if (method === 'POST') return jsonResponse(issued);
      if (url.includes('/dental/billing/invoices/inv-1')) return jsonResponse(issued);
      return invoiceListResponse([]);
    });

    renderModal();
    await waitFor(() => {
      expect((screen.getByTestId('create-invoice-btn') as HTMLButtonElement).disabled).toBe(false);
    });
    await user.click(screen.getByTestId('create-invoice-btn'));

    // The collect-now path lands directly on the payment form — the Amount field
    // is present without a separate "Record payment" tap.
    await waitFor(() => {
      expect(screen.getByLabelText(/Amount/i)).not.toBeNull();
    });
  });

  it('ignores an invoice that belongs to a DIFFERENT visit — bills the CURRENT visit instead (item 11)', async () => {
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
      expect(screen.queryByTestId('invoice-banner')).toBeNull();
      // billable (performed) exists → the create-invoice path is offered for THIS visit.
      expect(screen.getByTestId('create-invoice-btn')).not.toBeNull();
    });
    expect(screen.queryByText('INV-PRIOR')).toBeNull();
  });

  it('filters out voided invoices when determining active invoice (PAY-02) [BR-011] [BR-012]', async () => {
    const voidedInvoice = { ...INVOICE, id: 'inv-voided', status: 'voided' };
    mockFetch.mockImplementation(() => invoiceListResponse([voidedInvoice]));

    renderModal();
    await waitFor(() => {
      expect(screen.queryByTestId('invoice-banner')).toBeNull();
      expect(screen.getByTestId('create-invoice-btn')).not.toBeNull();
    });
  });
});
