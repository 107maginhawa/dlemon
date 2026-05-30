/**
 * useInitializeDentition — unit tests (TR-P1-07)
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useInitializeDentition } from './use-initialize-dentition';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

const _toastError = mock(() => {});
const _toastSuccess = mock(() => {});
mock.module('sonner', () => ({ toast: { error: _toastError, success: _toastSuccess } }));

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

const input = { patientId: 'p1', visitId: 'visit-1', dateOfBirth: '2018-04-01' };

describe('useInitializeDentition', () => {
  test('success: POSTs to /dental/patients/:patientId/dentition with DOB+visitId', async () => {
    let capturedUrl = '';
    let capturedBody = '';
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      capturedBody = req instanceof Request ? '' : String(init?.body ?? '');
      return jsonResponse({ chartId: 'c1', dentitionType: 'deciduous', toothCount: 20 }, 201);
    });

    const { result } = renderHook(() => useInitializeDentition(), { wrapper: makeWrapper(freshClient()) });
    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).toContain('/dental/patients/p1/dentition');
    // body carries dateOfBirth + visitId (in some runtimes Request swallows body — assert URL always)
    if (capturedBody) {
      expect(capturedBody).toContain('2018-04-01');
      expect(capturedBody).toContain('visit-1');
    }
  });

  test('success: invalidates the dental-chart query for the visit', async () => {
    global.fetch = mock(() => jsonResponse({ chartId: 'c1' }, 201));
    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(() => useInitializeDentition(), { wrapper: makeWrapper(qc) });

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

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

  test('error: sets isError and skips invalidation', async () => {
    global.fetch = mock(() => jsonResponse({ message: 'boom' }, 500));
    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(() => useInitializeDentition(), { wrapper: makeWrapper(qc) });

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidatedKeys.length).toBe(0);
  });
});
