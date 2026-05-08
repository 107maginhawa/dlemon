/**
 * useInvoices — unit tests
 *
 * TanStack Query hook for the billing invoice list.
 * Replaces inline fetch in billing-list.tsx.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useInvoices } from './use-invoices';

afterEach(cleanup);

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

const mockInvoices = [
  { id: 'inv1', invoiceNumber: 'INV-001', patientId: 'p1', patientName: 'Maria Santos', totalCents: 50000, paidCents: 0, balanceCents: 50000, status: 'issued', createdAt: '2026-05-01T00:00:00Z' },
  { id: 'inv2', invoiceNumber: 'INV-002', patientId: 'p2', patientName: 'Ramon Cruz', totalCents: 20000, paidCents: 20000, balanceCents: 0, status: 'paid', createdAt: '2026-05-02T00:00:00Z' },
];

describe('useInvoices', () => {
  test('starts in loading state', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(
      () => useInvoices({}),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isLoading).toBe(true);
  });

  test('returns invoices on success', async () => {
    global.fetch = mock(() => jsonResponse(mockInvoices));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoices({}), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoices).toHaveLength(2);
    expect(result.current.invoices[0]?.id).toBe('inv1');
  });

  test('includes status param in URL when provided', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse([]);
    });
    const qc = freshClient();
    const { result } = renderHook(() => useInvoices({ status: 'overdue' }), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('status=overdue');
  });

  test('includes branchId param in URL when provided', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse([]);
    });
    const qc = freshClient();
    const { result } = renderHook(() => useInvoices({ branchId: 'b1' }), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('branchId=b1');
  });

  test('omits status param when not provided', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse([]);
    });
    const qc = freshClient();
    const { result } = renderHook(() => useInvoices({}), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).not.toContain('status=');
  });

  test('sets error when fetch fails', async () => {
    global.fetch = mock(() => jsonResponse({}, 500));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoices({}), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  test('refetch function is defined', async () => {
    global.fetch = mock(() => jsonResponse([]));
    const qc = freshClient();
    const { result } = renderHook(() => useInvoices({}), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });
});
