/**
 * Shared test utilities for hook tests.
 *
 * Provides a QueryClient factory, a wrapper component factory, and a JSON
 * response helper used across all hook unit tests.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { SdkError } from '@monobase/sdk-ts/client';

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

/**
 * Build a REAL `SdkError` exactly as the SDK error interceptor produces at runtime
 * (`packages/sdk-ts/src/client.ts:wrapError` → installed in `react/provider.tsx`).
 * Every non-2xx the app sees is an `SdkError` whose `.body` is the FLAT backend
 * envelope and whose `.message` is the human string. Error-handling tests MUST use
 * this — not a hand-authored `{ error: {...} }` object — so fixtures can't drift
 * from the real thrown shape (the exact drift that hid the create-visit bug).
 */
export function makeSdkError(
  status: number,
  body: { code?: string; message?: string; [k: string]: unknown },
): SdkError {
  return new SdkError({
    status,
    url: '/test',
    method: 'POST',
    body: { statusCode: status, ...body },
    // wrapError copies the body's message onto the Error.message; mirror that.
    message: typeof body.message === 'string' ? body.message : undefined,
  });
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

// ───────────────────────────────────────────────────────────────────────────
// Cross-element coherence oracle (bug class: "a figure a human reads is computed
// from a different source than the body/action it labels"). The expected value
// is derived FROM the rendered DOM rows — never from a fixture constant — so a
// header that reads a different source than the body fails even when the fixture
// happens to agree. Use in render tests for any summary header + itemised body.
// ───────────────────────────────────────────────────────────────────────────

/** Parse a money-formatted string like "₱3,500.00" or "5500" into a number. NaN if none. */
export function parseMoney(text: string | null | undefined): number {
  if (!text) return NaN;
  const cleaned = text.replace(/[^0-9.-]/g, '');
  return cleaned === '' || cleaned === '-' ? NaN : Number(cleaned);
}

/**
 * Assert a summary total equals the sum of the amounts actually rendered in the
 * body, and that a non-zero total is never shown with zero rows to explain it.
 * Throws (test fails) on mismatch — pass amounts parsed from the live DOM.
 */
export function assertTotalExplainedByRows(opts: {
  total: number;
  rowAmounts: number[];
  label?: string;
}): void {
  const { total, rowAmounts, label = 'total' } = opts;
  const sum = rowAmounts.reduce((a, b) => a + b, 0);
  // compare in integer minor units to avoid float drift
  if (Math.round(total * 100) !== Math.round(sum * 100)) {
    throw new Error(
      `${label} reads ${total} but the ${rowAmounts.length} rendered rows sum to ${sum}`,
    );
  }
  if (total !== 0 && rowAmounts.length === 0) {
    throw new Error(`${label} is ${total} but no rows are rendered to explain it`);
  }
}

/**
 * Assert a count a user reads matches the number of items the adjacent action
 * actually operates on (e.g. a "Continue to Payment (N)" button vs the line
 * items the payment modal will bill).
 */
export function assertCountMatchesItems(opts: {
  count: number;
  itemCount: number;
  label?: string;
}): void {
  const { count, itemCount, label = 'count' } = opts;
  if (count !== itemCount) {
    throw new Error(`${label} reads ${count} but ${itemCount} item(s) are present`);
  }
}
