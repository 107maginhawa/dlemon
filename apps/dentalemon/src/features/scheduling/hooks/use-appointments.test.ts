/**
 * useAppointments — unit tests
 *
 * TanStack Query hook that loads appointments by date (day view)
 * or week start (week view). Replaces the inline fetch in calendar.tsx.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAppointments } from './use-appointments';

afterEach(cleanup);

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const mockAppointments = [
  { id: 'a1', patientId: 'p1', patientName: 'Maria Santos', scheduledAt: '2026-05-04T09:00:00Z', status: 'scheduled', durationMinutes: 30 },
  { id: 'a2', patientId: 'p2', patientName: 'Ramon Cruz', scheduledAt: '2026-05-04T10:00:00Z', status: 'completed', durationMinutes: 45 },
];

describe('useAppointments', () => {
  test('starts in loading state', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isLoading).toBe(true);
  });

  test('returns appointments array on success (wrapped response)', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ appointments: mockAppointments }) } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.appointments).toHaveLength(2);
    expect(result.current.appointments[0]?.id).toBe('a1');
  });

  test('returns appointments array on success (bare array response)', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockAppointments) } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.appointments).toHaveLength(2);
  });

  test('returns empty array when response has no appointments', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ appointments: [] }) } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.appointments).toHaveLength(0);
  });

  test('uses date query param for day view', async () => {
    let capturedUrl = '';
    global.fetch = mock((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    });
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('date=2026-05-04');
    expect(capturedUrl).not.toContain('weekStart');
  });

  test('uses weekStart query param for week view', async () => {
    let capturedUrl = '';
    global.fetch = mock((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    });
    const qc = freshClient();
    // 2026-05-04 is a Monday
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'week' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('weekStart=');
    expect(capturedUrl).not.toContain('date=');
  });

  test('sets error when fetch fails', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  test('refetch function is defined', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(
      () => useAppointments({ date: '2026-05-04', view: 'day' }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });
});
