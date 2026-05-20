/**
 * useCreateVisit — unit tests
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useCreateVisit } from './use-create-visit';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

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
    global.fetch = mock(() => jsonResponse({ id: 'v1', patientId: 'p1', status: 'draft', createdAt: '2026-05-01T00:00:00Z' }));

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useCreateVisit('p1'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // SDK key format: [{ _id: 'listDentalVisits', query: { patientId } }]
    const found = invalidatedKeys.some(
      (k: any) =>
        Array.isArray(k) &&
        k.length > 0 &&
        typeof k[0] === 'object' &&
        k[0] !== null &&
        (k[0]._id === 'listDentalVisits' || k[0] === 'dental-visits'),
    );
    expect(found).toBe(true);
  });

  test('success: fetch URL targets /dental/visits with POST method', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      capturedMethod = req instanceof Request ? req.method : (init?.method ?? '');
      return jsonResponse({ id: 'v1', patientId: 'p1', status: 'draft', createdAt: '2026-05-01T00:00:00Z' });
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
    global.fetch = mock(() => jsonResponse({}, 500));

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
