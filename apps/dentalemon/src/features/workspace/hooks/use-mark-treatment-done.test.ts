/**
 * useMarkTreatmentDone — unit tests
 *
 * Phase 3: Mark treatment as completed via PATCH /dental/visits/:visitId/treatments/:treatmentId
 *
 * Coverage:
 * - success: PATCH URL contains visitId + treatmentId
 * - success: sends { status: 'completed' } in body
 * - success: invalidates ['dental-treatments', visitId]
 * - error: sets isError, skips invalidation
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

afterEach(cleanup);

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
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

const { useMarkTreatmentDone } = await import('./use-mark-treatment-done');

describe('useMarkTreatmentDone', () => {
  test('success: PATCH URL contains visitId and treatmentId', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({ id: 't-1', status: 'completed' });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone('visit-abc'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/dental/visits/visit-abc/treatments/t-1');
  });

  test('success: sends { status: "completed" } in request body', async () => {
    let capturedBody: unknown;
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (req instanceof Request) {
        req.clone().text().then(t => { capturedBody = JSON.parse(t); });
      } else {
        capturedBody = JSON.parse(init?.body as string ?? '{}');
      }
      return jsonResponse({ id: 't-1', status: 'completed' });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone('visit-abc'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedBody).toEqual({ status: 'completed' });
  });

  test('success: invalidates dental-treatments query for visitId', async () => {
    global.fetch = mock(() => jsonResponse({ id: 't-1', status: 'completed' }));

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone('visit-abc'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidatedKeys).toContainEqual(['dental-treatments', 'visit-abc']);
  });

  test('error: sets isError true when fetch fails, skips invalidation', async () => {
    global.fetch = mock(() => jsonResponse({}, 422));

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone('visit-abc'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidatedKeys.length).toBe(0);
  });

  test('no-op when visitId is null (does not throw)', async () => {
    global.fetch = mock(() => jsonResponse({}));

    const qc = freshClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone(null),
      { wrapper: makeWrapper(qc) },
    );

    // Should return an object with markDone callable
    expect(typeof result.current.markDone).toBe('function');
  });
});
