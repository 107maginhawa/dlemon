/**
 * Tests for use-workspace-payment hooks
 *
 * Covers: PAY-01 (create invoice), PAY-02 (view invoice status)
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { usePatientInvoices, useCreateInvoice } from './use-workspace-payment';
import { makeWrapper, jsonResponse } from '@/test-utils';

const _toastError = mock(() => {});
mock.module('sonner', () => ({ toast: { error: _toastError } }));

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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    qc.clear();
  });

  it('is disabled when patientId is null', () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => usePatientInvoices(null), { wrapper });
    expect(result.current.isFetching).toBe(false);
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    qc.clear();
  });

  it('POSTs to /dental/billing/invoices (PAY-01)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(INVOICE), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });

    result.current.mutate({ patientId: 'pat-1', visitId: 'visit-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const req = mockFetch.mock.calls[0]![0] as Request | string;
    const url = req instanceof Request ? req.url : String(req);
    expect(url).toContain('/dental/billing/invoices');
    // Method is on the Request object when SDK sends a Request
    if (req instanceof Request) {
      expect(req.method).toBe('POST');
    }
  });

  it('returns created invoice', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(INVOICE), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ patientId: 'pat-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('inv-1');
  });

  it('sets isError on API failure', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 422, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ patientId: 'pat-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('V-FE-ERR-001: surfaces a toast on create failure', async () => {
    const callsBefore = _toastError.mock.calls.length;
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 422, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ patientId: 'pat-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(_toastError.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
