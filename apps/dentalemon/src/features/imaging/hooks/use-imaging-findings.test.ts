/**
 * useImagingFindings — unit tests
 *
 * Covers the query (happy path, disabled states, error) and the three
 * mutations (createFinding, updateFinding, deleteFinding).
 * Network fetch is mocked via global.fetch override — no MSW.
 *
 * NOTE: The SDK calls fetch(Request) — extract URL/method/body from the Request
 * object when present. Helper `reqInfo` normalises both call forms.
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
    status: 'draft' as ImagingFindingStatus,
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
    // SDK list response shape: { items: DentalImagingModuleImagingFinding[] }
    const findings = [makeFinding({ id: 'f1', type: 'caries', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })];
    global.fetch = mock(() => jsonResponse({ items: findings }));

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

  test('returns empty array when items is empty', async () => {
    global.fetch = mock(() => jsonResponse({ items: [] }));

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
      capturedUrl = reqUrl(req);
      return jsonResponse({ items: [] });
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
    const fetchSpy = mock(() => jsonResponse({ items: [] }));
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
    const fetchSpy = mock(() => jsonResponse({ items: [] }));
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
    let capturedBody: unknown;
    let capturedMethod: string | undefined;

    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      const method = reqMethod(req, init);
      if (method === 'POST') {
        capturedMethod = method;
        capturedBody = await reqBody(req, init);
        return jsonResponse(created);
      }
      return jsonResponse({ items: [] });
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

    expect(capturedMethod).toBe('POST');
    expect((capturedBody as Record<string, unknown>).type).toBe('bone_loss');
    expect((capturedBody as Record<string, unknown>).toothNumber).toBe(3);
  });

  test('sets isError on server error', async () => {
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'POST') {
        return jsonResponse({ message: 'Server error' }, 500);
      }
      return jsonResponse({ items: [] });
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

  // CONF-IMG-L2-001 (V-IMG-004): a failed mutation (tier-block 403 / validation
  // 422) must be surfaced via the hook result, not swallowed into console.error.
  test('surfaces the failure via mutationError when createFinding is tier-blocked', async () => {
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'POST') {
        return jsonResponse({ message: 'IMAGING_TIER_REQUIRED' }, 403);
      }
      return jsonResponse({ items: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.createFinding.mutate({ type: 'caries' });
    });

    await waitFor(() => expect(result.current.mutationError).not.toBeNull());
    expect((result.current.mutationError as Error).message).toContain('IMAGING_TIER_REQUIRED');
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
    let capturedBody: unknown;

    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'PATCH') {
        capturedUrl = reqUrl(req);
        capturedBody = await reqBody(req, init);
        return jsonResponse(updated);
      }
      return jsonResponse({ items: [] });
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
    expect((capturedBody as Record<string, unknown>).status).toBe('confirmed');
  });

  test('sets isError on server error', async () => {
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'PATCH') {
        return jsonResponse({ message: 'Conflict' }, 409);
      }
      return jsonResponse({ items: [] });
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

  test('succeeds on 204 no-content response (primary delete success path)', async () => {
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
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return jsonResponse({ items: [] });
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
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      if (reqMethod(req, init) === 'DELETE') {
        return jsonResponse({ message: 'Not found' }, 404);
      }
      return jsonResponse({ items: [] });
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
