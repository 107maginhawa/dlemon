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
// Contract regression — REAL live API shape (QA_ESCAPES §6 roll-out)
//
// Ground-truthed against GET /dental/billing/invoices/:invoiceId (2026-06-04).
// The detail endpoint returns the bare DentalInvoice (taxCents/taxRate/dueDate/…)
// PLUS enrichments the SDK does not model: outstandingCents, patientName,
// visitDate, lineItems (amountCents AND priceCents), payments. Because these
// enrichments bypass the SDK date transformer, their timestamps stay ISO
// STRINGS at runtime — the detail sheet's formatDate() depends on that.
// ---------------------------------------------------------------------------

// Mirrors the live response field-for-field (see oli/docs/roadmap/QA_ESCAPES.md §2 QA-007 class).
const realInvoice = {
  id: 'db798b31-c6b7-43e9-841d-593b25300ec9',
  createdAt: '2026-06-03T23:06:07.157Z',
  updatedAt: '2026-06-03T23:06:07.157Z',
  visitId: '8c9dc7e3-0fe2-42a1-a3a3-7432815575fa',
  patientId: '7e2c5726-ccbe-4fce-a0d3-87cd4af0853c',
  branchId: 'e17678dd-bb19-4c4a-9b72-ad4cd8e7d37c',
  dentistMemberId: 'f95d2bab-a72f-417f-a79d-644b23afe13e',
  invoiceNumber: 'INV-2026-548AAE2A',
  status: 'draft',
  subtotalCents: 350000,
  discountCents: 0,
  taxCents: 0,
  taxRate: '0.0000',
  totalCents: 350000,
  paidCents: 0,
  balanceCents: 350000,
  dueDate: null,
  issuedAt: null,
  paidAt: null,
  voidedAt: null,
  outstandingCents: 350000,
  patientName: 'Juan dela Cruz',
  visitDate: '2026-06-03',
  lineItems: [
    {
      id: '8606091a-5df3-4e70-9373-8fc03d656985',
      invoiceId: 'db798b31-c6b7-43e9-841d-593b25300ec9',
      treatmentId: 'c4504775-c55b-4c50-8b8a-9b0267dfdde6',
      cdtCode: 'D0120',
      description: 'Periodic oral evaluation',
      unitPriceCents: 100000,
      quantity: 1,
      amountCents: 100000,
      priceCents: 100000,
    },
  ],
  payments: [
    {
      id: 'pay-real-1',
      invoiceId: 'db798b31-c6b7-43e9-841d-593b25300ec9',
      amountCents: 150000,
      method: 'gcash',
      createdAt: '2026-06-04T09:30:00.000Z',
    },
  ],
};

describe('useInvoiceDetail — real API shape (contract regression)', () => {
  test('surfaces SDK-modeled fields AND the unmodeled enrichments', async () => {
    global.fetch = mock(() => jsonResponse(realInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('db798b31-c6b7-43e9-841d-593b25300ec9'), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const inv = result.current.invoice!;
    // SDK-modeled
    expect(inv.invoiceNumber).toBe('INV-2026-548AAE2A');
    expect(inv.balanceCents).toBe(350000);
    expect(inv.status).toBe('draft');
    // Enrichments the SDK omits (would be undefined if we'd naively consumed the bare SDK type)
    expect(inv.outstandingCents).toBe(350000);
    expect(inv.patientName).toBe('Juan dela Cruz');
    expect(inv.visitDate).toBe('2026-06-03');
  });

  test('lineItem carries both amountCents and the backend-mapped priceCents', async () => {
    global.fetch = mock(() => jsonResponse(realInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('db798b31-c6b7-43e9-841d-593b25300ec9'), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const item = result.current.invoice!.lineItems[0]!;
    expect(item.amountCents).toBe(100000);
    expect(item.priceCents).toBe(100000);
  });

  test('payment.createdAt is an ISO STRING (enrichment bypasses the SDK date transformer)', async () => {
    global.fetch = mock(() => jsonResponse(realInvoice));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoiceDetail('db798b31-c6b7-43e9-841d-593b25300ec9'), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const pay = result.current.invoice!.payments[0]!;
    // formatDate(payment.createdAt) in invoice-detail-sheet.tsx requires a string.
    expect(typeof pay.createdAt).toBe('string');
    // Dental method union is wider than the generated PaymentMethod enum.
    expect(pay.method).toBe('gcash');
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
