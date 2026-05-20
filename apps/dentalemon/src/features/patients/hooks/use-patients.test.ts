/**
 * usePatients — unit tests
 *
 * Tests the pure mapping logic (toPatientCard) and the query key shape.
 * Network fetch is mocked via global.fetch override.
 *
 * We test the transform logic in isolation first (fast, no React),
 * then test the hook itself with a QueryClient wrapper.
 */
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { toPatientCard, usePatients, type RawPatient } from './use-patients';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

/** API list response shape for patients — matches actual paginated API: { data: [...], pagination: {...} } */
function patientListResponse(patients: RawPatient[]) {
  return { data: patients, pagination: { offset: 0, limit: 50, count: patients.length, totalCount: patients.length, totalPages: 1 } };
}

// ─── toPatientCard (pure transform) ────────────────────────────────────────

describe('toPatientCard', () => {
  test('builds displayName from person firstName + lastName', () => {
    const raw: RawPatient = {
      id: '1',
      person: { firstName: 'Maria', lastName: 'Santos', dateOfBirth: null },
      displayName: null,
      visitCount: 3,
      lastVisit: null,
      needsFollowUp: false,
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    const card = toPatientCard(raw);
    expect(card.displayName).toBe('Maria Santos');
  });

  test('falls back to raw displayName when person names are empty', () => {
    const raw: RawPatient = {
      id: '2',
      person: { firstName: '', lastName: '', dateOfBirth: null },
      displayName: 'Quick Patient',
      visitCount: 0,
      lastVisit: null,
      needsFollowUp: false,
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    expect(toPatientCard(raw).displayName).toBe('Quick Patient');
  });

  test('falls back to "Unknown Patient" when no name at all', () => {
    const raw: RawPatient = {
      id: '3',
      person: null,
      displayName: null,
      visitCount: 0,
      lastVisit: null,
      needsFollowUp: false,
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    expect(toPatientCard(raw).displayName).toBe('Unknown Patient');
  });

  test('calculates age from dateOfBirth', () => {
    const raw: RawPatient = {
      id: '4',
      person: { firstName: 'Ana', lastName: 'Cruz', dateOfBirth: '1990-01-01' },
      displayName: null,
      visitCount: 1,
      lastVisit: null,
      needsFollowUp: false,
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    const card = toPatientCard(raw);
    const expectedAge = new Date().getFullYear() - 1990;
    // age is either expectedAge or expectedAge-1 depending on birthday this year
    expect(card.age).toBeGreaterThanOrEqual(expectedAge - 1);
    expect(card.age).toBeLessThanOrEqual(expectedAge);
  });

  test('hasBalance is true when hasBalance flag is set', () => {
    const raw: RawPatient = {
      id: '5',
      person: null,
      displayName: 'Test',
      visitCount: 0,
      lastVisit: null,
      needsFollowUp: false,
      hasBalance: true,
      hasActivePaymentPlan: false,
    };
    expect(toPatientCard(raw).hasBalance).toBe(true);
  });

  test('hasBalance is true when hasActivePaymentPlan is set', () => {
    const raw: RawPatient = {
      id: '6',
      person: null,
      displayName: 'Test',
      visitCount: 0,
      lastVisit: null,
      needsFollowUp: false,
      hasBalance: false,
      hasActivePaymentPlan: true,
    };
    expect(toPatientCard(raw).hasBalance).toBe(true);
  });

  test('converts lastVisit string to Date', () => {
    const raw: RawPatient = {
      id: '7',
      person: null,
      displayName: 'Test',
      visitCount: 1,
      lastVisit: '2025-03-15T10:00:00Z',
      needsFollowUp: false,
      hasBalance: false,
      hasActivePaymentPlan: false,
    };
    const card = toPatientCard(raw);
    expect(card.lastVisit).toBeInstanceOf(Date);
  });
});

// ─── usePatients hook ───────────────────────────────────────────────────────

describe('usePatients', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Restore fresh fetch mock before each test
  });

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('returns patients on successful fetch', async () => {
    const mockPatients: RawPatient[] = [
      {
        id: 'p1',
        person: { firstName: 'Rosa', lastName: 'Dela Cruz', dateOfBirth: '1985-06-20' },
        displayName: null,
        visitCount: 5,
        lastVisit: '2025-04-01T08:00:00Z',
        needsFollowUp: true,
        hasBalance: false,
        hasActivePaymentPlan: false,
      },
    ];

    global.fetch = mock(() => jsonResponse(patientListResponse(mockPatients)));

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatients({ branchId: 'branch-1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.patients).toHaveLength(1);
    expect(result.current.patients[0]!.displayName).toBe('Rosa Dela Cruz');
    expect(result.current.patients[0]!.needsFollowUp).toBe(true);
    expect(result.current.error).toBeNull();
  });

  test('returns empty list when no patients', async () => {
    global.fetch = mock(() => jsonResponse(patientListResponse([])));

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatients({}),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.patients).toHaveLength(0);
  });

  test('includes branchId and searchQuery in fetch URL', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse(patientListResponse([]));
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatients({ branchId: 'br-99', searchQuery: 'rosa' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('branchId=br-99');
    expect(capturedUrl).toContain('q=rosa');
  });

  test('includes status=active filter when specified', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse(patientListResponse([]));
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatients({ status: 'active' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('status=active');
  });

  test('includes needsFollowUp=true filter when specified', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse(patientListResponse([]));
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatients({ needsFollowUp: true }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('needsFollowUp=true');
  });

  test('returns empty array and error on fetch failure', async () => {
    global.fetch = mock(() =>
      jsonResponse({ message: 'Internal Server Error' }, 500),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => usePatients({}),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.patients).toHaveLength(0);
    expect(result.current.error).not.toBeNull();
  });
});
