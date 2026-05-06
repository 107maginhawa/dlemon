/**
 * usePatientProfile — unit tests (PROF-01)
 *
 * Tests the pure transform (toPatientProfile) and the query hook.
 * Network fetch is mocked via global.fetch override.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { toPatientProfile, usePatientProfile, type RawPatientDetail } from './use-patient-profile';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// ─── toPatientProfile (pure transform) ────────────────────────────────────

describe('toPatientProfile', () => {
  test('builds displayName from person firstName + lastName', () => {
    const raw: RawPatientDetail = {
      id: 'p1',
      person: { firstName: 'Maria', lastName: 'Santos', dateOfBirth: '1990-03-15' },
      displayName: null,
      visitCount: 8,
      lastVisit: '2026-03-01T08:00:00Z',
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    const profile = toPatientProfile(raw);
    expect(profile.displayName).toBe('Maria Santos');
    expect(profile.firstName).toBe('Maria');
    expect(profile.lastName).toBe('Santos');
  });

  test('prefers displayName from API over constructed name', () => {
    const raw: RawPatientDetail = {
      id: 'p2',
      person: { firstName: 'Jose', lastName: 'Rizal', dateOfBirth: null },
      displayName: 'Dr. Jose P. Rizal',
      visitCount: 0,
      lastVisit: null,
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    const profile = toPatientProfile(raw);
    expect(profile.displayName).toBe('Dr. Jose P. Rizal');
  });

  test('computes age from dateOfBirth', () => {
    const raw: RawPatientDetail = {
      id: 'p3',
      person: { firstName: 'Ana', lastName: 'Reyes', dateOfBirth: '1984-01-01' },
      displayName: null,
      visitCount: 3,
      lastVisit: null,
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    const profile = toPatientProfile(raw);
    expect(profile.age).toBeGreaterThan(0);
    expect(profile.dateOfBirth).toBe('1984-01-01');
  });

  test('exposes phone and email from person', () => {
    const raw: RawPatientDetail = {
      id: 'p4',
      person: {
        firstName: 'Juan',
        lastName: 'Cruz',
        dateOfBirth: null,
        phone: '+63 917 555 1234',
        email: 'juan@email.com',
      },
      displayName: null,
      visitCount: 1,
      lastVisit: null,
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    const profile = toPatientProfile(raw);
    expect(profile.phone).toBe('+63 917 555 1234');
    expect(profile.email).toBe('juan@email.com');
  });

  test('returns null phone/email when person has none', () => {
    const raw: RawPatientDetail = {
      id: 'p5',
      person: { firstName: 'Lito', lastName: 'Bautista', dateOfBirth: null },
      displayName: null,
      visitCount: 0,
      lastVisit: null,
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    const profile = toPatientProfile(raw);
    expect(profile.phone).toBeNull();
    expect(profile.email).toBeNull();
  });

  test('hasBalance true when hasActivePaymentPlan is true', () => {
    const raw: RawPatientDetail = {
      id: 'p6',
      person: null,
      displayName: 'Test Patient',
      visitCount: 0,
      lastVisit: null,
      hasBalance: false,
      hasActivePaymentPlan: true,
    };
    const profile = toPatientProfile(raw);
    expect(profile.hasBalance).toBe(true);
  });

  test('parses lastVisit to Date', () => {
    const raw: RawPatientDetail = {
      id: 'p7',
      person: null,
      displayName: 'Visit Patient',
      visitCount: 5,
      lastVisit: '2026-01-15T10:30:00Z',
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    const profile = toPatientProfile(raw);
    expect(profile.lastVisit).toBeInstanceOf(Date);
    expect(profile.visitCount).toBe(5);
  });
});

// ─── usePatientProfile hook ────────────────────────────────────────────────

describe('usePatientProfile', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('fetches GET /dental/patients/:patientId', async () => {
    let capturedUrl = '';
    const mockDetail: RawPatientDetail = {
      id: 'p1',
      person: { firstName: 'Rosa', lastName: 'Dela Cruz', dateOfBirth: '1985-06-20' },
      displayName: null,
      visitCount: 5,
      lastVisit: '2025-04-01T08:00:00Z',
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    global.fetch = mock((url: string | URL | Request) => {
      capturedUrl = url.toString();
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDetail) } as Response);
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatientProfile({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('/dental/patients/p1');
    expect(result.current.data?.displayName).toBe('Rosa Dela Cruz');
  });

  test('returns null data and error on fetch failure', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 404 } as Response),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatientProfile({ patientId: 'missing' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
  });
});
