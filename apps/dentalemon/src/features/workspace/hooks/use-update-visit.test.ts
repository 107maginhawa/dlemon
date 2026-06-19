/**
 * useUpdateVisit — unit tests
 *
 * Mutation hook: PATCH /dental/visits/:visitId (via SDK updateDentalVisitMutation)
 * On success: invalidates listDentalVisits query for the patientId.
 * V-FE-ERR-001: a failed mutation (e.g. lock failure) must surface a toast,
 * not be silently swallowed.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useUpdateVisit } from './use-update-visit';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

const _toastError = mock(() => {});
mock.module('sonner', () => ({ toast: { error: _toastError, success: mock(() => {}) } }));

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

const VISIT_RESPONSE = {
  id: 'v1',
  patientId: 'p1',
  status: 'locked',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T01:00:00Z',
};

const variables = { path: { visitId: 'v1' }, body: { status: 'locked' as const } };

describe('useUpdateVisit', () => {
  test('success: PATCHes /dental/visits/:visitId and invalidates visits query', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      capturedMethod = req instanceof Request ? req.method : (init?.method ?? '');
      return jsonResponse(VISIT_RESPONSE);
    });

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useUpdateVisit('p1'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(variables);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).toContain('/dental/visits/v1');
    expect(capturedMethod).toBe('PATCH');

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

  test('error: sets isError and does not invalidate on fetch failure', async () => {
    global.fetch = mock(() => jsonResponse({}, 500));

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useUpdateVisit('p1'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(variables);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidatedKeys.length).toBe(0);
  });

  test('V-FE-ERR-001: surfaces a toast when a lock/update fails', async () => {
    const callsBefore = _toastError.mock.calls.length;
    global.fetch = mock(() => jsonResponse({}, 500));

    const qc = freshClient();
    const { result } = renderHook(
      () => useUpdateVisit('p1'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(variables);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(_toastError.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
