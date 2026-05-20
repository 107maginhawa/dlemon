/**
 * useImagingFindings — unit tests
 *
 * Covers the query (happy path, disabled states, error) and the three
 * mutations (createFinding, updateFinding, deleteFinding).
 * Network fetch is mocked via global.fetch override — no MSW.
 */
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import {
  useImagingFindings,
  type ImagingFinding,
  type ImagingFindingType,
  type ImagingFindingStatus,
} from './use-imaging-findings';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

function makeFinding(overrides: Partial<ImagingFinding> = {}): ImagingFinding {
  return {
    id: 'f1',
    imageId: 'img-1',
    annotationId: null,
    treatmentId: null,
    visitId: 'v1',
    patientId: 'p1',
    branchId: 'b1',
    type: 'caries' as ImagingFindingType,
    status: 'suspected' as ImagingFindingStatus,
    toothNumber: 14,
    surfaces: ['M'],
    note: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Query tests ────────────────────────────────────────────────────────────

describe('useImagingFindings — query', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('returns findings on successful fetch', async () => {
    const findings = [makeFinding({ id: 'f1', type: 'caries' })];
    global.fetch = mock(() => jsonResponse({ data: findings }));

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.findings).toHaveLength(1);
    expect(result.current.findings[0]!.type).toBe('caries');
    expect(result.current.findings[0]!.id).toBe('f1');
  });

  test('returns empty array when data.data is empty', async () => {
    global.fetch = mock(() => jsonResponse({ data: [] }));

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.findings).toHaveLength(0);
  });

  test('hits the correct URL', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({ data: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-42'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('/dental/imaging/images/img-42/findings');
  });

  test('is disabled when imageId is empty string', async () => {
    const fetchSpy = mock(() => jsonResponse({ data: [] }));
    global.fetch = fetchSpy;

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings(''),
      { wrapper: makeWrapper(qc) },
    );

    // isLoading stays false when disabled (no fetch is initiated)
    expect(result.current.isLoading).toBe(false);
    expect(result.current.findings).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('is disabled when opts.enabled is false', async () => {
    const fetchSpy = mock(() => jsonResponse({ data: [] }));
    global.fetch = fetchSpy;

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1', { enabled: false }),
      { wrapper: makeWrapper(qc) },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.findings).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('surfaces error on non-ok response', async () => {
    global.fetch = mock(() =>
      jsonResponse({ message: 'Not found' }, 404),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-missing'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.findings).toHaveLength(0);
  });
});

// ─── createFinding mutation ─────────────────────────────────────────────────

describe('useImagingFindings — createFinding', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('succeeds and calls POST with JSON body', async () => {
    const created = makeFinding({ id: 'f-new', type: 'bone_loss' });
    let capturedInit: RequestInit | undefined;

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      if (url.includes('/findings') && (!init || !init.method || init?.method === 'GET')) {
        return jsonResponse({ data: [] });
      }
      capturedInit = init;
      return jsonResponse(created);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.createFinding.mutate({ type: 'bone_loss', toothNumber: 3 });
    });

    await waitFor(() => expect(result.current.createFinding.isSuccess).toBe(true));

    expect(capturedInit?.method).toBe('POST');
    const body = JSON.parse(capturedInit?.body as string);
    expect(body.type).toBe('bone_loss');
    expect(body.toothNumber).toBe(3);
  });

  test('sets isError on server error', async () => {
    global.fetch = mock((_req: Request | string | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ message: 'Server error' }, 500);
      }
      return jsonResponse({ data: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.createFinding.mutate({ type: 'caries' });
    });

    await waitFor(() => expect(result.current.createFinding.isError).toBe(true));
  });
});

// ─── updateFinding mutation ─────────────────────────────────────────────────

describe('useImagingFindings — updateFinding', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('succeeds and calls PATCH on correct URL', async () => {
    const updated = makeFinding({ id: 'f1', status: 'confirmed' });
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      if (init?.method === 'PATCH') {
        capturedUrl = url;
        capturedInit = init;
        return jsonResponse(updated);
      }
      return jsonResponse({ data: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.updateFinding.mutate({ findingId: 'f1', data: { status: 'confirmed' } });
    });

    await waitFor(() => expect(result.current.updateFinding.isSuccess).toBe(true));

    expect(capturedUrl).toContain('/dental/imaging/findings/f1');
    const body = JSON.parse(capturedInit?.body as string);
    expect(body.status).toBe('confirmed');
  });

  test('sets isError on server error', async () => {
    global.fetch = mock((_req: Request | string | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return jsonResponse({ message: 'Conflict' }, 409);
      }
      return jsonResponse({ data: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.updateFinding.mutate({ findingId: 'f1', data: { status: 'resolved' } });
    });

    await waitFor(() => expect(result.current.updateFinding.isError).toBe(true));
  });
});

// ─── deleteFinding mutation ─────────────────────────────────────────────────

describe('useImagingFindings — deleteFinding', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('succeeds on 200 response', async () => {
    let capturedUrl = '';

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      if (init?.method === 'DELETE') {
        capturedUrl = url;
        return jsonResponse({}, 200);
      }
      return jsonResponse({ data: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.deleteFinding.mutate('f1');
    });

    await waitFor(() => expect(result.current.deleteFinding.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/dental/imaging/findings/f1');
  });

  test('succeeds on 204 no-content response', async () => {
    global.fetch = mock((_req: Request | string | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return jsonResponse({ data: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.deleteFinding.mutate('f1');
    });

    await waitFor(() => expect(result.current.deleteFinding.isSuccess).toBe(true));
  });

  test('sets isError on server error', async () => {
    global.fetch = mock((_req: Request | string | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return jsonResponse({ message: 'Not found' }, 404);
      }
      return jsonResponse({ data: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.deleteFinding.mutate('f-missing');
    });

    await waitFor(() => expect(result.current.deleteFinding.isError).toBe(true));
  });
});
