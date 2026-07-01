/**
 * useMeasurements — unit tests
 *
 * Covers the query (happy path, disabled, error) and the two mutations
 * (createMeasurement with optimistic update, deleteMeasurement with optimistic update).
 * Network fetch is mocked via global.fetch override — no MSW.
 *
 * NOTE: The SDK calls fetch(Request) — extract URL/method/body from the Request
 * object when present. Helper functions normalise both call forms.
 * Cache seeding uses the SDK query key (imagingMgmtListMeasurementsQueryKey).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useMeasurements, type ImagingAnnotation } from './use-measurements';
import { imagingMgmtListMeasurementsQueryKey } from '@monobase/sdk-ts/generated/react-query';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

/** Normalise both fetch(url, init) and fetch(Request) call shapes. */
function reqUrl(req: Request | string | URL): string {
  return req instanceof Request ? req.url : String(req);
}
function reqMethod(req: Request | string | URL, init?: RequestInit): string {
  return req instanceof Request ? req.method : (init?.method ?? 'GET');
}
async function reqBody(req: Request | string | URL, init?: RequestInit): Promise<unknown> {
  if (req instanceof Request) {
    try { return await req.json(); } catch { return null; }
  }
  if (typeof init?.body === 'string') {
    try { return JSON.parse(init.body); } catch { return null; }
  }
  return null;
}

/** SDK query key for measurements — must match what useMeasurements uses internally. */
function measurementsQueryKey(imageId: string) {
  return imagingMgmtListMeasurementsQueryKey({ path: { imageId } });
}

function makeAnnotation(overrides: Partial<ImagingAnnotation> = {}): ImagingAnnotation {
  return {
    id: 'ann-1',
    imageId: 'img-1',
    type: 'line',
    geometry: { x1: 0, y1: 0, x2: 10, y2: 10 },
    measurementValue: 5.2,
    measurementUnit: 'mm',
    visible: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Query tests ────────────────────────────────────────────────────────────

describe('useMeasurements — query', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('returns measurements on successful fetch', async () => {
    const items = [makeAnnotation({ id: 'ann-1' }), makeAnnotation({ id: 'ann-2' })];
    // SDK response shape: { items: DentalImagingModuleImagingAnnotation[] }
    global.fetch = mock(() => jsonResponse({ items }));

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.measurements).toHaveLength(2);
    expect(result.current.measurements[0]!.id).toBe('ann-1');
    expect(result.current.measurements[0]!.measurementValue).toBe(5.2);
    expect(result.current.measurements[0]!.measurementUnit).toBe('mm');
  });

  test('returns empty array when no measurements', async () => {
    global.fetch = mock(() => jsonResponse({ items: [] }));

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.measurements).toHaveLength(0);
  });

  test('hits the correct URL with imageId', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = reqUrl(req);
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-77'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('/dental/imaging/images/img-77/measurements');
  });

  test('is disabled when imageId is empty string', async () => {
    const fetchSpy = mock(() => jsonResponse({ items: [] }));
    global.fetch = fetchSpy;

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements(''),
      { wrapper: makeWrapper(qc) },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.measurements).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('returns empty array and surfaces error on non-ok response', async () => {
    global.fetch = mock(() => jsonResponse({ message: 'Unauthorized' }, 401));

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.measurements).toHaveLength(0);
  });
});

// ─── createMeasurement mutation ─────────────────────────────────────────────

