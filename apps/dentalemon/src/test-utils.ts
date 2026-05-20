/**
 * Shared test utilities for hook tests.
 *
 * Provides a QueryClient factory, a wrapper component factory, and a JSON
 * response helper used across all hook unit tests.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

/** Create a QueryClient with retries disabled (queries only). */
export function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Create a QueryClient with retries disabled for both queries and mutations. */
export function freshClientWithMutations() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** Wrap a QueryClient in a React provider component suitable for renderHook. */
export function makeWrapper(qc: QueryClient) {
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

/** Resolve a mock fetch call with a JSON body and the given HTTP status. */
export function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}
