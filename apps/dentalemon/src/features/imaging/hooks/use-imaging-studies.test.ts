/**
 * useImagingStudies — unit tests
 *
 * Covers the query happy path, empty result, disabled state (no patientId),
 * URL shape, and error handling.
 * Network fetch is mocked via global.fetch override — no MSW.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useImagingStudies, type PatientImageItem } from './use-imaging-studies';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

function makeImageItem(overrides: Partial<PatientImageItem> = {}): PatientImageItem {
  return {
    id: 'img-1',
    patientId: 'p1',
    studyId: 'study-1',
    type: 'periapical',
    capturedAt: '2026-01-01T10:00:00Z',
    thumbnailUrl: null,
    fullUrl: null,
    toothNumber: null,
    ...overrides,
  } as PatientImageItem;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useImagingStudies', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('returns items and total on successful fetch', async () => {
    const items = [makeImageItem({ id: 'img-1' }), makeImageItem({ id: 'img-2' })];
    global.fetch = mock(() => jsonResponse({ items, total: 2 }));

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingStudies('p1', 'branch-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
    expect(result.current.data?.items[0]!.id).toBe('img-1');
    expect(result.current.error).toBeNull();
  });

  test('returns empty items list when no studies exist', async () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0 }));

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingStudies('p1', 'branch-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.items).toHaveLength(0);
    expect(result.current.data?.total).toBe(0);
  });

  test('hits the correct URL with patientId', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({ items: [], total: 0 });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingStudies('patient-99', 'branch-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('/dental/patients/patient-99/images');
  });

  test('is disabled when patientId is empty string', async () => {
    const fetchSpy = mock(() => jsonResponse({ items: [], total: 0 }));
    global.fetch = fetchSpy;

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingStudies('', 'branch-1'),
      { wrapper: makeWrapper(qc) },
    );

    // Query is disabled by empty patientId — isLoading stays false, data is undefined
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('exposes error on non-ok response', async () => {
    global.fetch = mock(() =>
      jsonResponse({ message: 'Forbidden' }, 403),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingStudies('p-bad', 'branch-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.data).toBeUndefined();
  });

  test('exposes error on network failure', async () => {
    global.fetch = mock(() => Promise.reject(new Error('Network error')));

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingStudies('p1', 'branch-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  test('uses correct query key structure', async () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0 }));

    const qc = freshClient();
    renderHook(
      () => useImagingStudies('p1', 'branch-1'),
      { wrapper: makeWrapper(qc) },
    );

    // Query key includes patientId + branchId so cache is per-patient per-branch
    await waitFor(() =>
      expect(qc.getQueryData(['imaging', 'patient', 'p1', 'branch-1'])).not.toBeUndefined(),
    );
  });
});
