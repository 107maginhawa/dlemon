/**
 * useSaveToothFlow — unit tests
 *
 * Orchestrates chart + treatment save sequence.
 * Rules under test:
 * [BR-chart-1] Invalid FDI tooth number aborts save with no fetch calls
 * [BR-chart-2] Null visitId or selectedTooth aborts save with no fetch calls
 * [BR-chart-3] Chart is always saved before treatment
 * [BR-chart-4] Treatment saved only when cdtCode + description + valid priceInput are all present
 * [BR-chart-5] Non-numeric priceInput aborts treatment save (chart still saved)
 * [BR-chart-6] isSaving reflects pending state of either sub-mutation
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useSaveToothFlow } from './use-save-tooth-flow';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

// SDK transformer requires priceCents + timestamps for treatment responses
const MOCK_TREATMENT_RESPONSE = {
  id: 'treatment-new',
  visitId: 'visit-1',
  patientId: 'p1',
  cdtCode: 'D2391',
  description: 'Composite resin',
  toothNumber: 11,
  surfaces: ['O'],
  status: 'diagnosed',
  priceCents: '1500',
  currency: 'PHP',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function treatmentAwareMock() {
  return mock((req: Request | string | URL) => {
    const url = req instanceof Request ? req.url : String(req);
    if (url.includes('/treatments')) return jsonResponse(MOCK_TREATMENT_RESPONSE);
    return jsonResponse({});
  }) as unknown as typeof fetch;
}

const BASE_OPTS = {
  visitId: 'visit-1',
  patientId: 'p1',
  teeth: [],
  selectedTooth: 11, // valid FDI
};

const SLIDEOUT_WITH_TREATMENT = {
  state: 'filled' as const,
  surfaces: ['O'],
  conditionCode: 'K02',
  cdtCode: 'D2391',
  description: 'Composite resin',
  priceInput: '1500',
};

const SLIDEOUT_CHART_ONLY = {
  state: 'filled' as const,
  surfaces: ['O'],
  conditionCode: undefined,
  cdtCode: undefined,
  description: undefined,
  priceInput: undefined,
};

// ─── [BR-chart-2] Null visitId or selectedTooth aborts save ──────────────────

describe('useSaveToothFlow — null guards', () => {
  test('[BR-chart-2] does not call fetch when visitId is null', () => {
    const fetchMock = mock(() => jsonResponse({}));
    global.fetch = fetchMock as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS, visitId: null }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.saveToothData(SLIDEOUT_WITH_TREATMENT); });

    expect(fetchMock.mock.calls.length).toBe(0);
  });

  test('[BR-chart-2] does not call fetch when selectedTooth is null', () => {
    const fetchMock = mock(() => jsonResponse({}));
    global.fetch = fetchMock as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS, selectedTooth: null }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.saveToothData(SLIDEOUT_WITH_TREATMENT); });

    expect(fetchMock.mock.calls.length).toBe(0);
  });
});

// ─── [BR-chart-1] Invalid FDI number aborts save ────────────────────────────

describe('useSaveToothFlow — FDI validation', () => {
  test('[BR-chart-1] does not call fetch for invalid FDI number (e.g. 99)', () => {
    const fetchMock = mock(() => jsonResponse({}));
    global.fetch = fetchMock as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS, selectedTooth: 99 }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.saveToothData(SLIDEOUT_WITH_TREATMENT); });

    expect(fetchMock.mock.calls.length).toBe(0);
  });

  test('[BR-chart-1] saves chart for valid FDI boundary values (11 and 48)', async () => {
    global.fetch = mock(() => jsonResponse({})) as unknown as typeof fetch; // chart-only, no treatment

    for (const tooth of [11, 48]) {
      const qc = freshClient();
      const { result } = renderHook(
        () => useSaveToothFlow({ ...BASE_OPTS, selectedTooth: tooth }),
        { wrapper: makeWrapper(qc) },
      );

      act(() => { result.current.saveToothData(SLIDEOUT_CHART_ONLY); });
      await waitFor(() => expect(result.current.isSaving).toBe(false));
    }
  });
});

// ─── [BR-chart-3] Chart saved before treatment ───────────────────────────────

describe('useSaveToothFlow — save sequence', () => {
  test('[BR-chart-3] chart save URL hit before treatment URL', async () => {
    const urls: string[] = [];
    global.fetch = mock((req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : String(req);
      urls.push(url);
      if (url.includes('/treatments')) return jsonResponse(MOCK_TREATMENT_RESPONSE);
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.saveToothData(SLIDEOUT_WITH_TREATMENT); });
    await waitFor(() => urls.length >= 2);

    expect(urls[0]).toContain('/dental/visits/visit-1/chart');
    expect(urls[1]).toContain('/dental/visits/visit-1/treatments');
  });
});

// ─── [BR-chart-4] Treatment conditional on cdtCode+description+price ─────────

describe('useSaveToothFlow — treatment conditional', () => {
  test('[BR-chart-4] saves chart only when no cdtCode present', async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.saveToothData(SLIDEOUT_CHART_ONLY); });
    await waitFor(() => !result.current.isSaving);

    // Only chart save — no treatment
    expect(callCount).toBe(1);
  });

  test('[BR-chart-4] saves chart AND treatment when all required fields present', async () => {
    let callCount = 0;
    global.fetch = mock((req: Request | string | URL) => {
      callCount++;
      const url = req instanceof Request ? req.url : String(req);
      if (url.includes('/treatments')) return jsonResponse(MOCK_TREATMENT_RESPONSE);
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.saveToothData(SLIDEOUT_WITH_TREATMENT); });
    await waitFor(() => callCount >= 2);

    expect(callCount).toBe(2);
  });
});

// ─── [BR-chart-5] NaN price aborts treatment save ────────────────────────────

describe('useSaveToothFlow — price validation', () => {
  test('[BR-chart-5] aborts entire save when priceInput is "abc" (NaN)', () => {
    const fetchMock = mock(() => jsonResponse({}));
    global.fetch = fetchMock as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => {
      result.current.saveToothData({ ...SLIDEOUT_WITH_TREATMENT, priceInput: 'abc' });
    });

    expect(fetchMock.mock.calls.length).toBe(0);
  });
});

// ─── [BR-chart-6] isSaving flag ──────────────────────────────────────────────

describe('useSaveToothFlow — isSaving', () => {
  test('[BR-chart-6] isSaving is false in idle state', () => {
    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS }),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isSaving).toBe(false);
  });

  test('[BR-chart-6] isSaving becomes true during chart save', async () => {
    let resolveFetch!: () => void;
    global.fetch = mock(
      () => new Promise<Response>((resolve) => {
        resolveFetch = () => resolve(new Response(JSON.stringify({}), { status: 200 }));
      }),
    ) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.saveToothData(SLIDEOUT_CHART_ONLY); });
    await waitFor(() => expect(result.current.isSaving).toBe(true));

    act(() => resolveFetch());
    await waitFor(() => expect(result.current.isSaving).toBe(false));
  });
});

// ─── [BR-chart-7] entryClassification forwarded to chart teeth ───────────────

describe('useSaveToothFlow — entryClassification forwarding', () => {
  test('[BR-chart-7] entryClassification is included in the chart teeth payload', async () => {
    let capturedBody: any = null;
    global.fetch = mock((req: Request | string | URL) => {
      if (req instanceof Request) {
        req.json().then((body: any) => { capturedBody = body; });
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => {
      result.current.saveToothData({
        ...SLIDEOUT_CHART_ONLY,
        entryClassification: 'existing',
      });
    });
    await waitFor(() => capturedBody !== null);

    const tooth = capturedBody?.teeth?.[0];
    expect(tooth?.entryClassification).toBe('existing');
  });
});

// ─── onSuccess callback ───────────────────────────────────────────────────────

describe('useSaveToothFlow — onSuccess callback', () => {
  test('calls onSuccess after chart save completes', async () => {
    global.fetch = mock(() => jsonResponse({})) as unknown as typeof fetch; // chart-only, no treatment

    let called = false;
    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveToothFlow({ ...BASE_OPTS, onSuccess: () => { called = true; } }),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.saveToothData(SLIDEOUT_CHART_ONLY); });
    await waitFor(() => expect(called).toBe(true));
  });
});
