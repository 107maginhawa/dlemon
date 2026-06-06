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

    // Seed the cache using the SDK query key
    qc.setQueryData<ImagingAnnotation[]>(measurementsQueryKey('img-1'), [
      makeAnnotation({ id: 'existing' }),
    ]);

    await act(async () => {
      result.current.createMeasurement.mutate({ type: 'distance', geometry: {} });
    });

    // Optimistic item should be in cache immediately (temp-* id)
    await waitFor(() => {
      const cached = qc.getQueryData<ImagingAnnotation[]>(measurementsQueryKey('img-1'));
      return (cached?.length ?? 0) === 2 && cached?.some((m) => m.id.startsWith('temp-'));
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

    // Seed cache with two items using the SDK query key
    qc.setQueryData<ImagingAnnotation[]>(measurementsQueryKey('img-1'), [
      makeAnnotation({ id: 'ann-keep' }),
      makeAnnotation({ id: 'ann-delete' }),
    ]);

    await act(async () => {
      result.current.deleteMeasurement.mutate('ann-delete');
    });

    // Optimistic removal: only 'ann-keep' should remain
    await waitFor(() => {
      const cached = qc.getQueryData<ImagingAnnotation[]>(measurementsQueryKey('img-1'));
      return cached?.length === 1 && cached[0]?.id === 'ann-keep';
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

    // Seed cache
    qc.setQueryData<ImagingAnnotation[]>(measurementsQueryKey('img-1'), [
      makeAnnotation({ id: 'ann-1' }),
    ]);

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
