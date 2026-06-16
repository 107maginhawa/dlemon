/**
 * useDiscardVisit — unit tests.
 *
 * The owner "Discard visit" escape hatch: POSTs to /dental/visits/:id/discard with
 * a reason, then invalidates the patient's visits so the discarded one drops out
 * and New Visit re-enables. Errors surface via the central toast helper.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useDiscardVisit } from './use-discard-visit';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

const _toastError = mock(() => {});
mock.module('sonner', () => ({ toast: { error: _toastError, success: mock(() => {}) } }));

afterEach(cleanup);
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

describe('useDiscardVisit', () => {
  test('POSTs reason to /dental/visits/:id/discard', async () => {
    const calls: { url: string; method: string; body: any }[] = [];
    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      const r = typeof req === 'string' || req instanceof URL ? null : req;
      const url = r ? r.url : String(req);
      const method = (init?.method ?? r?.method ?? 'GET').toUpperCase();
      let body: any = null;
      if (init?.body) body = JSON.parse(init.body as string);
      else if (r) { try { body = await r.clone().json(); } catch { /* */ } }
      calls.push({ url, method, body });
      return jsonResponse({ id: 'v1', patientId: 'p1', status: 'discarded', createdAt: '2026-06-01T00:00:00Z' });
    }) as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(() => useDiscardVisit('p1'), { wrapper: makeWrapper(qc) });
    await result.current.discard('v1', 'Patient left without being seen');

    const post = calls.find((c) => c.method === 'POST' && /\/dental\/visits\/v1\/discard$/.test(c.url));
    expect(post, 'a POST to the discard endpoint was issued').toBeTruthy();
    expect(post!.body.reason).toBe('Patient left without being seen');
  });

  test('surfaces the backend message when discard is rejected', async () => {
    const callsBefore = _toastError.mock.calls.length;
    global.fetch = mock(() =>
      jsonResponse({ code: 'VISIT_NOT_DISCARDABLE', message: 'Cannot discard a visit with performed or billed treatments — complete it instead.', statusCode: 422 }, 422),
    ) as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(() => useDiscardVisit('p1'), { wrapper: makeWrapper(qc) });
    await result.current.discard('v1', 'try to discard performed work').catch(() => {});

    await waitFor(() => expect(_toastError.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(_toastError.mock.calls.at(-1)?.[0]).toMatch(/complete it instead/i);
  });
});
