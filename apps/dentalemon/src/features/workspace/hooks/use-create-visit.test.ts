/**
 * useCreateVisit — unit tests
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCreateVisit } from './use-create-visit';

afterEach(cleanup);

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function makeSpyClient() {
  const qc = freshClient();
  const invalidatedKeys: unknown[] = [];
  const origInvalidate = qc.invalidateQueries.bind(qc);
  qc.invalidateQueries = (options?: unknown) => {
    if (options && typeof options === 'object' && 'queryKey' in options) {
      invalidatedKeys.push((options as { queryKey: unknown }).queryKey);
    }
    return origInvalidate(options as Parameters<typeof origInvalidate>[0]);
  };
  return { qc, invalidatedKeys };
}

const input = { patientId: 'p1', branchId: 'b1', dentistMemberId: 'm1' };

describe('useCreateVisit', () => {
  test('success: posts to /dental/visits and invalidates visits query', async () => {
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'v1', patientId: 'p1', status: 'draft', createdAt: '2026-05-01T00:00:00Z' }),
      } as Response),
    );

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useCreateVisit('p1'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidatedKeys).toContainEqual(['dental-visits', 'p1']);
  });

  test('success: fetch URL targets /dental/visits with POST method', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    global.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method ?? '';
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'v1', patientId: 'p1', status: 'draft', createdAt: '2026-05-01T00:00:00Z' }),
      } as Response);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useCreateVisit('p1'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/dental/visits');
    expect(capturedMethod).toBe('POST');
  });

  test('error: sets isError and does not invalidate on fetch failure', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
    );

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useCreateVisit('p1'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidatedKeys.length).toBe(0);
  });
});
