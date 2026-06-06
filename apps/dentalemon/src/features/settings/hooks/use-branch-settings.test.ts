/**
 * useBranchSettings + useUpdateBranchSettings — unit tests
 *
 * Tests cover:
 * - Loading state while fetch is in flight
 * - Successful GET → settings returned
 * - GET error → error exposed
 * - Disabled when branchId is null
 * - PUT succeeds → mutation reports success
 * - PUT fails → error exposed on mutation
 * - Successful PUT invalidates branch-settings query
 *
 * The SDK reads response.text() and parses JSON; tests use proper Response
 * objects via jsonResponse() so the SDK client can process them correctly.
 * The API returns the settings object directly (not wrapped in { settings: ... }).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useBranchSettings, useUpdateBranchSettings, branchSettingsKey } from './use-branch-settings';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const BRANCH_ID = 'branch-abc';

// API returns DentalOrgModuleDentalBranchSettings directly (no { settings: ... } wrapper)
const mockSettings = {
  clinicName: 'Happy Smiles Dental',
  clinicAddress: '123 Mabuhay St, Makati',
  clinicPhone: '+63 2 8888 8888',
  clinicEmail: 'info@happysmiles.ph',
  logoUrl: '',
  dentistLicenseNumber: 'D-12345',
  locale: 'PH',
  feeSchedule: { D0120: 50000, D1110: 80000 },
};

describe('useBranchSettings — GET', () => {
  test('starts in loading state when branchId is provided', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(
      () => useBranchSettings(BRANCH_ID),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.settings).toBeNull();
  });

  test('returns settings on successful fetch', async () => {
    // API returns the settings object directly (SDK unwraps the response body)
    global.fetch = mock(() => jsonResponse(mockSettings));
    const qc = freshClient();
    const { result } = renderHook(() => useBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings?.clinicName).toBe('Happy Smiles Dental');
    expect(result.current.settings?.feeSchedule).toEqual({ D0120: 50000, D1110: 80000 });
    expect(result.current.error).toBeNull();
  });

  test('returns empty-ish settings when response has no known fields', async () => {
    // The SDK returns whatever the API sends; with an empty object the settings is just {}
    global.fetch = mock(() => jsonResponse({}));
    const qc = freshClient();
    const { result } = renderHook(() => useBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // SDK returns {} directly — settings is truthy with no clinicName
    expect(result.current.settings).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  test('exposes error when fetch returns non-ok status', async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ message: 'internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // The SDK throws the parsed JSON body as the error object (not an Error with status code).
    expect(result.current.error).not.toBeNull();
  });

  test('does not fetch when branchId is null', () => {
    const fetchSpy = mock(() => jsonResponse({}));
    global.fetch = fetchSpy;
    const qc = freshClient();
    renderHook(() => useBranchSettings(null), { wrapper: makeWrapper(qc) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('isLoading is false when branchId is null', () => {
    global.fetch = mock(() => jsonResponse({}));
    const qc = freshClient();
    const { result } = renderHook(() => useBranchSettings(null), { wrapper: makeWrapper(qc) });
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useUpdateBranchSettings — PUT', () => {
  test('isPending is false before mutation is triggered', () => {
    const qc = freshClient();
    const { result } = renderHook(() => useUpdateBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    expect(result.current.isPending).toBe(false);
  });

  test('resolves successfully when PUT returns ok', async () => {
    global.fetch = mock(() => jsonResponse({ clinicName: 'Updated Clinic' }));
    const qc = freshClient();
    const { result } = renderHook(() => useUpdateBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.update({ clinicName: 'Updated Clinic' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.error).toBeNull();
  });

  test('exposes error when PUT returns non-ok status', async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ message: 'unprocessable' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useUpdateBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      // eslint-disable-next-line no-empty
      try { await result.current.update({ clinicName: '' }); } catch {}
    });
    // The SDK throws the parsed JSON body as the error object — just verify error is set.
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  test('rejects immediately when branchId is null', async () => {
    const qc = freshClient();
    const { result } = renderHook(() => useUpdateBranchSettings(null), { wrapper: makeWrapper(qc) });
    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.update({ clinicName: 'Test' }); } catch (e) { caught = e as Error; }
    });
    expect(caught?.message).toBe('No branch selected');
  });

  test('invalidates branch-settings query after successful PUT', async () => {
    global.fetch = mock(() => jsonResponse(mockSettings));
    const qc = freshClient();

    // Pre-seed the cache so there is a query entry to invalidate.
    qc.setQueryData(branchSettingsKey(BRANCH_ID), mockSettings);

    const { result } = renderHook(() => useUpdateBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.update({ clinicName: 'New Name' });
    });
    // After invalidation the cached entry should be marked stale.
    const state = qc.getQueryCache()
      .findAll({ type: 'all' })
      .find(q => JSON.stringify(q.queryKey).includes(BRANCH_ID));
    expect(state?.state.isInvalidated).toBe(true);
  });

  test('reset clears error state', async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ message: 'server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useUpdateBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      // eslint-disable-next-line no-empty
      try { await result.current.update({}); } catch {}
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => { result.current.reset(); });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.isSuccess).toBe(false);
  });
});
