/**
 * usePreviousVisitDeferred — FIX-002 carry-over candidate source.
 * Reads the previous visit's treatment list and surfaces the dismissed (deferred) ids.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { freshClient, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import { usePreviousVisitDeferred } from './use-previous-visit-deferred';

function makeWrapper() {
  return makeWrapperBase(freshClient());
}

afterEach(cleanup);

const VISITS = [
  { id: 'v-old', createdAt: '2024-01-01T09:00:00Z' },
  { id: 'v-prev', createdAt: '2024-03-01T09:00:00Z' }, // most recent prior → "previous visit"
];

describe('usePreviousVisitDeferred', () => {
  test('returns the dismissed (deferred) treatment ids from the most-recent previous visit', async () => {
    const originalFetch = global.fetch;
    const urls: string[] = [];
    global.fetch = mock((req: Request | string | URL) => {
      urls.push(req instanceof Request ? req.url : String(req));
      return jsonResponse({
        data: [
          { id: 'tx-dismissed', status: 'dismissed', priceCents: 1000 },
          { id: 'tx-performed', status: 'performed', priceCents: 2000 },
        ],
      });
    }) as unknown as typeof fetch;
    try {
      const { result } = renderHook(
        () => usePreviousVisitDeferred({ visits: VISITS, currentVisitId: 'v-current' }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.deferredIds).toEqual(['tx-dismissed']));
      // it queried the most-recent prior visit, not the older one
      expect(urls.some((u) => u.includes('v-prev'))).toBe(true);
      expect(result.current.previousVisitId).toBe('v-prev');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('returns empty (and does not query) when there is no previous visit', () => {
    const { result } = renderHook(
      () =>
        usePreviousVisitDeferred({
          visits: [{ id: 'v-current', createdAt: '2024-03-01T09:00:00Z' }],
          currentVisitId: 'v-current',
        }),
      { wrapper: makeWrapper() },
    );
    expect(result.current.deferredIds).toEqual([]);
    expect(result.current.previousVisitId).toBeNull();
  });
});
