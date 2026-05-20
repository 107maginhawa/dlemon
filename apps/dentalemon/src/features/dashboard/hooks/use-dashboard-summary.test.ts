/**
 * useDashboardSummary — unit tests
 *
 * Consolidates the 5 parallel fetches from MorningBriefing into a single
 * TanStack Query hook. Tests loading, success, error, and financial-role gating.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useDashboardSummary } from './use-dashboard-summary';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const mockToday = [
  { id: 'a1', patientId: 'p1', patientName: 'Maria Santos', scheduledAt: '2026-05-04T09:00:00Z', status: 'scheduled' },
  { id: 'a2', patientId: 'p2', patientName: 'Ramon Cruz', scheduledAt: '2026-05-04T10:00:00Z', status: 'completed' },
];
const mockTomorrow = [
  { id: 'a3', patientId: 'p3', patientName: 'Ana Reyes', scheduledAt: '2026-05-05T09:00:00Z', status: 'scheduled' },
];
const mockSummary = { activePaymentPlans: { count: 3, behindCount: 1 }, labOrders: { totalPending: 2, overdueDelivery: 1 } };
const mockOverdue = [
  { id: 'i1', invoiceNumber: 'INV-001', patientId: 'p1', patientName: 'Maria Santos', totalCents: 50000, paidCents: 0, balanceCents: 50000, status: 'overdue' },
];
const mockAllInvoices = [
  { id: 'i2', invoiceNumber: 'INV-002', patientId: 'p2', totalCents: 20000, paidCents: 20000, balanceCents: 0, status: 'paid', createdAt: new Date().toISOString() },
];

function makeFetch(responses: any[]) {
  let callIdx = 0;
  return mock(() => {
    const resp = responses[callIdx++ % responses.length];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(resp) } as Response);
  });
}

describe('useDashboardSummary', () => {
  test('starts in loading state', () => {
    global.fetch = mock(() => new Promise(() => {})); // never resolves
    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isLoading).toBe(true);
  });

  test('returns today and tomorrow appointments on success (non-financial)', async () => {
    global.fetch = makeFetch([
      { appointments: mockToday },
      { appointments: mockTomorrow },
      mockSummary,
    ]);

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.todayAppointments).toHaveLength(2);
    expect(result.current.data?.tomorrowAppointments).toHaveLength(1);
  });

  test('returns summary metrics (activePaymentPlans, pendingLabOrders)', async () => {
    global.fetch = makeFetch([
      { appointments: mockToday },
      { appointments: mockTomorrow },
      mockSummary,
    ]);

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.activePaymentPlans).toBe(3);
    expect(result.current.data?.paymentPlansBehind).toBe(1);
    expect(result.current.data?.pendingLabOrders).toBe(2);
    expect(result.current.data?.overdueLabOrders).toBe(1);
  });

  test('returns overdue invoices and daily collections for financial roles', async () => {
    global.fetch = makeFetch([
      { appointments: mockToday },
      { appointments: mockTomorrow },
      mockSummary,
      { invoices: mockOverdue },
      { invoices: mockAllInvoices },
    ]);

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: true }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.overdueInvoices).toHaveLength(1);
    expect(result.current.data?.overdueInvoices[0]?.balanceCents).toBe(50000);
    // Daily collections: 1 paid invoice today (20000 paidCents)
    expect(result.current.data?.dailyCollectionsCents).toBe(20000);
  });

  test('returns empty overdueInvoices and null dailyCollections when showFinancials=false', async () => {
    global.fetch = makeFetch([
      { appointments: mockToday },
      { appointments: mockTomorrow },
      mockSummary,
    ]);

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.overdueInvoices).toHaveLength(0);
    expect(result.current.data?.dailyCollectionsCents).toBeNull();
  });

  test('accepts array response (not wrapped in appointments key)', async () => {
    global.fetch = makeFetch([
      mockToday,    // bare array
      mockTomorrow, // bare array
      mockSummary,
    ]);

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.todayAppointments).toHaveLength(2);
  });

  test('sets error state when appointment fetch fails', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  test('sets error state when summary fetch (response[2]) fails', async () => {
    let callIdx = 0;
    global.fetch = mock(() => {
      const i = callIdx++;
      if (i < 2) {
        // today and tomorrow appointments succeed
        const data = i === 0 ? { appointments: mockToday } : { appointments: mockTomorrow };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);
      }
      // summary endpoint fails
      return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) } as Response);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect((result.current.error as Error).message).toMatch(/dashboard summary/);
  });

  test('sets error state when overdue invoices fetch (response[3]) fails', async () => {
    let callIdx = 0;
    global.fetch = mock(() => {
      const i = callIdx++;
      const successes = [
        { appointments: mockToday },
        { appointments: mockTomorrow },
        mockSummary,
      ];
      if (i < 3) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(successes[i]) } as Response);
      }
      // overdue invoices endpoint fails
      return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) } as Response);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: true }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect((result.current.error as Error).message).toMatch(/overdue invoices/);
  });

  test('sets error state when all-invoices fetch (response[4]) fails', async () => {
    let callIdx = 0;
    global.fetch = mock(() => {
      const i = callIdx++;
      const successes = [
        { appointments: mockToday },
        { appointments: mockTomorrow },
        mockSummary,
        { invoices: mockOverdue },
      ];
      if (i < 4) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(successes[i]) } as Response);
      }
      // all-invoices endpoint fails
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: true }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect((result.current.error as Error).message).toMatch(/all invoices/);
  });

  test('refetch function is defined', async () => {
    global.fetch = makeFetch([
      { appointments: mockToday },
      { appointments: mockTomorrow },
      mockSummary,
    ]);

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });
});
