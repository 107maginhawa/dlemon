/**
 * usePatientReport — unit tests
 *
 * Tests the patient report hook that fetches patients and computes
 * stats: total active, archived, new registrations in a date range.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import {
  computePatientStats,
  type PatientReportRow,
} from './use-patient-report';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

// ---------------------------------------------------------------------------
// Pure logic tests
// ---------------------------------------------------------------------------

const samplePatients: PatientReportRow[] = [
  { id: 'p1', displayName: 'Alice A', status: 'active', createdAt: '2026-01-02T10:00:00Z' },
  { id: 'p2', displayName: 'Bob B', status: 'active', createdAt: '2026-01-05T10:00:00Z' },
  { id: 'p3', displayName: 'Carol C', status: 'archived', createdAt: '2025-06-01T10:00:00Z' },
  { id: 'p4', displayName: 'Dave D', status: 'active', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'p5', displayName: 'Eve E', status: 'archived', createdAt: '2025-03-01T10:00:00Z' },
];

describe('computePatientStats', () => {
  test('counts active patients', () => {
    const stats = computePatientStats(samplePatients, '', '');
    expect(stats.totalActive).toBe(3);
  });

  test('counts archived patients', () => {
    const stats = computePatientStats(samplePatients, '', '');
    expect(stats.totalArchived).toBe(2);
  });

  test('counts new registrations within date range', () => {
    const stats = computePatientStats(samplePatients, '2026-01-01', '2026-01-10');
    expect(stats.newRegistrations).toBe(2); // Alice + Bob
  });

  test('counts all as new when no date range', () => {
    const stats = computePatientStats(samplePatients, '', '');
    expect(stats.newRegistrations).toBe(samplePatients.length);
  });

  test('returns zeros for empty patient list', () => {
    const stats = computePatientStats([], '', '');
    expect(stats.totalActive).toBe(0);
    expect(stats.totalArchived).toBe(0);
    expect(stats.newRegistrations).toBe(0);
  });

  test('total equals active + archived', () => {
    const stats = computePatientStats(samplePatients, '', '');
    expect(stats.totalActive + stats.totalArchived).toBe(samplePatients.length);
  });
});

// ---------------------------------------------------------------------------
// Hook integration tests
// ---------------------------------------------------------------------------

describe('usePatientReport hook', () => {
  test('starts in loading state', async () => {
    const { usePatientReport } = await import('./use-patient-report');
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(
      () => usePatientReport({}),
      { wrapper: makeWrapper(qc) },
    );
    expect(result.current.isLoading).toBe(true);
  });

  test('returns stats after fetch', async () => {
    const { usePatientReport } = await import('./use-patient-report');

    // SDK transformer expects { data: [...] } shape (listDentalPatientsResponseTransformer)
    const apiResponse = {
      data: [
        { id: 'p1', displayName: 'Alice', status: 'active', createdAt: '2026-01-02T10:00:00Z', needsFollowUp: false, hasActivePaymentPlan: false, updatedAt: '2026-01-02T10:00:00Z' },
        { id: 'p2', displayName: 'Bob', status: 'archived', createdAt: '2025-06-01T10:00:00Z', needsFollowUp: false, hasActivePaymentPlan: false, updatedAt: '2025-06-01T10:00:00Z' },
      ],
      total: 2,
      limit: 100,
      offset: 0,
    };

    global.fetch = mock(() => jsonResponse(apiResponse));

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatientReport({}),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.stats.totalActive).toBe(1);
    expect(result.current.stats.totalArchived).toBe(1);
  });
});
