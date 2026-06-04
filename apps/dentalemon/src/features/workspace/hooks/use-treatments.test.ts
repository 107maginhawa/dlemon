/**
 * useTreatments — unit tests
 *
 * Tests the hook that fetches treatment list for a visit.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useTreatments } from './use-treatments';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

// Mirrors the live GET /dental/visits/:id/treatments shape (2026-06-04): the API
// returns cdtCode + description + integer priceCents — NOT procedureCode /
// procedureName / currency (those were FE-invented; see QA_ESCAPES §6 / QA-003).
const mockTreatments = [
  {
    id: 't1',
    visitId: 'v1',
    patientId: 'p1',
    toothNumber: 11,
    cdtCode: 'D2391',
    description: 'One surface, posterior',
    status: 'diagnosed',
    priceCents: 150000,
    carriedOver: false,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 't2',
    visitId: 'v1',
    patientId: 'p1',
    toothNumber: 21,
    cdtCode: 'D0120',
    description: 'Periodic exam',
    status: 'planned',
    priceCents: 50000,
    carriedOver: false,
    createdAt: '2026-05-01T10:05:00Z',
    updatedAt: '2026-05-01T10:05:00Z',
  },
];

describe('useTreatments', () => {
  test('returns treatments array on successful fetch', async () => {
    global.fetch = mock(() =>
      jsonResponse({ data: mockTreatments }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatments({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.treatments).toHaveLength(2);
    expect(result.current.treatments[0]!.id).toBe('t1');
  });

  test('maps API priceCents (cents) → Treatment.priceAmount (dollars) [QA-002 contract drift]', async () => {
    // The API returns `priceCents` (integer cents), but the FE Treatment model and
    // every consumer (breakdown table, visit totals, payment-modal line items) read
    // `priceAmount` (dollars). Nothing mapped it, so priceAmount was undefined → ₱0.
    // The other tests here include priceCents in fixtures but never assert the price
    // value — that unasserted gap is exactly how this shipped past a green suite.
    global.fetch = mock(() =>
      jsonResponse({ data: [{ ...mockTreatments[0], priceCents: 150000 }] }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatments({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // 150000 cents → 1500 dollars. Pre-fix this was undefined → ₱0.
    expect(result.current.treatments[0]!.priceAmount).toBe(1500);
  });

  test('surfaces the REAL API fields (cdtCode/description), not the dropped invented ones [QA-003]', async () => {
    // The view-model used to invent procedureCode/procedureName/currency that the
    // API never sends; consumers read them as undefined. The hook now projects the
    // SDK DentalTreatment, so the real fields must come through and priceAmount is
    // derived from priceCents.
    global.fetch = mock(() => jsonResponse({ data: mockTreatments }));
    const qc = freshClient();
    const { result } = renderHook(() => useTreatments({ visitId: 'v1' }), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const t = result.current.treatments[0]!;
    expect(t.cdtCode).toBe('D2391');
    expect(t.description).toBe('One surface, posterior');
    expect(t.priceAmount).toBe(1500);
    // The invented fields are gone from the contract.
    expect((t as Record<string, unknown>).procedureName).toBeUndefined();
    expect((t as Record<string, unknown>).currency).toBeUndefined();
  });

  test('handles wrapped response (data key)', async () => {
    global.fetch = mock(() =>
      jsonResponse({ data: mockTreatments }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatments({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.treatments).toHaveLength(2);
  });

  test('treatment status values are diagnosed or planned (not proposed)', async () => { // [BR-006]
    global.fetch = mock(() =>
      jsonResponse({ data: mockTreatments }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatments({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    for (const t of result.current.treatments) {
      expect(['diagnosed', 'planned', 'in_progress', 'completed', 'cancelled']).toContain(t.status);
      expect(t.status).not.toBe('proposed');
    }
  });

  test('does not fetch when visitId is null', async () => {
    let fetchCalled = false;
    global.fetch = mock(() => {
      fetchCalled = true;
      return jsonResponse({ data: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatments({ visitId: null }),
      { wrapper: makeWrapper(qc) },
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchCalled).toBe(false);
    expect(result.current.treatments).toHaveLength(0);
  });

  test('returns empty array and error on fetch failure', async () => {
    global.fetch = mock(() =>
      jsonResponse({}, 500),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatments({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.treatments).toHaveLength(0);
    expect(result.current.error).not.toBeNull();
  });

  test('includes visitId in fetch URL', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({ data: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatments({ visitId: 'visit-xyz' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('visit-xyz');
    expect(capturedUrl).toContain('/treatments');
  });
});
