/**
 * Insurance-claim CREATE hooks — unit tests (roadmap Phase 1b, sub-slice A).
 *
 * Pins the two pieces the create-claim form needs:
 *  - usePatientInsuranceProfiles(patientId) → GET /dental/patients/:id/insurance-profiles
 *  - useClaimMutations().create → POST /dental/billing/claims (lines derive from invoice)
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { usePatientInsuranceProfiles, useClaimMutations } from './use-insurance-claims';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

describe('usePatientInsuranceProfiles', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('fetches the patient insurance-profiles endpoint', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse([
        { id: 'ip1', patientId: 'p1', insurerName: 'Maxicare', policyNumber: 'MX-100', payerType: 'hmo', active: true },
      ]);
    });

    const qc = freshClient();
    const { result } = renderHook(() => usePatientInsuranceProfiles('p1'), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('/dental/patients/p1/insurance-profiles');
    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0]!.insurerName).toBe('Maxicare');
  });

  test('is disabled when patientId is empty', async () => {
    const fetchSpy = mock(() => jsonResponse([]));
    global.fetch = fetchSpy;
    const qc = freshClient();
    renderHook(() => usePatientInsuranceProfiles(null), { wrapper: makeWrapper(qc) });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('useClaimMutations().create', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('POSTs a new claim anchored to patient + insurance profile + invoice', async () => {
    let capturedUrl = '';
    let capturedBody: unknown = null;
    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      const raw = req instanceof Request ? await req.text() : (init?.body as string);
      capturedBody = raw ? JSON.parse(raw) : null;
      return jsonResponse({ id: 'claim-1', claimNumber: 'CLM-001', status: 'draft', lines: [] }, 201);
    });

    const qc = freshClient();
    const { result } = renderHook(() => useClaimMutations({ branchId: 'br-1' }), { wrapper: makeWrapper(qc) });

    const created = await result.current.create({
      patientId: 'p1',
      insuranceProfileId: 'ip1',
      invoiceId: 'inv-1',
    });

    expect(capturedUrl).toContain('/dental/billing/claims');
    expect(capturedBody).toMatchObject({ patientId: 'p1', insuranceProfileId: 'ip1', invoiceId: 'inv-1' });
    expect((created as { claimNumber: string }).claimNumber).toBe('CLM-001');
  });
});
