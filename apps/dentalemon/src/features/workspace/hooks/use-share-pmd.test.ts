/**
 * useSharePMD — unit tests
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useSharePMD } from './use-share-pmd';
import { freshClientWithMutations as freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const input = { visitId: 'v1', patientId: 'p1' };

describe('useSharePMD', () => {
  test('success: returns PMD result with checksum', async () => {
    global.fetch = mock(() => jsonResponse({ checksum: 'abc123', url: 'https://example.com/pmd' }));

    const qc = freshClient();
    const { result } = renderHook(
      () => useSharePMD(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.checksum).toBe('abc123');
  });

  test('success: fetch URL targets pmd endpoint for visitId', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({ checksum: 'abc123', url: 'https://example.com/pmd' });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useSharePMD(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/dental/visits/v1/pmd');
  });

  test('error: sets isError on fetch failure', async () => {
    global.fetch = mock(() => jsonResponse({}, 500));

    const qc = freshClient();
    const { result } = renderHook(
      () => useSharePMD(),
      { wrapper: makeWrapper(qc) },
    );

    result.current.mutate(input);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isError).toBe(true);
  });
});
