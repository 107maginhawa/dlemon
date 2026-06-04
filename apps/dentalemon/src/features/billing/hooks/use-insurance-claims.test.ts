/**
 * useInsuranceClaims / usePayerArAging — contract regression (QA_ESCAPES §6 roll-out).
 *
 * These hooks previously `as unknown as`-cast the SDK response, disabling
 * type-checking at the FE↔BE boundary. They now consume the generated SDK
 * InsuranceClaimList / PayerArAgingResponse and narrow off the ErrorResponse
 * union arm. CRITICAL contract these tests lock: listInsuranceClaims and
 * getPayerArAging have NO SDK response transformer (transformers.gen.ts), so the
 * timestamps the SDK over-types as Date arrive as ISO STRINGS at runtime — the
 * hook normalizes them so consumers can format them as strings.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useInsuranceClaims, usePayerArAging } from './use-insurance-claims';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const BRANCH = 'e17678dd-bb19-4c4a-9b72-ad4cd8e7d37c';

// Mirrors the listInsuranceClaims success shape: { items: InsuranceClaim[]; total }.
// Timestamps are ISO strings (the wire/runtime reality, not Date).
const claimsResponse = {
  items: [
    {
      id: 'clm-1',
      patientId: 'pat-1',
      insuranceProfileId: 'ins-1',
      branchId: BRANCH,
      claimNumber: 'CLM-2026-0001',
      status: 'submitted',
      billedAmountCents: 500000,
      paidByPayerCents: 0,
      patientPortionCents: 0,
      submittedAt: '2026-06-01T08:00:00.000Z',
      createdAt: '2026-06-01T07:00:00.000Z',
      updatedAt: '2026-06-01T08:00:00.000Z',
    },
  ],
  total: 1,
};

const payerAging = {
  asOf: '2026-06-04T11:17:39.488Z',
  summary: {
    currentCents: 500000,
    days30Cents: 0,
    days60Cents: 0,
    days90PlusCents: 0,
    totalOutstandingCents: 500000,
    payerCount: 1,
    claimCount: 1,
  },
  payers: [
    {
      insuranceProfileId: 'ins-1',
      payerName: 'MediCard',
      currentCents: 500000,
      days30Cents: 0,
      days60Cents: 0,
      days90PlusCents: 0,
      totalOutstandingCents: 500000,
      claimCount: 1,
      oldestClaimDays: 3,
    },
  ],
};

describe('useInsuranceClaims — real API shape (contract regression)', () => {
  test('does not fetch without a branchId', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(() => useInsuranceClaims({ branchId: null }), { wrapper: makeWrapper(qc) });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.claims).toEqual([]);
  });

  test('surfaces claim rows + total and normalizes submittedAt to a string', async () => {
    global.fetch = mock(() => jsonResponse(claimsResponse));
    const qc = freshClient();
    const { result } = renderHook(() => useInsuranceClaims({ branchId: BRANCH }), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.total).toBe(1));
    const claim = result.current.claims[0]!;
    expect(claim.claimNumber).toBe('CLM-2026-0001');
    expect(claim.status).toBe('submitted');
    expect(claim.billedAmountCents).toBe(500000);
    // SDK over-types submittedAt as Date; the endpoint has no transformer, so the
    // hook must keep it a string (the worklist would misformat a Date).
    expect(typeof claim.submittedAt).toBe('string');
  });
});

describe('usePayerArAging — real API shape (contract regression)', () => {
  test('surfaces summary + payer rows and keeps asOf a string', async () => {
    global.fetch = mock(() => jsonResponse(payerAging));
    const qc = freshClient();
    const { result } = renderHook(() => usePayerArAging({ branchId: BRANCH }), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.aging).not.toBeNull());
    const a = result.current.aging!;
    expect(a.summary.totalOutstandingCents).toBe(500000);
    expect(a.summary.payerCount).toBe(1);
    expect(a.payers[0]!.payerName).toBe('MediCard');
    expect(typeof a.asOf).toBe('string');
  });
});
