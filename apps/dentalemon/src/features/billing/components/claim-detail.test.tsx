/**
 * ClaimDetail — claim detail + line breakdown (roadmap Phase 1b sub-slice B).
 *
 * Opening a claim shows its per-procedure lines (getInsuranceClaim →
 * InsuranceClaimWithLines) and the billed/payer-paid/outstanding rollup.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { ClaimDetail } from './claim-detail';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

const CLAIM = {
  id: 'claim-1',
  claimNumber: 'CLM-2026-001',
  patientId: 'p1',
  insuranceProfileId: 'ip1',
  branchId: 'br1',
  status: 'submitted',
  billedAmountCents: 8000,
  paidByPayerCents: 5000,
  disallowedCents: 0,
  patientPortionCents: 3000,
  lines: [
    { id: 'l1', claimId: 'claim-1', cdtCode: 'D1110', description: 'Prophylaxis', billedAmountCents: 5000, approvedAmountCents: 5000, paidAmountCents: 5000, status: 'covered' },
    { id: 'l2', claimId: 'claim-1', cdtCode: 'D0220', description: 'Periapical X-ray', billedAmountCents: 3000, approvedAmountCents: 0, paidAmountCents: 0, status: 'disallowed' },
  ],
};

describe('ClaimDetail', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('renders the claim header + each line with amounts', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse(CLAIM);
    });

    const qc = freshClient();
    render(<ClaimDetail claimId="claim-1" open onClose={() => {}} />, { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(screen.getByText('CLM-2026-001')).toBeDefined());
    expect(capturedUrl).toContain('/dental/billing/claims/claim-1');

    // Both lines render with their CDT codes + descriptions.
    expect(screen.getByText('D1110')).toBeDefined();
    expect(screen.getByText('Prophylaxis')).toBeDefined();
    expect(screen.getByText('D0220')).toBeDefined();
    expect(screen.getByText('Periapical X-ray')).toBeDefined();

    // The billed rollup (₱80.00 = 8000¢) is shown.
    const detail = screen.getByTestId('claim-detail');
    expect(detail.textContent).toContain('₱80.00');
  });

  test('renders nothing when closed', () => {
    global.fetch = mock(() => jsonResponse(CLAIM));
    const qc = freshClient();
    render(<ClaimDetail claimId="claim-1" open={false} onClose={() => {}} />, { wrapper: makeWrapper(qc) });
    expect(screen.queryByTestId('claim-detail')).toBeNull();
  });
});
