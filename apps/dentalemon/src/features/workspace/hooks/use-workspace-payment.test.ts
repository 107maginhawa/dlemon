/**
 * Tests for use-workspace-payment hooks
 *
 * Covers: PAY-01 (create invoice), PAY-02 (view invoice status)
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { usePatientInvoices, useCreateInvoice } from './use-workspace-payment';
import { useOrgContextStore } from '@/stores/org-context.store';
import { makeWrapper, jsonResponse } from '@/test-utils';

const _toastError = mock(() => {});
mock.module('sonner', () => ({ toast: { error: _toastError, success: mock(() => {}) } }));

const originalFetch = global.fetch;
const mockFetch = mock(() => jsonResponse([]));

const INVOICE = {
  id: 'inv-1',
  invoiceNumber: 'INV-001',
  patientId: 'pat-1',
  patientName: 'John Doe',
  totalCents: 150000,
  paidCents: 0,
  balanceCents: 150000,
  status: 'draft',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('usePatientInvoices', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    // QA-004: the invoices query is gated on branchId (the endpoint 400s without
    // it). Seed org context so the query fires in these tests.
    useOrgContextStore.setState({ branchId: 'branch-1' });
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    qc.clear();
    useOrgContextStore.setState({ branchId: null });
  });

  it('is disabled when patientId is null', () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => usePatientInvoices(null), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('is disabled when branchId is missing (would 400) [QA-004]', () => {
    useOrgContextStore.setState({ branchId: null });
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => usePatientInvoices('pat-1'), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('includes branchId in query URL [QA-004 contract: required request param]', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const wrapper = makeWrapper(qc);
    renderHook(() => usePatientInvoices('pat-1'), { wrapper });
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const req = mockFetch.mock.calls[0]![0] as Request | string;
    const url = req instanceof Request ? req.url : String(req);
    // Pre-fix the hook omitted branchId → the real backend 400s "branchId is required".
    expect(url).toContain('branchId=branch-1');
  });

  it('fetches invoices for patient (PAY-02)', async () => {
    // SDK transformer expects { data: [...] } shape
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [INVOICE] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => usePatientInvoices('pat-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].invoiceNumber).toBe('INV-001');
    expect(result.current.data![0].status).toBe('draft');
  });

  it('includes patientId in query URL', async () => {
    // SDK transformer expects { data: [...] } shape
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    renderHook(() => usePatientInvoices('pat-99'), { wrapper });
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const req = mockFetch.mock.calls[0]![0] as Request | string;
    const url = req instanceof Request ? req.url : String(req);
    expect(url).toContain('patientId=pat-99');
  });

  it('handles invoices wrapper response', async () => {
    // SDK transformer expects { data: [...] } shape (the select fn handles both shapes)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [INVOICE] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => usePatientInvoices('pat-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('sets isError on failure', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 401, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => usePatientInvoices('pat-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateInvoice', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    // G-08: useCreateInvoice now create→issue (two requests). Default any call to a
    // 200 INVOICE so the chained issue resolves; per-test mockResolvedValueOnce still
    // governs the first (create) call.
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(INVOICE), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    // QA-008: POST /dental/billing/invoices requires branchId + dentistMemberId
    // (sourced from org context inside the hook). Seed them so the request fires.
    useOrgContextStore.setState({ branchId: 'branch-1', memberId: 'member-1' });
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    qc.clear();
    useOrgContextStore.setState({ branchId: null, memberId: null });
  });

  it('POSTs to /dental/billing/invoices (PAY-01)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(INVOICE), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });

    result.current.mutate({ visitId: 'visit-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const req = mockFetch.mock.calls[0]![0] as Request | string;
    const url = req instanceof Request ? req.url : String(req);
    expect(url).toContain('/dental/billing/invoices');
    if (req instanceof Request) {
      expect(req.method).toBe('POST');
    }
  });

  it('QA-008: POST body carries the required branchId + dentistMemberId (contract regression)', async () => {
    let capturedBody: Record<string, unknown> = {};
    mockFetch.mockImplementationOnce(async (req: Request | string) => {
      if (req instanceof Request) capturedBody = await req.clone().json();
      return new Response(JSON.stringify(INVOICE), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ visitId: 'visit-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Pre-fix the body was only { patientId, visitId } behind an `as any`, so the
    // backend 400'd "branchId/dentistMemberId required" — the button always failed.
    expect(capturedBody.patientId).toBe('pat-1');
    expect(capturedBody.visitId).toBe('visit-1');
    expect(capturedBody.branchId).toBe('branch-1');
    expect(capturedBody.dentistMemberId).toBe('member-1');
  });

  it('QA-008: errors instead of POSTing when org context is missing', async () => {
    useOrgContextStore.setState({ branchId: null, memberId: null });
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ visitId: 'visit-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns created invoice', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(INVOICE), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ visitId: 'visit-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('inv-1');
  });

  it('sets isError on API failure', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 422, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ visitId: 'visit-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('G-08: issues the invoice immediately so "Create Invoice & Pay" lands on a payable invoice', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    mockFetch.mockImplementation(async (req: Request | string) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : 'GET';
      calls.push({ url, method });
      return new Response(JSON.stringify(INVOICE), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ visitId: 'visit-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // create POST, then issue PATCH on the new invoice — recordDentalPayment rejects
    // 'draft', so without the issue the CTA over-promised one-step payment.
    expect(calls.some(c => c.method === 'POST' && c.url.includes('/dental/billing/invoices'))).toBe(true);
    expect(calls.some(c => c.method === 'PATCH' && c.url.includes('/dental/billing/invoices/inv-1/issue'))).toBe(true);
    // still returns the invoice id the modal opens
    expect(result.current.data?.id).toBe('inv-1');
  });

  it('V-FE-ERR-001: surfaces a toast on create failure', async () => {
    const callsBefore = _toastError.mock.calls.length;
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 422, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ visitId: 'visit-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(_toastError.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
