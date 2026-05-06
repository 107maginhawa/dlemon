/**
 * Tests for use-workspace-payment hooks
 *
 * Covers: PAY-01 (create invoice), PAY-02 (view invoice status)
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { usePatientInvoices, useCreateInvoice } from './use-workspace-payment';

const mockFetch = mock(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
);

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

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
    qc.clear();
  });

  it('is disabled when patientId is null', () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => usePatientInvoices(null), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('fetches invoices for patient (PAY-02)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([INVOICE]),
    } as any);

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => usePatientInvoices('pat-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].invoiceNumber).toBe('INV-001');
    expect(result.current.data![0].status).toBe('draft');
  });

  it('includes patientId in query URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    } as any);

    const wrapper = makeWrapper(qc);
    renderHook(() => usePatientInvoices('pat-99'), { wrapper });
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const url = (mockFetch.mock.calls[0] as [string])[0];
    expect(url).toContain('patientId=pat-99');
  });

  it('handles invoices wrapper response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invoices: [INVOICE] }),
    } as any);

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => usePatientInvoices('pat-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('sets isError on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 } as any);

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
    qc.clear();
  });

  it('POSTs to /dental/billing/invoices (PAY-01)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(INVOICE),
    } as any);

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });

    result.current.mutate({ patientId: 'pat-1', visitId: 'visit-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/dental/billing/invoices');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body as string);
    expect(body.patientId).toBe('pat-1');
    expect(body.visitId).toBe('visit-1');
  });

  it('returns created invoice', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(INVOICE),
    } as any);

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ patientId: 'pat-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('inv-1');
  });

  it('sets isError on API failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 } as any);

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCreateInvoice('pat-1'), { wrapper });
    result.current.mutate({ patientId: 'pat-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
