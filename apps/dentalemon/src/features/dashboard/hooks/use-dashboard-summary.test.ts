/**
 * useDashboardSummary — unit tests
 *
 * Consolidates the 5 parallel fetches from MorningBriefing into a single
 * TanStack Query hook. Tests loading, success, error, and financial-role gating.
 *
 * The SDK calls response.text() on the Response object, so all fetch mocks
 * use proper Response objects via jsonResponse().
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useDashboardSummary } from './use-dashboard-summary';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

// Appointments must have startAt/endAt/createdAt/updatedAt as ISO strings.
// The SDK transformer converts them to Date objects; toAppointment then converts back.
const mockToday = [
  { id: 'a1', patientId: 'p1', patientName: 'Maria Santos', providerId: 'pr1', branchId: 'b1', startAt: '2026-05-04T09:00:00Z', endAt: '2026-05-04T09:30:00Z', status: 'scheduled', visitType: 'checkup', walkIn: false, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z', version: 1 },
  { id: 'a2', patientId: 'p2', patientName: 'Ramon Cruz', providerId: 'pr1', branchId: 'b1', startAt: '2026-05-04T10:00:00Z', endAt: '2026-05-04T10:30:00Z', status: 'completed', visitType: 'cleaning', walkIn: false, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z', version: 1 },
];
const mockTomorrow = [
  { id: 'a3', patientId: 'p3', patientName: 'Ana Reyes', providerId: 'pr1', branchId: 'b1', startAt: '2026-05-05T09:00:00Z', endAt: '2026-05-05T09:30:00Z', status: 'scheduled', visitType: 'checkup', walkIn: false, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z', version: 1 },
];
const mockSummary = { activePaymentPlans: { count: 3, behindCount: 1 }, labOrders: { totalPending: 2, overdueDelivery: 1 } };
// Invoices must have all required DentalInvoice fields including visitId/dentistMemberId/subtotalCents.
// createdAt must be an ISO string the transformer can convert to Date.
const TODAY_ISO = new Date().toISOString();
const mockOverdue = [
  { id: 'i1', invoiceNumber: 'INV-001', patientId: 'p1', visitId: 'v1', branchId: 'b1', dentistMemberId: 'dm1', patientName: 'Maria Santos', subtotalCents: 50000, discountCents: 0, taxCents: 0, taxRate: 0, totalCents: 50000, paidCents: 0, balanceCents: 50000, status: 'overdue', createdAt: TODAY_ISO, updatedAt: TODAY_ISO, version: 1 },
];
const mockAllInvoices = [
  { id: 'i2', invoiceNumber: 'INV-002', patientId: 'p2', visitId: 'v2', branchId: 'b1', dentistMemberId: 'dm1', subtotalCents: 20000, discountCents: 0, taxCents: 0, taxRate: 0, totalCents: 20000, paidCents: 20000, balanceCents: 0, status: 'paid', createdAt: TODAY_ISO, updatedAt: TODAY_ISO, version: 1 },
];

// Helper: rotate through a fixed list of responses
function makeFetch(responses: unknown[]) {
  let callIdx = 0;
  return mock(() => {
    const resp = responses[callIdx++ % responses.length];
    return jsonResponse(resp);
  });
}

// Helper: proper error response
function errorResponse(status: number) {
  return Promise.resolve(
    new Response(JSON.stringify({ message: `error ${status}` }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
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
      mockToday,
      mockTomorrow,
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
      mockToday,
      mockTomorrow,
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
      mockToday,
      mockTomorrow,
      mockSummary,
      { data: mockOverdue },   // listDentalInvoices returns { data: [...] }
      { data: mockAllInvoices },
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
      mockToday,
      mockTomorrow,
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

  test('accepts array response (not wrapped in a key)', async () => {
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
    global.fetch = mock(() => errorResponse(500));

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  test('sets error state when any fetch in the parallel batch fails', async () => {
    let callIdx = 0;
    global.fetch = mock(() => {
      const i = callIdx++;
      if (i < 2) {
        const data = i === 0 ? mockToday : mockTomorrow;
        return jsonResponse(data);
      }
      // summary endpoint fails
      return errorResponse(503);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  test('sets error state when overdue invoices fetch fails', async () => {
    let callIdx = 0;
    global.fetch = mock(() => {
      const i = callIdx++;
      const successes = [mockToday, mockTomorrow, mockSummary];
      if (i < 3) return jsonResponse(successes[i]);
      return errorResponse(403);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: true }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  test('sets error state when all-invoices fetch fails', async () => {
    let callIdx = 0;
    global.fetch = mock(() => {
      const i = callIdx++;
      const successes: unknown[] = [mockToday, mockTomorrow, mockSummary, { data: mockOverdue }];
      if (i < 4) return jsonResponse(successes[i]);
      return errorResponse(500);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: true }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  test('refetch function is defined', async () => {
    global.fetch = makeFetch([mockToday, mockTomorrow, mockSummary]);

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'b1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });

  test('appointment fetches use date_from and date_to params, not date (QW-2/P1-23)', async () => {
    const capturedUrls: string[] = [];
    let callIdx = 0;
    const responses = [mockToday, mockTomorrow, mockSummary];
    global.fetch = mock((req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : String(req);
      capturedUrls.push(url);
      const resp = responses[callIdx++ % responses.length];
      return jsonResponse(resp);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useDashboardSummary({ branchId: 'branch1', showFinancials: false }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The first two fetches are appointment fetches (today + tomorrow)
    const apptUrls = capturedUrls.filter((u) => u.includes('/dental/appointments'));
    expect(apptUrls.length).toBeGreaterThanOrEqual(2);

    for (const url of apptUrls) {
      const parsed = new URL(url);
      // Must NOT use the old `date` param
      expect(parsed.searchParams.has('date')).toBe(false);
      // Must use date_from and date_to
      expect(parsed.searchParams.has('date_from')).toBe(true);
      expect(parsed.searchParams.has('date_to')).toBe(true);
      // Both must be YYYY-MM-DD ISO date strings
      expect(parsed.searchParams.get('date_from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parsed.searchParams.get('date_to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
