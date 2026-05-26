/**
 * useQueueBoard — unit tests (G6-S9)
 *
 * Tests: loading state, successful fetch, error state, status update mutation.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useQueueBoard } from './use-queue-board';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const ITEMS = [
  { id: 'q1', branchId: 'b1', patientId: 'p1', patientName: 'Maria Santos', status: 'waiting', createdAt: '2026-05-26T09:00:00Z', updatedAt: '2026-05-26T09:00:00Z' },
  { id: 'q2', branchId: 'b1', patientId: 'p2', patientName: 'Ramon Cruz', status: 'called', createdAt: '2026-05-26T09:10:00Z', updatedAt: '2026-05-26T09:15:00Z' },
];

describe('useQueueBoard', () => {
  test('starts in loading state', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClientWithMutations();
    const { result } = renderHook(
      () => useQueueBoard('b1'),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isLoading).toBe(true);
  });

  test('returns items array on success', async () => {
    global.fetch = mock(() => jsonResponse(ITEMS));
    const qc = freshClientWithMutations();
    const { result } = renderHook(
      () => useQueueBoard('b1'),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]?.id).toBe('q1');
    expect(result.current.items[1]?.status).toBe('called');
  });

  test('unwraps { data: [...] } envelope', async () => {
    global.fetch = mock(() => jsonResponse({ data: ITEMS }));
    const qc = freshClientWithMutations();
    const { result } = renderHook(
      () => useQueueBoard('b1'),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(2);
  });

  test('unwraps { items: [...] } envelope', async () => {
    global.fetch = mock(() => jsonResponse({ items: ITEMS }));
    const qc = freshClientWithMutations();
    const { result } = renderHook(
      () => useQueueBoard('b1'),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(2);
  });

  test('sets isError on non-OK response', async () => {
    global.fetch = mock(() => jsonResponse({ error: 'Not found' }, 404));
    const qc = freshClientWithMutations();
    const { result } = renderHook(
      () => useQueueBoard('b1'),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.items).toHaveLength(0);
  });

  test('returns empty array initially (before fetch resolves)', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClientWithMutations();
    const { result } = renderHook(
      () => useQueueBoard('b1'),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.items).toEqual([]);
  });

  test('does not fetch when branchId is empty', () => {
    const fetchMock = mock(() => jsonResponse(ITEMS));
    global.fetch = fetchMock;
    const qc = freshClientWithMutations();
    renderHook(
      () => useQueueBoard(''),
      { wrapper: makeWrapper(qc) },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('updateStatus calls PATCH endpoint', async () => {
    const calls: { url: string; method: string; body: string }[] = [];
    global.fetch = mock((url: string | Request | URL, init?: RequestInit) => {
      const urlStr = url instanceof Request ? url.url : String(url);
      const method = (init?.method ?? (url instanceof Request ? url.method : 'GET')).toUpperCase();
      const body = typeof init?.body === 'string' ? init.body : '';
      calls.push({ url: urlStr, method, body });
      return jsonResponse(method === 'PATCH' ? { ...ITEMS[0], status: 'called' } : ITEMS);
    });
    const qc = freshClientWithMutations();
    const { result } = renderHook(
      () => useQueueBoard('b1'),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.updateStatus('q1', 'called'); });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toContain('/dental/queue-items/q1/status');
    expect(JSON.parse(patch.body)).toEqual({ status: 'called' });
  });
});
