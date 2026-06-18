/**
 * usePatientBalance — unit tests (PROF-03 / roadmap slice 1.6)
 *
 * The patient profile must show the AUTHORITATIVE outstanding balance from
 * GET /dental/billing/patients/:patientId/balance — not a client-side sum of a
 * possibly-paginated invoice list. These tests pin the endpoint + the field read.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { usePatientBalance } from './use-patient-balance';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

describe('usePatientBalance', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('fetches the authoritative balance endpoint for the patient', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({
        patientId: 'p1',
        totalBilledCents: 10000,
        totalPaidCents: 0,
        outstandingBalanceCents: 10000,
        overdueAmountCents: 2000,
        invoiceCount: 3,
        overdueInvoiceCount: 1,
        activePaymentPlanCount: 0,
      });
    });

    const qc = freshClient();
    const { result } = renderHook(() => usePatientBalance({ patientId: 'p1' }), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('/dental/billing/patients/p1/balance');
  });

  test('returns the server-computed outstanding balance (not a client sum)', async () => {
    global.fetch = mock(() =>
      jsonResponse({
        patientId: 'p1',
        totalBilledCents: 350000,
        totalPaidCents: 340000,
        outstandingBalanceCents: 10000,
        overdueAmountCents: 2000,
        invoiceCount: 4,
        overdueInvoiceCount: 1,
        activePaymentPlanCount: 1,
      }),
    );

    const qc = freshClient();
    const { result } = renderHook(() => usePatientBalance({ patientId: 'p1' }), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.balance?.outstandingBalanceCents).toBe(10000);
    expect(result.current.balance?.overdueAmountCents).toBe(2000);
    expect(result.current.balance?.activePaymentPlanCount).toBe(1);
  });

  test('is disabled (no fetch) when patientId is empty', async () => {
    const fetchSpy = mock(() => jsonResponse({}));
    global.fetch = fetchSpy;

    const qc = freshClient();
    renderHook(() => usePatientBalance({ patientId: '' }), {
      wrapper: makeWrapper(qc),
    });

    // give react-query a tick; disabled query must never hit the network
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('surfaces error on fetch failure', async () => {
    global.fetch = mock(() => jsonResponse({}, 500));

    const qc = freshClient();
    const { result } = renderHook(() => usePatientBalance({ patientId: 'p1' }), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.balance).toBeNull();
  });
});
