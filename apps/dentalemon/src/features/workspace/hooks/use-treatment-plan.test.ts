/**
 * useTreatmentPlan — unit tests
 *
 * Fetches all pending treatments across visits for a patient.
 * Covers: TXPL-01 (view treatment plan), TXPL-02 (totals), TXPL-03 (by-tooth grouping)
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useTreatmentPlan } from './use-treatment-plan';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const MOCK_PLAN = {
  patientId: 'p1',
  totalEstimateCents: 150000,
  treatmentCount: 2,
  toothCount: 2,
  byTooth: {
    11: [{ id: 't1', toothNumber: 11, cdtCode: 'D2391', description: 'Composite', surfaces: ['O'], priceCents: 100000, status: 'diagnosed', conditionCode: null, visitId: 'v1', carriedOver: false }],
    21: [{ id: 't2', toothNumber: 21, cdtCode: 'D0120', description: 'Periodic exam', surfaces: null, priceCents: 50000, status: 'planned', conditionCode: null, visitId: 'v1', carriedOver: false }],
  },
  treatments: [
    { id: 't1', toothNumber: 11, cdtCode: 'D2391', description: 'Composite', surfaces: ['O'], priceCents: 100000, status: 'diagnosed', conditionCode: null, visitId: 'v1', carriedOver: false },
    { id: 't2', toothNumber: 21, cdtCode: 'D0120', description: 'Periodic exam', surfaces: null, priceCents: 50000, status: 'planned', conditionCode: null, visitId: 'v1', carriedOver: false },
  ],
};

// ─── Disabled state ───────────────────────────────────────────────────────────

describe('useTreatmentPlan — disabled', () => {
  test('does not fetch when patientId is null', () => {
    global.fetch = mock(() => jsonResponse(MOCK_PLAN)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentPlan({ patientId: null, branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  test('does not fetch when branchId is null', () => {
    global.fetch = mock(() => jsonResponse(MOCK_PLAN)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentPlan({ patientId: 'p1', branchId: null }),
      { wrapper: makeWrapper(qc) },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('useTreatmentPlan — loading', () => {
  test('starts in loading state while fetch is pending', () => {
    global.fetch = mock(() => new Promise(() => {})) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentPlan({ patientId: 'p1', branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });
});

// ─── Success state ────────────────────────────────────────────────────────────

describe('useTreatmentPlan — success', () => {
  test('TXPL-01: returns treatment plan data with patientId', async () => {
    global.fetch = mock(() => jsonResponse(MOCK_PLAN)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentPlan({ patientId: 'p1', branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data!.patientId).toBe('p1');
  });

  test('TXPL-02: returns correct total estimate and treatment count', async () => {
    global.fetch = mock(() => jsonResponse(MOCK_PLAN)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentPlan({ patientId: 'p1', branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data!.totalEstimateCents).toBe(150000);
    expect(result.current.data!.treatmentCount).toBe(2);
  });

  test('TXPL-03: returns byTooth map with entries per tooth', async () => {
    global.fetch = mock(() => jsonResponse(MOCK_PLAN)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentPlan({ patientId: 'p1', branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(Object.keys(result.current.data!.byTooth)).toContain('11');
    expect(result.current.data!.byTooth[11].length).toBe(1);
  });

  test('URL includes branchId query param', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse(MOCK_PLAN);
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentPlan({ patientId: 'p1', branchId: 'branch-99' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(capturedUrl).toContain('branchId=branch-99');
    expect(capturedUrl).toContain('/dental/patients/p1/treatment-plan');
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('useTreatmentPlan — error', () => {
  test('sets error when API returns non-200 status', async () => {
    global.fetch = mock(() => jsonResponse({ message: 'Not found' }, 404)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentPlan({ patientId: 'p1', branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBeNull();
  });

  test('error message contains status code', async () => {
    global.fetch = mock(() => jsonResponse({}, 500)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentPlan({ patientId: 'p1', branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect((result.current.error as Error).message).toContain('500');
  });
});
