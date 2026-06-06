/**
 * useRecallDueList — unit tests (P1-24, P3)
 *
 * The front-desk recare chase list must surface OVERDUE recalls. The due endpoint
 * defaults `from` to today, which silently drops past-due recalls — the patients
 * who most need outreach. The hook must therefore look back by default.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useRecallDueList } from './use-recall-due-list';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

function captureUrl(data: unknown, status = 200) {
  let capturedUrl = '';
  const fetchMock = mock((req: Request | string | URL) => {
    capturedUrl = req instanceof Request ? req.url : String(req);
    return jsonResponse(data, status);
  });
  return { getUrl: () => capturedUrl, fetchMock };
}

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

describe('useRecallDueList', () => {
  test('does not fetch when branchId is absent — query is disabled', () => {
    const { fetchMock } = captureUrl([]);
    global.fetch = fetchMock;
    const qc = freshClient();
    const { result } = renderHook(() => useRecallDueList({}), { wrapper: makeWrapper(qc) });
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Regression (overdue chase): the calendar Recare panel passes only branchId.
  // If the hook lets the backend default `from` to today, every overdue recall is
  // hidden from the front desk. The hook must default `from` to a far-past floor.
  test('defaults `from` to a far-past floor so overdue recalls surface', async () => {
    const { getUrl, fetchMock } = captureUrl([]);
    global.fetch = fetchMock;
    const qc = freshClient();
    const { result } = renderHook(() => useRecallDueList({ branchId: 'b1' }), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getUrl()).toContain('from=2000-01-01');
    expect(getUrl()).toContain('branchId=b1');
  });

  test('an explicit `from` overrides the floor', async () => {
    const { getUrl, fetchMock } = captureUrl([]);
    global.fetch = fetchMock;
    const qc = freshClient();
    const { result } = renderHook(
      () => useRecallDueList({ branchId: 'b1', from: '2026-01-01' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getUrl()).toContain('from=2026-01-01');
    expect(getUrl()).not.toContain('from=2000-01-01');
  });

  test('returns recalls array on success', async () => {
    global.fetch = mock(() => jsonResponse([
      { id: 'r1', patientId: 'p1', patientName: 'Overdue Olivia', type: 'cleaning', dueDate: '2024-01-01', status: 'pending', intervalMonths: 6, sendAttempts: 0, lastSentAt: null },
    ]));
    const qc = freshClient();
    const { result } = renderHook(() => useRecallDueList({ branchId: 'b1' }), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.recalls).toHaveLength(1);
    expect(result.current.recalls[0]!.patientName).toBe('Overdue Olivia');
  });
});
