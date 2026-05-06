/**
 * useSharePMD — unit tests
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useSharePMD } from './use-share-pmd';

afterEach(cleanup);

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const input = { visitId: 'v1', patientId: 'p1' };

describe('useSharePMD', () => {
  test('success: returns PMD result with checksum', async () => {
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ checksum: 'abc123', url: 'https://example.com/pmd' }),
      } as Response),
    );

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
    global.fetch = mock((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ checksum: 'abc123', url: 'https://example.com/pmd' }),
      } as Response);
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
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
    );

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
