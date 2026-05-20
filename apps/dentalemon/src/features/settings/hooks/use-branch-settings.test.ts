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
 * - Successful PUT invalidates ['branch-settings', branchId]
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useBranchSettings, useUpdateBranchSettings } from './use-branch-settings';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const BRANCH_ID = 'branch-abc';
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
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ settings: mockSettings }),
      } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings?.clinicName).toBe('Happy Smiles Dental');
    expect(result.current.settings?.feeSchedule).toEqual({ D0120: 50000, D1110: 80000 });
    expect(result.current.error).toBeNull();
  });

  test('returns empty object when response has no settings key', async () => {
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toEqual({});
    expect(result.current.error).toBeNull();
  });

  test('exposes error when fetch returns non-ok status', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('500');
  });

  test('does not fetch when branchId is null', () => {
    const fetchSpy = mock(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ settings: {} }) } as Response));
    global.fetch = fetchSpy;
    const qc = freshClient();
    renderHook(() => useBranchSettings(null), { wrapper: makeWrapper(qc) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('isLoading is false when branchId is null', () => {
    global.fetch = mock(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response));
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
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ settings: { clinicName: 'Updated Clinic' } }),
      } as Response),
    );
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
      Promise.resolve({ ok: false, status: 422 } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useUpdateBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      // eslint-disable-next-line no-empty
      try { await result.current.update({ clinicName: '' }); } catch {}
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toContain('422');
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
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ settings: {} }),
      } as Response),
    );
    const qc = freshClient();
    // Prime the cache
    qc.setQueryData(['branch-settings', BRANCH_ID], { clinicName: 'Old Name' });

    const { result } = renderHook(() => useUpdateBranchSettings(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.update({ clinicName: 'New Name' });
    });
    // After invalidation, the cached data should be marked stale (isInvalidated)
    const queryState = qc.getQueryState(['branch-settings', BRANCH_ID]);
    expect(queryState?.isInvalidated).toBe(true);
  });

  test('reset clears error state', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
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
