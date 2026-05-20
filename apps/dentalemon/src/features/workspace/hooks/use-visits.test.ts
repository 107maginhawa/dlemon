/**
 * useVisits — unit tests
 *
 * Tests the hook that loads a patient's visit list.
 * Replaces the broken use-visit.ts (which always returned null).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useVisits } from './use-visits';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const mockVisits = [
  { id: 'v1', patientId: 'p1', status: 'active', chiefComplaint: 'Toothache', createdAt: '2026-05-01T08:00:00Z' },
  { id: 'v2', patientId: 'p1', status: 'completed', chiefComplaint: 'Cleaning', createdAt: '2026-03-10T09:00:00Z' },
];

const mockPagination = { offset: 0, limit: 20, count: 2, totalCount: 2, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false };

describe('useVisits', () => {
  test('returns visits array on successful fetch', async () => {
    global.fetch = mock(() =>
      jsonResponse({ data: mockVisits, pagination: mockPagination }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.visits).toHaveLength(2);
    expect(result.current.visits[0]!.id).toBe('v1');
    expect(result.current.visits[0]!.status).toBe('active');
  });

  test('includes patientId in fetch URL', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({ data: [], pagination: { offset: 0, limit: 20, count: 0, totalCount: 0, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false } });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('patientId=p1');
  });

  test('includes branchId in fetch URL when provided', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({ data: [], pagination: { offset: 0, limit: 20, count: 0, totalCount: 0, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false } });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1', branchId: 'branch-123' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('patientId=p1');
    expect(capturedUrl).toContain('branchId=branch-123');
  });

  test('activeVisit is the visit with status=active', async () => { // [BR-001]
    global.fetch = mock(() =>
      jsonResponse({ data: mockVisits, pagination: mockPagination }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeVisit?.id).toBe('v1');
  });

  test('activeVisit is null when no active visit exists', async () => {
    const completedVisits = [
      { id: 'v2', patientId: 'p1', status: 'completed', chiefComplaint: 'Cleaning', createdAt: '2026-03-10T09:00:00Z' },
    ];
    global.fetch = mock(() =>
      jsonResponse({ data: completedVisits, pagination: { offset: 0, limit: 20, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false } }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeVisit).toBeNull();
  });

  test('returns empty array and error on fetch failure', async () => {
    global.fetch = mock(() =>
      jsonResponse({}, 500),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.visits).toHaveLength(0);
    expect(result.current.error).not.toBeNull();
  });
});
