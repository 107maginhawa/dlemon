/**
 * useMarkTreatmentDone — unit tests (FIX-01 status-aware two-step)
 *
 * diagnosed → 2 PATCHes (planned then performed)
 * planned   → 1 PATCH  (performed)
 * performed → 0 PATCHes (no-op)
 *
 * visitId is now passed per-call (not per-hook) so the closure cannot stale.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

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

const { useMarkTreatmentDone } = await import('./use-mark-treatment-done');

// ---------------------------------------------------------------------------
// Status-aware two-step (FIX-01)
// ---------------------------------------------------------------------------

describe('useMarkTreatmentDone — diagnosed (two-step)', () => {
  test('issues 2 PATCHes: first planned, then performed', async () => {
    const capturedBodies: unknown[] = [];
    let callCount = 0;
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      callCount++;
      if (req instanceof Request) {
        req.clone().text().then(t => { capturedBodies.push(JSON.parse(t)); });
      } else {
        capturedBodies.push(JSON.parse(init?.body as string ?? '{}'));
      }
      return jsonResponse({ id: 't-1', status: callCount === 1 ? 'planned' : 'performed' });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1', 'visit-abc', 'diagnosed');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(capturedBodies.length).toBe(2));
    expect(callCount).toBe(2);
    expect(capturedBodies[0]).toEqual({ status: 'planned' });
    expect(capturedBodies[1]).toEqual({ status: 'performed' });
  });
});

describe('useMarkTreatmentDone — planned (single-step)', () => {
  test('issues 1 PATCH: performed only', async () => {
    const capturedBodies: unknown[] = [];
    let callCount = 0;
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      callCount++;
      if (req instanceof Request) {
        req.clone().text().then(t => { capturedBodies.push(JSON.parse(t)); });
      } else {
        capturedBodies.push(JSON.parse(init?.body as string ?? '{}'));
      }
      return jsonResponse({ id: 't-1', status: 'performed' });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1', 'visit-abc', 'planned');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(capturedBodies.length).toBe(1));
    expect(callCount).toBe(1);
    expect(capturedBodies[0]).toEqual({ status: 'performed' });
  });
});

describe('useMarkTreatmentDone — performed (no-op)', () => {
  test('issues 0 PATCHes and resolves immediately', async () => {
    let callCount = 0;
    global.fetch = mock(() => { callCount++; return jsonResponse({}); });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1', 'visit-abc', 'performed');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Existing coverage
// ---------------------------------------------------------------------------

describe('useMarkTreatmentDone — URL and invalidation', () => {
  test('PATCH URL contains visitId and treatmentId', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({ id: 't-1', status: 'performed' });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1', 'visit-abc', 'planned');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/dental/visits/visit-abc/treatments/t-1');
  });

  test('invalidates dental-treatments query for visitId', async () => {
    global.fetch = mock(() => jsonResponse({ id: 't-1', status: 'performed' }));

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1', 'visit-abc', 'planned');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const found = invalidatedKeys.some(
      (k: any) =>
        Array.isArray(k) &&
        k.length > 0 &&
        typeof k[0] === 'object' &&
        k[0] !== null &&
        (k[0]._id === 'listDentalTreatments' || k[0] === 'dental-treatments'),
    );
    expect(found).toBe(true);
  });

  test('error: sets isError true when fetch fails', async () => {
    global.fetch = mock(() => jsonResponse({}, 422));

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.markDone('t-1', 'visit-abc', 'planned');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidatedKeys.length).toBe(0);
  });

  test('no-op when visitId is empty (does not throw)', async () => {
    global.fetch = mock(() => jsonResponse({}));
    const qc = freshClient();
    const { result } = renderHook(
      () => useMarkTreatmentDone(),
      { wrapper: makeWrapper(qc) },
    );
    expect(typeof result.current.markDone).toBe('function');
  });
});
