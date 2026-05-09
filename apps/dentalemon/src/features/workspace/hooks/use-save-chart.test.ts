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

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

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
      jsonResponse({}),
    );

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useSaveChart(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const found = invalidatedKeys.some(
      (k: any) => Array.isArray(k) && k[0] === 'dental-chart' && k[1] === 'visit-1',
    );
    expect(found).toBe(true);
  });

  test('success: fetch URL contains visitId in path', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({});
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
      jsonResponse({}, 500),
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
