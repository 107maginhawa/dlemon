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

const mockTreatments = [
  {
    id: 't1',
    visitId: 'v1',
    toothNumber: 11,
    procedureCode: 'D2391',
    procedureName: 'Composite resin',
    cdtCode: 'D2391',
    description: 'One surface, posterior',
    status: 'diagnosed',
    priceCents: '1500',
    currency: 'PHP',
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 't2',
    visitId: 'v1',
    toothNumber: 21,
    procedureCode: 'D0120',
    procedureName: 'Periodic oral evaluation',
    cdtCode: 'D0120',
    description: 'Periodic exam',
    status: 'planned',
    priceCents: '500',
    currency: 'PHP',
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
