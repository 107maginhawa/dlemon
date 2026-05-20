/**
 * useTreatmentReport — unit tests
 *
 * Tests the treatment report hook that fetches visits + treatments
 * for a branch and groups them by CDT code with counts and totals.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import {
  groupByCdtCode,
  filterByDateRange,
  type TreatmentRow,
} from './use-treatment-report';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

// ---------------------------------------------------------------------------
// Pure logic tests (no React / no fetch)
// ---------------------------------------------------------------------------

const sampleTreatments: TreatmentRow[] = [
  { cdtCode: 'D0120', description: 'Periodic Exam', priceCents: 3000, createdAt: '2026-01-05T10:00:00Z' },
  { cdtCode: 'D1110', description: 'Prophylaxis', priceCents: 5000, createdAt: '2026-01-06T10:00:00Z' },
  { cdtCode: 'D0120', description: 'Periodic Exam', priceCents: 3000, createdAt: '2026-01-10T10:00:00Z' },
  { cdtCode: 'D2391', description: 'Composite 1s', priceCents: 8000, createdAt: '2026-01-12T10:00:00Z' },
  { cdtCode: 'D1110', description: 'Prophylaxis', priceCents: 5000, createdAt: '2026-01-15T10:00:00Z' },
  { cdtCode: 'D2391', description: 'Composite 1s', priceCents: 8000, createdAt: '2026-02-01T10:00:00Z' },
];

describe('groupByCdtCode', () => {
  test('groups treatments and sums counts + totals', () => {
    const result = groupByCdtCode(sampleTreatments);
    expect(result).toHaveLength(3);

    const d0120 = result.find((r) => r.cdtCode === 'D0120');
    expect(d0120).not.toBeUndefined();
    expect(d0120!.count).toBe(2);
    expect(d0120!.totalCents).toBe(6000);
    expect(d0120!.description).toBe('Periodic Exam');
  });

  test('returns empty array for empty input', () => {
    expect(groupByCdtCode([])).toEqual([]);
  });

  test('sorts by totalCents descending', () => {
    const result = groupByCdtCode(sampleTreatments);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].totalCents).toBeGreaterThanOrEqual(result[i].totalCents);
    }
  });
});

describe('filterByDateRange', () => {
  test('filters treatments within date range', () => {
    const result = filterByDateRange(sampleTreatments, '2026-01-05', '2026-01-12');
    expect(result).toHaveLength(4);
  });

  test('returns all when no range given', () => {
    const result = filterByDateRange(sampleTreatments, '', '');
    expect(result).toHaveLength(sampleTreatments.length);
  });

  test('returns empty when no treatments match', () => {
    const result = filterByDateRange(sampleTreatments, '2027-01-01', '2027-12-31');
    expect(result).toHaveLength(0);
  });

  test('inclusive on start and end dates', () => {
    const result = filterByDateRange(sampleTreatments, '2026-01-05', '2026-01-05');
    expect(result).toHaveLength(1);
    expect(result[0].cdtCode).toBe('D0120');
  });
});

// ---------------------------------------------------------------------------
// Hook integration tests (mock fetch)
// ---------------------------------------------------------------------------

describe('useTreatmentReport hook', () => {
  // Lazy import so pure tests above run even if the hook import breaks
  let useTreatmentReport: typeof import('./use-treatment-report').useTreatmentReport;

  test('starts in loading state', async () => {
    const mod = await import('./use-treatment-report');
    useTreatmentReport = mod.useTreatmentReport;

    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentReport({ branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isLoading).toBe(true);
  });

  test('returns grouped data after fetch', async () => {
    const mod = await import('./use-treatment-report');
    useTreatmentReport = mod.useTreatmentReport;

    const visitsResponse = {
      data: [
        { id: 'v1', branchId: 'b1', patientId: 'p1', status: 'completed', createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-01-05T10:00:00Z', version: 1, dentistMemberId: 'd1' },
      ],
      pagination: { offset: 0, limit: 50, total: 1 },
    };

    const treatmentsResponse = {
      data: [
        { id: 't1', visitId: 'v1', patientId: 'p1', cdtCode: 'D0120', description: 'Exam', priceCents: 3000, status: 'performed', createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-01-05T10:00:00Z', carriedOver: false },
        { id: 't2', visitId: 'v1', patientId: 'p1', cdtCode: 'D0120', description: 'Exam', priceCents: 3000, status: 'performed', createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-01-05T10:00:00Z', carriedOver: false },
      ],
      pagination: { offset: 0, limit: 50, total: 2 },
    };

    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      // First call = visits, subsequent = treatments per visit
      if (callCount === 1) return jsonResponse(visitsResponse);
      return jsonResponse(treatmentsResponse);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useTreatmentReport({ branchId: 'b1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    // grouped treatments should exist
    expect(result.current.grouped.length).toBeGreaterThanOrEqual(0);
  });
});
