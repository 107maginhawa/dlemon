/**
 * useSaveChart — unit tests
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useSaveChart } from './use-save-chart';
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
    // SDK key format: [{ _id: 'getDentalChart', path: { visitId } }]
    const found = invalidatedKeys.some(
      (k: any) =>
        Array.isArray(k) &&
        k.length > 0 &&
        typeof k[0] === 'object' &&
        k[0] !== null &&
        (k[0]._id === 'getDentalChart' || k[0] === 'dental-chart'),
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

  test('AC-004: calls toast.error on generic save failure', async () => {
    const callsBefore = _toastError.mock.calls.length;
    global.fetch = mock(() => jsonResponse({ message: 'Server error' }, 500));
    const { result } = renderHook(() => useSaveChart(), { wrapper: makeWrapper(freshClient()) });
    result.current.mutate(input);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(_toastError.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  test('AC-005: toast.error message contains "locked" for VISIT_LOCKED 422', async () => {
    const callsBefore = _toastError.mock.calls.length;
    global.fetch = mock(() => jsonResponse({ code: 'VISIT_LOCKED', message: 'Visit is locked' }, 422));
    const { result } = renderHook(() => useSaveChart(), { wrapper: makeWrapper(freshClient()) });
    result.current.mutate(input);
    await waitFor(() => expect(result.current.isError).toBe(true));
    const newCalls = _toastError.mock.calls.slice(callsBefore);
    expect(newCalls.length).toBeGreaterThan(0);
    expect(String(newCalls[0]?.[0])).toMatch(/lock/i);
  });
});
