/**
 * useInvoiceDetail — unit tests
 *
 * RPT-01: hook is enabled when invoiceId provided (row click → drilldown)
 * RPT-02: returns lineItems and payments for the detail sheet
 *
 * API: GET /dental/billing/invoices/:invoiceId
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useInvoiceDetail } from './use-invoice-detail';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const mockInvoice = {
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
    {
      id: 'li2',
      invoiceId: 'inv1',
      cdtCode: 'D2710',
      description: 'Crown - PFM',
      priceCents: 1400000,
      amountCents: 1400000,
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

// ---------------------------------------------------------------------------
// Disabled state (RPT-01 — sheet closed)
// ---------------------------------------------------------------------------

describe('useInvoiceDetail — disabled when invoiceId is null', () => {
  test('returns null invoice without fetching when invoiceId is null', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail(null), { wrapper: makeWrapper(qc) });
    expect(result.current.invoice).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('useInvoiceDetail — loading state', () => {
  test('isLoading is true while fetch is pending', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.invoice).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Success state (RPT-01 + RPT-02)
// ---------------------------------------------------------------------------

describe('useInvoiceDetail — successful fetch (RPT-01)', () => {
  test('returns invoice with correct id and invoiceNumber', async () => {
    global.fetch = mock(() => jsonResponse(mockInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoice).not.toBeNull();
    expect(result.current.invoice!.id).toBe('inv1');
    expect(result.current.invoice!.invoiceNumber).toBe('INV-2026-001');
  });

  test('includes invoiceId in the fetch URL', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse(mockInvoice);
    });
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('inv1');
  });

  test('error is null on success', async () => {
    global.fetch = mock(() => jsonResponse(mockInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Line items (RPT-02 drilldown)
// ---------------------------------------------------------------------------

describe('useInvoiceDetail — lineItems (RPT-02)', () => {
  test('returns lineItems array with correct length', async () => {
    global.fetch = mock(() => jsonResponse(mockInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoice!.lineItems).toHaveLength(2);
  });

  test('lineItem has cdtCode and description', async () => {
    global.fetch = mock(() => jsonResponse(mockInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const item = result.current.invoice!.lineItems[0]!;
    expect(item.cdtCode).toBe('D0120');
    expect(item.description).toBe('Periodic Exam');
  });

  test('lineItem has amountCents', async () => {
    global.fetch = mock(() => jsonResponse(mockInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoice!.lineItems[0]!.amountCents).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// Payment history (RPT-02 payment history)
// ---------------------------------------------------------------------------

describe('useInvoiceDetail — payments (RPT-02)', () => {
  test('returns payments array with correct length', async () => {
    global.fetch = mock(() => jsonResponse(mockInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoice!.payments).toHaveLength(1);
  });

  test('payment has method and amountCents', async () => {
    global.fetch = mock(() => jsonResponse(mockInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const pay = result.current.invoice!.payments[0]!;
    expect(pay.method).toBe('card');
    expect(pay.amountCents).toBe(1100000);
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('useInvoiceDetail — error state', () => {
  test('returns error and null invoice on non-ok response', async () => {
    global.fetch = mock(() => jsonResponse({ error: 'not found' }, 404));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.invoice).toBeNull();
  });

  test('error is set on server error response', async () => {
    global.fetch = mock(() => jsonResponse({ error: 'Internal Server Error', statusCode: 500 }, 500));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('inv1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.invoice).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Re-enable when null→string (RPT-01 row click)
// ---------------------------------------------------------------------------

describe('useInvoiceDetail — null→id transition', () => {
  test('does not fetch while null, fetches once after id set', async () => {
    let fetchCount = 0;
    global.fetch = mock(() => {
      fetchCount++;
      return jsonResponse(mockInvoice);
    });
    const qc = freshClient();
    let invoiceId: string | null = null;
    const { result, rerender } = renderHook(
      () => useInvoiceDetail(invoiceId),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isLoading).toBe(false);
    expect(fetchCount).toBe(0);

    invoiceId = 'inv1';
    rerender();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchCount).toBe(1);
    expect(result.current.invoice!.id).toBe('inv1');
  });
});