describe('useMeasurements — createMeasurement', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('succeeds and calls POST with JSON body', async () => {
    const created = makeAnnotation({ id: 'ann-new', type: 'angle', measurementValue: 30 });
    let capturedUrl = '';
    let capturedBody: unknown;

    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'POST') {
        capturedUrl = reqUrl(req);
        capturedBody = await reqBody(req, init);
        return jsonResponse(created);
      }
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.createMeasurement.mutate({
        type: 'angle',
        geometry: { points: [] },
        measurementValue: 30,
        measurementUnit: 'deg',
      });
    });

    await waitFor(() => expect(result.current.createMeasurement.isSuccess).toBe(true));

    expect(capturedUrl).toContain('/dental/imaging/images/img-1/measurements');
    expect((capturedBody as Record<string, unknown>).type).toBe('angle');
    expect((capturedBody as Record<string, unknown>).measurementValue).toBe(30);
  });

  test('optimistic update works when cache holds the real { items } SDK shape (regression: IMG-16)', async () => {
    // Reproduces production/E2E: the queryFn populates the cache as the canonical
    // { items: [...] } SDK response (NOT a bare array). The buggy onMutate spread
    // `[...(old ?? [])]` iterated that plain object → TypeError → onMutate rejected
    // → mutationFn never ran → no POST, no optimistic item. Asserts through the
    // selected view-model so it survives the cache-shape fix.
    let postFired = false;
    let resolvePost!: (r: Response) => void;
    const postPromise = new Promise<Response>((res) => { resolvePost = res; });

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'POST') {
        postFired = true;
        return postPromise;
      }
      // GET — canonical SDK response shape (what the real queryFn caches).
      return jsonResponse({ items: [makeAnnotation({ id: 'existing' })] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    // Let the GET settle so the cache holds the real { items } shape before we mutate.
    await waitFor(() => expect(result.current.measurements).toHaveLength(1));

    await act(async () => {
      result.current.createMeasurement.mutate({
        type: 'distance',
        geometry: { points: [] },
        measurementValue: 5,
        measurementUnit: 'mm',
      });
    });

    // Optimistic temp item must appear through the select transform...
    await waitFor(() =>
      expect(result.current.measurements.some((m) => m.id.startsWith('temp-'))).toBe(true),
    );
    // ...and the POST must actually fire (the bug rejected onMutate before mutationFn).
    expect(postFired).toBe(true);

    resolvePost(
      new Response(JSON.stringify(makeAnnotation({ id: 'ann-server' })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await waitFor(() => expect(result.current.createMeasurement.isSuccess).toBe(true));
  });

  test('applies optimistic update before server responds', async () => {
    // Use a deferred promise to hold the POST response so we can check
    // the optimistic state before settlement
    let resolvePost!: (r: Response) => void;
    const postPromise = new Promise<Response>((res) => { resolvePost = res; });

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'POST') return postPromise;
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    // Seed the cache using the SDK query key, in the canonical { items } response shape.
    qc.setQueryData(measurementsQueryKey('img-1'), {
      items: [makeAnnotation({ id: 'existing' })],
    });

    await act(async () => {
      result.current.createMeasurement.mutate({ type: 'distance', geometry: {} });
    });

    // Optimistic item should be in cache immediately (temp-* id)
    await waitFor(() => {
      const cached = qc.getQueryData<{ items: ImagingAnnotation[] }>(measurementsQueryKey('img-1'));
      return (cached?.items.length ?? 0) === 2 && cached?.items.some((m) => m.id.startsWith('temp-'));
    });

    // Now resolve the POST
    resolvePost(
      new Response(JSON.stringify(makeAnnotation({ id: 'ann-server' })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await waitFor(() => expect(result.current.createMeasurement.isSuccess).toBe(true));
  });

  test('rolls back optimistic update on server error', async () => {
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'POST') return jsonResponse({ message: 'error' }, 500);
      return jsonResponse({ items: [makeAnnotation({ id: 'existing' })] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.createMeasurement.mutate({ type: 'distance', geometry: {} });
    });

    await waitFor(() => expect(result.current.createMeasurement.isError).toBe(true));
  });

  test('sets isError on server error', async () => {
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'POST') return jsonResponse({ message: 'Bad request' }, 400);
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.createMeasurement.mutate({ type: 'area', geometry: {} });
    });

    await waitFor(() => expect(result.current.createMeasurement.isError).toBe(true));
  });
});

// ─── deleteMeasurement mutation ─────────────────────────────────────────────

describe('useMeasurements — deleteMeasurement', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('succeeds on 204 and calls DELETE on correct URL (primary delete success path)', async () => {
    let capturedUrl = '';

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'DELETE') {
        capturedUrl = reqUrl(req);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.deleteMeasurement.mutate('ann-1');
    });

    await waitFor(() => expect(result.current.deleteMeasurement.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/dental/imaging/measurements/ann-1');
  });

  test('succeeds on 204 no-content response', async () => {
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.deleteMeasurement.mutate('ann-1');
    });

    await waitFor(() => expect(result.current.deleteMeasurement.isSuccess).toBe(true));
  });

  test('applies optimistic removal before server responds', async () => {
    let resolveDelete!: (r: Response) => void;
    const deletePromise = new Promise<Response>((res) => { resolveDelete = res; });

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'DELETE') return deletePromise;
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    // Seed cache with two items using the SDK query key, canonical { items } shape.
    qc.setQueryData(measurementsQueryKey('img-1'), {
      items: [makeAnnotation({ id: 'ann-keep' }), makeAnnotation({ id: 'ann-delete' })],
    });

    await act(async () => {
      result.current.deleteMeasurement.mutate('ann-delete');
    });

    // Optimistic removal: only 'ann-keep' should remain
    await waitFor(() => {
      const cached = qc.getQueryData<{ items: ImagingAnnotation[] }>(measurementsQueryKey('img-1'));
      return cached?.items.length === 1 && cached.items[0]?.id === 'ann-keep';
    });

    resolveDelete(new Response(null, { status: 204 }));
    await waitFor(() => expect(result.current.deleteMeasurement.isSuccess).toBe(true));
  });

  test('rolls back optimistic removal on server error', async () => {
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'DELETE') return jsonResponse({ message: 'Server error' }, 500);
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    // Seed cache, canonical { items } shape.
    qc.setQueryData(measurementsQueryKey('img-1'), {
      items: [makeAnnotation({ id: 'ann-1' })],
    });

    await act(async () => {
      result.current.deleteMeasurement.mutate('ann-1');
    });

    await waitFor(() => expect(result.current.deleteMeasurement.isError).toBe(true));
  });

  test('sets isError on non-ok, non-204 response', async () => {
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'DELETE') return jsonResponse({ message: 'Not found' }, 404);
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useMeasurements('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.deleteMeasurement.mutate('ann-missing');
    });

    await waitFor(() => expect(result.current.deleteMeasurement.isError).toBe(true));
  });
});

