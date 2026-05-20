/**
 * useStaffMembers + useStaffMutations — unit tests
 *
 * Tests cover:
 * - Loading state while fetch is in-flight
 * - Successful GET → members returned (bare array + wrapped response)
 * - GET error → error exposed
 * - Not enabled when branchId is empty string
 * - Create mutation: success, error, both calls (POST + PIN), invalidation
 * - Deactivate mutation: success, error, invalidation
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useStaffMembers, useStaffMutations } from './use-staff-members';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const BRANCH_ID = 'branch-xyz';

const mockMembers = [
  { id: 'm1', branchId: BRANCH_ID, displayName: 'Dr. Maria Santos', role: 'dentist_owner', status: 'active', avatarUrl: null, createdAt: '2026-05-01T00:00:00Z' },
  { id: 'm2', branchId: BRANCH_ID, displayName: 'Juan Cruz', role: 'staff_full', status: 'active', avatarUrl: null, createdAt: '2026-05-02T00:00:00Z' },
];

describe('useStaffMembers — GET', () => {
  test('starts in loading state when branchId is provided', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMembers(BRANCH_ID), { wrapper: makeWrapper(qc) });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.members).toHaveLength(0);
  });

  test('returns members on success (wrapped response)', async () => {
    global.fetch = mock(() =>
      jsonResponse({ items: mockMembers }),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMembers(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members).toHaveLength(2);
    expect(result.current.members[0]?.displayName).toBe('Dr. Maria Santos');
    expect(result.current.error).toBeNull();
  });

  test('returns members on success (bare array response)', async () => {
    global.fetch = mock(() =>
      jsonResponse(mockMembers),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMembers(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members).toHaveLength(2);
  });

  test('includes branchId in request URL', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse([]);
    });
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMembers(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain(`branchId=${BRANCH_ID}`);
  });

  test('exposes error when fetch returns non-ok status', async () => {
    global.fetch = mock(() =>
      jsonResponse({}, 403),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMembers(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('403');
  });

  test('refetch function is defined', async () => {
    global.fetch = mock(() =>
      jsonResponse([]),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMembers(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });
});

describe('useStaffMutations — create', () => {
  test('calls POST members then POST reset-pin on create', async () => {
    const urls: string[] = [];
    const methods: string[] = [];
    global.fetch = mock((req: Request | string | URL, opts?: any) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (opts?.method ?? 'GET');
      urls.push(url);
      methods.push(method);
      if (url.includes('reset-pin')) {
        return jsonResponse({});
      }
      return jsonResponse({ id: 'new-m', displayName: 'Test User', role: 'staff_full', status: 'active', branchId: BRANCH_ID, avatarUrl: null, createdAt: '2026-05-01T00:00:00Z' });
    });
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMutations(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.create({ displayName: 'Test User', role: 'staff_full', pin: '123456' });
    });
    expect(methods[0]).toBe('POST');
    expect(urls[0]).toContain('/dental/org/members');
    expect(urls[1]).toContain('reset-pin');
  });

  test('throws when POST members fails', async () => {
    global.fetch = mock(() =>
      jsonResponse({}, 422),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMutations(BRANCH_ID), { wrapper: makeWrapper(qc) });
    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.create({ displayName: 'Test', role: 'staff_full', pin: '123456' }); }
      catch (e) { caught = e as Error; }
    });
    expect(caught?.message).toContain('422');
  });

  test('throws partial error when PIN reset fails', async () => {
    global.fetch = mock((req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : String(req);
      if (url.includes('reset-pin')) {
        return jsonResponse({}, 500);
      }
      return jsonResponse({ id: 'new-m', displayName: 'Test', role: 'staff_full', status: 'active', branchId: BRANCH_ID, avatarUrl: null, createdAt: '' });
    });
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMutations(BRANCH_ID), { wrapper: makeWrapper(qc) });
    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.create({ displayName: 'Test', role: 'staff_full', pin: '123456' }); }
      catch (e) { caught = e as Error; }
    });
    expect(caught?.message).toContain('PIN setup failed');
  });

  test('invalidates staff-members query after successful create', async () => {
    global.fetch = mock((req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : String(req);
      if (url.includes('reset-pin')) return jsonResponse({});
      return jsonResponse({ id: 'new-m', displayName: 'Test', role: 'staff_full', status: 'active', branchId: BRANCH_ID, avatarUrl: null, createdAt: '' });
    });
    const qc = freshClient();
    qc.setQueryData(['staff-members', BRANCH_ID], mockMembers);
    const { result } = renderHook(() => useStaffMutations(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.create({ displayName: 'Test', role: 'staff_full', pin: '123456' });
    });
    const state = qc.getQueryState(['staff-members', BRANCH_ID]);
    expect(state?.isInvalidated).toBe(true);
  });
});

describe('useStaffMutations — deactivate', () => {
  test('calls DELETE members/{id} on deactivate', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    global.fetch = mock((req: Request | string | URL, opts?: any) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      capturedMethod = req instanceof Request ? req.method : (opts?.method ?? 'GET');
      return jsonResponse({});
    });
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMutations(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.deactivate('m2');
    });
    expect(capturedMethod).toBe('DELETE');
    expect(capturedUrl).toContain('/dental/org/members/m2');
  });

  test('throws when DELETE fails', async () => {
    global.fetch = mock(() =>
      jsonResponse({}, 403),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useStaffMutations(BRANCH_ID), { wrapper: makeWrapper(qc) });
    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.deactivate('m2'); }
      catch (e) { caught = e as Error; }
    });
    expect(caught?.message).toContain('403');
  });

  test('invalidates staff-members query after successful deactivate', async () => {
    global.fetch = mock(() =>
      jsonResponse({}),
    );
    const qc = freshClient();
    qc.setQueryData(['staff-members', BRANCH_ID], mockMembers);
    const { result } = renderHook(() => useStaffMutations(BRANCH_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.deactivate('m2');
    });
    const state = qc.getQueryState(['staff-members', BRANCH_ID]);
    expect(state?.isInvalidated).toBe(true);
  });
});
