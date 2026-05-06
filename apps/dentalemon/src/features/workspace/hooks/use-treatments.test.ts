/**
 * useTreatments — unit tests
 *
 * Tests the hook that fetches treatment list for a visit.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useTreatments } from './use-treatments';

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
    priceAmount: 1500,
    currency: 'PHP',
    createdAt: '2026-05-01T10:00:00Z',
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
    priceAmount: 500,
    currency: 'PHP',
    createdAt: '2026-05-01T10:05:00Z',
  },
];

describe('useTreatments', () => {
  test('returns treatments array on successful fetch', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockTreatments) } as Response),
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

  test('handles wrapped response (items key)', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ items: mockTreatments }) } as Response),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatments({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.treatments).toHaveLength(2);
  });

  test('treatment status values are diagnosed or planned (not proposed)', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockTreatments) } as Response),
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
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
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
      Promise.resolve({ ok: false, status: 500 } as Response),
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
    global.fetch = mock((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
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
