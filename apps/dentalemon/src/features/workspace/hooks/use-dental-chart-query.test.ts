/**
 * useDentalChart — unit tests
 *
 * Tests the hook that fetches tooth chart data for a visit.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useDentalChart } from './use-dental-chart-query';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const mockTeeth = [
  { toothNumber: 11, state: 'healthy' },
  { toothNumber: 21, state: 'caries' },
];

describe('useDentalChart', () => {
  test('returns teeth array on successful fetch', async () => {
    global.fetch = mock(() =>
      jsonResponse({ teeth: mockTeeth }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useDentalChart({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.teeth).toHaveLength(2);
    expect(result.current.teeth[0]!.toothNumber).toBe(11);
  });

  test('does not fetch when visitId is null', async () => {
    let fetchCalled = false;
    global.fetch = mock(() => {
      fetchCalled = true;
      return jsonResponse({ teeth: [] });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useDentalChart({ visitId: null }),
      { wrapper: makeWrapper(qc) },
    );

    // give it a tick to potentially fire the fetch
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchCalled).toBe(false);
    expect(result.current.teeth).toHaveLength(0);
  });

  test('returns error on fetch failure', async () => {
    global.fetch = mock(() =>
      jsonResponse({}, 500),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useDentalChart({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.teeth).toHaveLength(0);
  });

  test('empty teeth array when response has no teeth field', async () => {
    global.fetch = mock(() =>
      jsonResponse({}),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useDentalChart({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.teeth).toHaveLength(0);
  });

  test('selectTooth updates selectedTooth', async () => {
    global.fetch = mock(() =>
      jsonResponse({ teeth: mockTeeth }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useDentalChart({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedTooth).toBeNull();

    act(() => result.current.selectTooth(11));
    expect(result.current.selectedTooth).toBe(11);
  });

  test('selectTooth toggles off when same tooth is selected again', async () => {
    global.fetch = mock(() =>
      jsonResponse({ teeth: mockTeeth }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useDentalChart({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.selectTooth(11));
    act(() => result.current.selectTooth(11));
    expect(result.current.selectedTooth).toBeNull();
  });

  test('clearSelection resets selectedTooth to null', async () => {
    global.fetch = mock(() =>
      jsonResponse({ teeth: mockTeeth }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useDentalChart({ visitId: 'v1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.selectTooth(21));
    act(() => result.current.clearSelection());
    expect(result.current.selectedTooth).toBeNull();
  });
});
