/**
 * useSaveTreatment — unit tests
 *
 * Mutation hook: POST /dental/visits/:visitId/treatments (via SDK)
 * On success: invalidates listDentalTreatments query for the visitId
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useSaveTreatment } from './use-save-treatment';
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

// SDK transformer requires priceCents + timestamps on the returned treatment
const MOCK_TREATMENT_RESPONSE = {
  id: 'treatment-new',
  visitId: 'visit-1',
  patientId: 'p1',
  cdtCode: 'D2391',
  description: 'Composite resin',
  toothNumber: 11,
  surfaces: ['O'],
  conditionCode: 'K02',
  status: 'diagnosed',
  priceCents: '1500',
  currency: 'PHP',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const TREATMENT_INPUT = {
  visitId: 'visit-1',
  patientId: 'p1',
  cdtCode: 'D2391',
  description: 'Composite resin, one surface, posterior',
  toothNumber: 11,
  surfaces: ['O'],
  conditionCode: 'K02',
  priceAmount: 1500,
  currency: 'PHP',
  status: 'diagnosed' as const,
};

// ─── Idle state ───────────────────────────────────────────────────────────────

describe('useSaveTreatment — idle', () => {
  test('starts in idle state', () => {
    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveTreatment(),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});

// ─── Success state ────────────────────────────────────────────────────────────

describe('useSaveTreatment — success', () => {
  test('sets isSuccess true after successful mutation', async () => { // [BR-006]
    global.fetch = mock(() => jsonResponse(MOCK_TREATMENT_RESPONSE)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveTreatment(),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.mutate(TREATMENT_INPUT); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  test('invalidates listDentalTreatments query for the visitId on success', async () => {
    global.fetch = mock(() => jsonResponse(MOCK_TREATMENT_RESPONSE)) as unknown as typeof fetch;

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useSaveTreatment(),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.mutate(TREATMENT_INPUT); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify invalidation includes the visitId somewhere in the key
    const found = invalidatedKeys.some(
      (k) =>
        Array.isArray(k) &&
        JSON.stringify(k).includes('visit-1'),
    );
    expect(found).toBe(true);
  });

  test('URL contains visitId in the treatments path', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse(MOCK_TREATMENT_RESPONSE);
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveTreatment(),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.mutate(TREATMENT_INPUT); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/dental/visits/visit-1/treatments');
  });

  test('converts priceAmount to integer cents (rounds correctly)', async () => {
    // price contract: priceAmount=15.007 (dollars) → Math.round(15.007 * 100) = 1501 cents
    let capturedBody = '';
    global.fetch = mock(async (req: Request | string | URL) => {
      if (req instanceof Request) capturedBody = await req.text();
      return jsonResponse({ ...MOCK_TREATMENT_RESPONSE, priceCents: '1501' });
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveTreatment(),
      { wrapper: makeWrapper(qc) },
    );

    // priceAmount: 15.007 dollars → Math.round(15.007 * 100) = 1501 cents
    act(() => { result.current.mutate({ ...TREATMENT_INPUT, priceAmount: 15.007 }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const parsed = JSON.parse(capturedBody) as { priceCents?: unknown };
    expect(Number(parsed.priceCents)).toBe(1501);
  });

  test('BFIX-01: priceAmount in dollars must be sent as priceCents (×100)', async () => {
    // price contract: priceAmount=15.00 (dollars) → priceCents=1500 (cents)
    // Bug: BigInt(Math.round(15)) = 15n (= ¢0.15 not $15.00)
    // Fix: BigInt(Math.round(15 * 100)) = 1500n (= $15.00 correct)
    let capturedBody = '';
    global.fetch = mock(async (req: Request | string | URL) => {
      if (req instanceof Request) capturedBody = await req.text();
      return jsonResponse({ ...MOCK_TREATMENT_RESPONSE, priceCents: '1500' });
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveTreatment(),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.mutate({ ...TREATMENT_INPUT, priceAmount: 15 }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // priceCents must be 1500 (15 dollars × 100), not 15 (bare dollar value)
    const parsed = JSON.parse(capturedBody) as { priceCents?: unknown };
    expect(Number(parsed.priceCents)).toBe(1500);
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('useSaveTreatment — error', () => {
  test('sets isError true when API returns 500', async () => {
    global.fetch = mock(() => jsonResponse({ message: 'Server error' }, 500)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useSaveTreatment(),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.mutate(TREATMENT_INPUT); });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  test('does not invalidate query on error', async () => {
    global.fetch = mock(() => jsonResponse({}, 500)) as unknown as typeof fetch;

    const { qc, invalidatedKeys } = makeSpyClient();
    const { result } = renderHook(
      () => useSaveTreatment(),
      { wrapper: makeWrapper(qc) },
    );

    act(() => { result.current.mutate(TREATMENT_INPUT); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidatedKeys.length).toBe(0);
  });

  test('AC-006: calls toast.error when treatment save fails', async () => {
    const callsBefore = _toastError.mock.calls.length;
    global.fetch = mock(() => jsonResponse({ message: 'Server error' }, 500)) as unknown as typeof fetch;
    const qc = freshClient();
    const { result } = renderHook(() => useSaveTreatment(), { wrapper: makeWrapper(qc) });
    act(() => { result.current.mutate(TREATMENT_INPUT); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(_toastError.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
