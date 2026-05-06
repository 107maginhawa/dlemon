/**
 * useSaveChart — unit tests
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useSaveChart } from './use-save-chart';

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

const input = { visitId: 'visit-1', patientId: 'p1', teeth: [] };

describe('useSaveChart', () => {
  test('success: invalidates dental-chart query for the saved visitId', async () => {
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response),
    );

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useSaveChart(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidatedKeys).toContainEqual(['dental-chart', 'visit-1']);
  });

  test('success: fetch URL contains visitId in path', async () => {
    let capturedUrl = '';
    global.fetch = mock((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveChart(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/dental/visits/visit-1/chart');
  });

  test('error: sets isError true and skips invalidation', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
    );

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useSaveChart(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidatedKeys.length).toBe(0);
  });
});
