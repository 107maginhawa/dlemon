/**
 * useCreateVisit — unit tests
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useCreateVisit } from './use-create-visit';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

const _toastError = mock(() => {});
mock.module('sonner', () => ({ toast: { error: _toastError } }));

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

  test('success: issues a POST to /dental/visits to create the visit', async () => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      calls.push({ url, method });
      if (method === 'PATCH') {
        return jsonResponse({ id: 'v1', patientId: 'p1', status: 'active', createdAt: '2026-05-01T00:00:00Z' });
      }
      return jsonResponse({ id: 'v1', patientId: 'p1', status: 'draft', createdAt: '2026-05-01T00:00:00Z' });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useCreateVisit('p1'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const post = calls.find((c) => c.method === 'POST' && /\/dental\/visits$/.test(c.url));
    expect(post, 'a POST creating the visit was issued').toBeTruthy();
  });

  test('start-visit: activates the created visit (draft → active) so it is completable', async () => {
    // "Start new visit" must land the visit ACTIVE: a draft visit has no UI
    // affordance to activate, and Complete-visit is gated on status === 'active'
    // (draft → completed is an invalid FSM jump). So the hook must create then
    // transition draft → active.
    const calls: { url: string; method: string }[] = [];
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      calls.push({ url, method });
      if (method === 'PATCH') {
        return jsonResponse({ id: 'v1', patientId: 'p1', status: 'active', createdAt: '2026-05-01T00:00:00Z' });
      }
      return jsonResponse({ id: 'v1', patientId: 'p1', status: 'draft', createdAt: '2026-05-01T00:00:00Z' });
    });

    const qc = freshClient();
    const { result } = renderHook(() => useCreateVisit('p1'), { wrapper: makeWrapper(qc) });

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // A PATCH activating the created visit must be issued (draft → active)…
    const patch = calls.find((c) => c.method === 'PATCH' && /\/dental\/visits\/v1$/.test(c.url));
    expect(patch, 'a PATCH activating the created visit was issued').toBeTruthy();
    // …and the visit the hook returns is active, so the workspace can complete it.
    expect((result.current.data as { status?: string })?.status).toBe('active');
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

  test('V-FE-ERR-001: surfaces a toast on fetch failure', async () => {
    const callsBefore = _toastError.mock.calls.length;
    global.fetch = mock(() => jsonResponse({}, 500));

    const qc = freshClient();
    const { result } = renderHook(
      () => useCreateVisit('p1'),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(_toastError.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
