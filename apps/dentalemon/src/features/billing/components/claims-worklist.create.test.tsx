/**
 * ClaimsWorklist — "New claim" affordance (Phase 1b sub-slice A wiring).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ClaimsWorklist } from './claims-worklist';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

describe('ClaimsWorklist New claim affordance', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  function emptyFetch() {
    return mock((req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : String(req);
      if (url.includes('/claims')) return jsonResponse({ items: [], total: 0 });
      return jsonResponse({ payers: [], summary: { totalOutstandingCents: 0, payerCount: 0 } });
    });
  }

  test('writer sees a New claim button that opens the create form', async () => {
    global.fetch = emptyFetch();
    const qc = freshClient();
    render(<ClaimsWorklist branchId="br-1" canWrite />, { wrapper: makeWrapper(qc) });

    const btn = screen.getByTestId('new-claim-btn');
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(screen.getByTestId('claim-create')).toBeDefined();
  });

  test('non-writer does not see the New claim button', () => {
    global.fetch = emptyFetch();
    const qc = freshClient();
    render(<ClaimsWorklist branchId="br-1" canWrite={false} />, { wrapper: makeWrapper(qc) });
    expect(screen.queryByTestId('new-claim-btn')).toBeNull();
  });

  test('clicking a claim number opens its detail with lines (slice 1b.B)', async () => {
    global.fetch = mock((req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : String(req);
      // AR-aging lives at /dental/billing/claims/aging — match it before /claims.
      if (url.includes('/aging')) {
        return jsonResponse({ payers: [], summary: { totalOutstandingCents: 0, payerCount: 0 } });
      }
      if (url.includes('/claims/claim-1')) {
        return jsonResponse({
          id: 'claim-1', claimNumber: 'CLM-9', patientId: 'p1', insuranceProfileId: 'ip1', branchId: 'br-1',
          status: 'draft', billedAmountCents: 5000, paidByPayerCents: 0, disallowedCents: 0, patientPortionCents: 5000,
          lines: [{ id: 'l1', claimId: 'claim-1', cdtCode: 'D1110', description: 'Prophylaxis', billedAmountCents: 5000, approvedAmountCents: 0, paidAmountCents: 0, status: 'pending' }],
        });
      }
      if (url.includes('/claims')) {
        return jsonResponse({ items: [{ id: 'claim-1', claimNumber: 'CLM-9', status: 'draft', billedAmountCents: 5000, paidByPayerCents: 0, disallowedCents: 0 }], total: 1 });
      }
      return jsonResponse({ payers: [], summary: { totalOutstandingCents: 0, payerCount: 0 } });
    });

    const qc = freshClient();
    render(<ClaimsWorklist branchId="br-1" canWrite />, { wrapper: makeWrapper(qc) });

    fireEvent.click(await screen.findByTestId('claim-open-claim-1'));
    await waitFor(() => expect(screen.getByTestId('claim-detail')).toBeDefined());
    expect(await screen.findByText('D1110')).toBeDefined();
  });
});
