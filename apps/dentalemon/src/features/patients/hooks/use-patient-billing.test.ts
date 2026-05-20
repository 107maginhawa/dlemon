/**
 * usePatientBilling — unit tests (PROF-03)
 *
 * Tests that the hook fetches invoices with patientId filter.
 * Network fetch is mocked via global.fetch override.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { usePatientBilling } from './use-patient-billing';
import type { Invoice } from '../../../features/billing/hooks/use-invoices';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

// ─── usePatientBilling ─────────────────────────────────────────────────────

describe('usePatientBilling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('fetches invoices with patientId query param', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse([]);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatientBilling({ patientId: 'p1', branchId: null }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('patientId=p1');
  });

  test('includes branchId when provided', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse([]);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatientBilling({ patientId: 'p1', branchId: 'br-1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('branchId=br-1');
  });

  test('returns invoices array on success', async () => {
    const mockInvoices: Invoice[] = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        patientId: 'p1',
        patientName: 'Rosa Dela Cruz',
        visitDate: '2026-03-05',
        totalCents: 350000,
        paidCents: 350000,
        balanceCents: 0,
        status: 'paid',
        createdAt: '2026-03-05T10:00:00Z',
      },
    ];

    // API returns paginated shape: { data: [...], pagination: {...} }
    global.fetch = mock(() =>
      jsonResponse({ data: mockInvoices, pagination: { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1 } }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatientBilling({ patientId: 'p1', branchId: null }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.invoices[0]!.invoiceNumber).toBe('INV-001');
  });

  test('handles paginated response shape', async () => {
    const mockInvoices: Invoice[] = [
      {
        id: 'inv-2',
        invoiceNumber: 'INV-002',
        patientId: 'p1',
        totalCents: 150000,
        paidCents: 0,
        balanceCents: 150000,
        status: 'pending',
        createdAt: '2026-04-01T09:00:00Z',
      },
    ];

    // API returns paginated shape: { data: [...], pagination: {...} }
    global.fetch = mock(() =>
      jsonResponse({ data: mockInvoices, pagination: { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1 } }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatientBilling({ patientId: 'p1', branchId: null }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoices).toHaveLength(1);
  });

  test('returns empty array and error on fetch failure', async () => {
    global.fetch = mock(() =>
      jsonResponse({}, 500),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatientBilling({ patientId: 'p1', branchId: null }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoices).toHaveLength(0);
    expect(result.current.error).not.toBeNull();
  });
});
