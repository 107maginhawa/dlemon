/**
 * useVisits — unit tests
 *
 * Tests the hook that loads a patient's visit list.
 * Replaces the broken use-visit.ts (which always returned null).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useVisits } from './use-visits';

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

const mockVisits = [
  { id: 'v1', patientId: 'p1', status: 'active', chiefComplaint: 'Toothache', createdAt: '2026-05-01T08:00:00Z' },
  { id: 'v2', patientId: 'p1', status: 'completed', chiefComplaint: 'Cleaning', createdAt: '2026-03-10T09:00:00Z' },
];

describe('useVisits', () => {
  test('returns visits array on successful fetch', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ items: mockVisits }) } as Response),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.visits).toHaveLength(2);
    expect(result.current.visits[0]!.id).toBe('v1');
    expect(result.current.visits[0]!.status).toBe('active');
  });

  test('includes patientId in fetch URL', async () => {
    let capturedUrl = '';
    global.fetch = mock((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) } as Response);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('patientId=p1');
  });

  test('activeVisit is the visit with status=active', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ items: mockVisits }) } as Response),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeVisit?.id).toBe('v1');
  });

  test('activeVisit is null when no active visit exists', async () => {
    const completedVisits = [
      { id: 'v2', patientId: 'p1', status: 'completed', chiefComplaint: 'Cleaning', createdAt: '2026-03-10T09:00:00Z' },
    ];
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ items: completedVisits }) } as Response),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeVisit).toBeNull();
  });

  test('returns empty array and error on fetch failure', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useVisits({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.visits).toHaveLength(0);
    expect(result.current.error).not.toBeNull();
  });
});