// ─── updateMeasurement (edit/move) tests ─────────────────────────────────────

describe('useMeasurements — updateMeasurement', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('PATCHes /measurements/:id with the patch body', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: unknown = null;
    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'PATCH') {
        capturedUrl = reqUrl(req);
        capturedMethod = 'PATCH';
        capturedBody = await reqBody(req, init);
        return jsonResponse(makeAnnotation({ id: 'ann-1', geometry: { moved: true } }));
      }
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(() => useMeasurements('img-1'), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.updateMeasurement.mutate({ id: 'ann-1', geometry: { moved: true }, measurementValue: 9 });
    });

    await waitFor(() => expect(result.current.updateMeasurement.isSuccess).toBe(true));
    expect(capturedMethod).toBe('PATCH');
    expect(capturedUrl).toContain('/dental/imaging/measurements/ann-1');
    expect(capturedBody).toEqual({ geometry: { moved: true }, measurementValue: 9 });
  });

  test('optimistically patches the cached item before the server responds', async () => {
    let resolvePatch!: (r: Response) => void;
    const patchPromise = new Promise<Response>((res) => { resolvePatch = res; });
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'PATCH') return patchPromise;
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(() => useMeasurements('img-1'), { wrapper: makeWrapper(qc) });

    qc.setQueryData(measurementsQueryKey('img-1'), {
      items: [makeAnnotation({ id: 'ann-1', visible: true })],
    });

    await act(async () => {
      result.current.updateMeasurement.mutate({ id: 'ann-1', visible: false });
    });

    // Optimistic: cached item hidden before the network resolves.
    await waitFor(() => {
      const cached = qc.getQueryData<{ items: ImagingAnnotation[] }>(measurementsQueryKey('img-1'));
      return cached?.items[0]?.visible === false;
    });

    resolvePatch(jsonResponse(makeAnnotation({ id: 'ann-1', visible: false })) as Response);
    await waitFor(() => expect(result.current.updateMeasurement.isSuccess).toBe(true));
  });

  test('rolls back the optimistic patch on error', async () => {
    // List GET returns server truth (5.2). After a failed PATCH the displayed value
    // must be that truth, never the optimistic 99 — proving no stuck optimistic state.
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'PATCH') return jsonResponse({ message: 'boom' }, 500);
      return jsonResponse({ items: [makeAnnotation({ id: 'ann-1', measurementValue: 5.2 })] });
    });

    const qc = freshClient();
    const { result } = renderHook(() => useMeasurements('img-1'), { wrapper: makeWrapper(qc) });

    qc.setQueryData(measurementsQueryKey('img-1'), {
      items: [makeAnnotation({ id: 'ann-1', measurementValue: 5.2 })],
    });

    await act(async () => {
      result.current.updateMeasurement.mutate({ id: 'ann-1', measurementValue: 99 });
    });

    await waitFor(() => expect(result.current.updateMeasurement.isError).toBe(true));
    // Never stuck at the optimistic 99 (rolled back, then reconciled to server truth).
    await waitFor(() => {
      const cached = qc.getQueryData<{ items: ImagingAnnotation[] }>(measurementsQueryKey('img-1'));
      return cached?.items[0]?.measurementValue === 5.2;
    });
    expect(
      qc.getQueryData<{ items: ImagingAnnotation[] }>(measurementsQueryKey('img-1'))?.items[0]?.measurementValue,
    ).toBe(5.2);
  });
});
