/**
 * useAppointments — unit tests
 *
 * TanStack Query hook that loads appointments by date (day view)
 * or week start (week view). Replaces the inline fetch in calendar.tsx.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useAppointments } from './use-appointments';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

function captureUrl(data: unknown, status = 200): { getUrl: () => string; fetchMock: ReturnType<typeof mock> } {
  let capturedUrl = '';
  const fetchMock = mock((req: Request | string | URL) => {
    capturedUrl = req instanceof Request ? req.url : String(req);
    return jsonResponse(data, status);
  });
  return { getUrl: () => capturedUrl, fetchMock };
}

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const mockAppointments = [
  { id: 'a1', patientId: 'p1', patientName: 'Maria Santos', scheduledAt: '2026-05-04T09:00:00Z', status: 'scheduled', durationMinutes: 30, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'a2', patientId: 'p2', patientName: 'Ramon Cruz', scheduledAt: '2026-05-04T10:00:00Z', status: 'completed', durationMinutes: 45, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
];

describe('useAppointments', () => {
  test('starts in loading state', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isLoading).toBe(true);
  });

  test('returns appointments array on success', async () => {
    global.fetch = mock(() => jsonResponse(mockAppointments));
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.appointments).toHaveLength(2);
    expect(result.current.appointments[0]?.id).toBe('a1');
  });

  test('returns empty array when response has no appointments', async () => {
    global.fetch = mock(() => jsonResponse([]));
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.appointments).toHaveLength(0);
  });

  test('V-SCH-004: uses date_from/date_to window for day view', async () => {
    const { getUrl, fetchMock } = captureUrl([]);
    global.fetch = fetchMock;
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Day view: date_from === date_to === the requested date.
    expect(getUrl()).toContain('date_from=2026-05-04');
    expect(getUrl()).toContain('date_to=2026-05-04');
    expect(getUrl()).not.toContain('weekStart');
  });

  test('V-SCH-004: uses date_from/date_to window for week view (Monday → Sunday)', async () => {
    const { getUrl, fetchMock } = captureUrl([]);
    global.fetch = fetchMock;
    const qc = freshClient();
    // 2026-05-04 is a Monday — getMondayOfWeek returns same date; window spans 7 days.
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'week' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getUrl()).toContain('date_from=2026-05-04');
    expect(getUrl()).toContain('date_to=2026-05-10');
  });

  test('sets error when fetch fails', async () => {
    global.fetch = mock(() => jsonResponse({ message: 'Internal Server Error' }, 500));
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  test('V-FE-ERR-002: on failure surfaces error + refetch with empty list (calendar must render error, not empty)', async () => {
    global.fetch = mock(() => jsonResponse({ message: 'Internal Server Error' }, 500));
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    // The calendar route branches on `error` first; appointments stays empty,
    // so without the error branch it would collapse to the empty-grid state.
    expect(result.current.appointments).toHaveLength(0);
    expect(typeof result.current.refetch).toBe('function');
  });

  test('refetch function is defined', async () => {
    global.fetch = mock(() => jsonResponse([]));
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });
});
