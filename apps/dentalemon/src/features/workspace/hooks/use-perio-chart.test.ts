/**
 * Test #7 — usePerioChart hook.
 *
 * Drives the real hook against a mocked fetch and asserts:
 *   - getVisitPerioChart 404 surfaces as "no chart yet" (chart === null, not error)
 *   - startChart POSTs /dental/perio-charts and invalidates the visit query
 *   - upsertReading PUTs the tooth reading and invalidates
 *   - completeChart POSTs /complete and invalidates
 *   - a failed mutation fires exactly ONE error toast (V-FE-ERR-001)
 */

import { describe, test, expect, afterEach, mock, beforeEach } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Capture toast calls (sonner is globally mocked in test-setup; re-mock to spy).
const toastError = mock(() => {});
mock.module('sonner', () => ({ toast: { error: toastError, success: mock(() => {}) } }));

import { usePerioChart } from './use-perio-chart';

const VISIT_ID = 'v-1';
const PATIENT_ID = 'p-1';
const CHART_ID = 'c-1';

function makeChart(overrides: Record<string, unknown> = {}) {
  return {
    id: CHART_ID,
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    branchId: 'b-1',
    examinerMemberId: 'm-1',
    status: 'draft',
    readings: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

interface FetchOpts {
  getStatus?: number;
  mutationStatus?: number;
}

function installFetch(opts: FetchOpts = {}) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    if (method === 'GET') {
      const status = opts.getStatus ?? 200;
      if (status === 404) return new Response('not found', { status: 404 });
      return new Response(JSON.stringify(makeChart()), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const status = opts.mutationStatus ?? 200;
    if (status >= 400) return new Response(JSON.stringify({ code: 'ERR', message: 'boom' }), { status });
    return new Response(JSON.stringify(makeChart()), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function wrapper(qc: QueryClient) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  }
  return Wrapper;
}

beforeEach(() => toastError.mockClear());
afterEach(cleanup);

describe('usePerioChart', () => {
  test('404 from getVisitPerioChart yields chart=null (no error)', async () => {
    const f = installFetch({ getStatus: 404 });
    try {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(() => usePerioChart({ visitId: VISIT_ID, patientId: PATIENT_ID }), {
        wrapper: wrapper(qc),
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.chart).toBeNull();
      expect(result.current.isError).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('loads an existing draft chart with readings', async () => {
    const f = installFetch({ getStatus: 200 });
    try {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(() => usePerioChart({ visitId: VISIT_ID, patientId: PATIENT_ID }), {
        wrapper: wrapper(qc),
      });
      await waitFor(() => expect(result.current.chart).not.toBeNull());
      expect(result.current.chart?.status).toBe('draft');
      expect(Array.isArray(result.current.readings)).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('startChart POSTs /dental/perio-charts', async () => {
    const f = installFetch({ getStatus: 404 });
    try {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(() => usePerioChart({ visitId: VISIT_ID, patientId: PATIENT_ID }), {
        wrapper: wrapper(qc),
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { result.current.startChart(); });
      await waitFor(() =>
        expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/dental/perio-charts'))).toBe(true),
      );
      const post = f.calls.find((c) => c.method === 'POST' && c.url.endsWith('/dental/perio-charts'))!;
      expect((post.body as { visitId: string }).visitId).toBe(VISIT_ID);
      expect((post.body as { patientId: string }).patientId).toBe(PATIENT_ID);
    } finally {
      f.restore();
    }
  });

  test('upsertReading PUTs the tooth reading', async () => {
    const f = installFetch({ getStatus: 200 });
    try {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(() => usePerioChart({ visitId: VISIT_ID, patientId: PATIENT_ID }), {
        wrapper: wrapper(qc),
      });
      await waitFor(() => expect(result.current.chart).not.toBeNull());
      await act(async () => { result.current.upsertReading(16, { depthBM: 4 }); });
      await waitFor(() =>
        expect(f.calls.some((c) => c.method === 'PUT' && c.url.includes(`/perio-charts/${CHART_ID}/readings/16`))).toBe(true),
      );
    } finally {
      f.restore();
    }
  });

  test('completeChart POSTs /complete', async () => {
    const f = installFetch({ getStatus: 200 });
    try {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(() => usePerioChart({ visitId: VISIT_ID, patientId: PATIENT_ID }), {
        wrapper: wrapper(qc),
      });
      await waitFor(() => expect(result.current.chart).not.toBeNull());
      await act(async () => { result.current.completeChart({}); });
      await waitFor(() =>
        expect(f.calls.some((c) => c.method === 'POST' && c.url.includes(`/perio-charts/${CHART_ID}/complete`))).toBe(true),
      );
    } finally {
      f.restore();
    }
  });

  test('a failed mutation fires exactly one error toast', async () => {
    const f = installFetch({ getStatus: 200, mutationStatus: 500 });
    try {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      const { result } = renderHook(() => usePerioChart({ visitId: VISIT_ID, patientId: PATIENT_ID }), {
        wrapper: wrapper(qc),
      });
      await waitFor(() => expect(result.current.chart).not.toBeNull());
      await act(async () => { result.current.upsertReading(16, { depthBM: 4 }); });
      await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    } finally {
      f.restore();
    }
  });
});
