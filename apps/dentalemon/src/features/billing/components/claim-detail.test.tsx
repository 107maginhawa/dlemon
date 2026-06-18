/**
 * ClaimDetail — claim detail + line breakdown (roadmap Phase 1b sub-slice B).
 *
 * Opening a claim shows its per-procedure lines (getInsuranceClaim →
 * InsuranceClaimWithLines) and the billed/payer-paid/outstanding rollup.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
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

// ── Line editor (roadmap Phase 1b · sub-slice C) ────────────────────────────
const DRAFT_CLAIM = { ...CLAIM, status: 'draft' };

/** Route GET → claim, capture POST/PATCH writes. */
function routerFetch(claim: unknown, sink: { url: string; method: string; body: unknown }) {
  return mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
    if (method === 'GET') return jsonResponse(claim);
    const raw = req instanceof Request ? await req.text() : (init?.body as string);
    sink.url = url;
    sink.method = method;
    sink.body = raw ? JSON.parse(raw) : null;
    return jsonResponse({ id: 'lnew', claimId: 'claim-1', cdtCode: 'D0220', description: 'PA X-ray', billedAmountCents: 3000, paidAmountCents: 0, status: 'pending' }, 201);
  });
}

describe('ClaimDetail line editor', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('add-line form POSTs a new line for an editable (draft) claim', async () => {
    const sink = { url: '', method: '', body: null as unknown };
    global.fetch = routerFetch(DRAFT_CLAIM, sink);
    const qc = freshClient();
    render(<ClaimDetail claimId="claim-1" open canWrite branchId="br1" onClose={() => {}} />, { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(screen.getByTestId('add-line-cdt')).toBeDefined());
    fireEvent.change(screen.getByTestId('add-line-cdt'), { target: { value: 'D0220' } });
    fireEvent.change(screen.getByTestId('add-line-description'), { target: { value: 'PA X-ray' } });
    fireEvent.change(screen.getByTestId('add-line-billed'), { target: { value: '30.00' } });
    fireEvent.click(screen.getByTestId('add-line-submit'));

    await waitFor(() => expect(sink.method).toBe('POST'));
    expect(sink.url).toContain('/dental/billing/claims/claim-1/lines');
    expect(sink.body).toMatchObject({ cdtCode: 'D0220', description: 'PA X-ray', billedAmountCents: 3000 });
  });

  test('no editor affordances for a non-editable (submitted) claim', async () => {
    global.fetch = mock(() => jsonResponse(CLAIM)); // status: submitted
    const qc = freshClient();
    render(<ClaimDetail claimId="claim-1" open canWrite branchId="br1" onClose={() => {}} />, { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(screen.getByText('CLM-2026-001')).toBeDefined());
    expect(screen.queryByTestId('add-line-cdt')).toBeNull();
    expect(screen.queryByTestId('edit-line-l1')).toBeNull();
  });

  test('no editor affordances when canWrite is false', async () => {
    global.fetch = mock(() => jsonResponse(DRAFT_CLAIM));
    const qc = freshClient();
    render(<ClaimDetail claimId="claim-1" open branchId="br1" onClose={() => {}} />, { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(screen.getByText('CLM-2026-001')).toBeDefined());
    expect(screen.queryByTestId('add-line-cdt')).toBeNull();
    expect(screen.queryByTestId('edit-line-l1')).toBeNull();
  });

  test('editing a line PATCHes its billed amount', async () => {
    const sink = { url: '', method: '', body: null as unknown };
    global.fetch = routerFetch(DRAFT_CLAIM, sink);
    const qc = freshClient();
    render(<ClaimDetail claimId="claim-1" open canWrite branchId="br1" onClose={() => {}} />, { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(screen.getByTestId('edit-line-l1')).toBeDefined());
    fireEvent.click(screen.getByTestId('edit-line-l1'));
    fireEvent.change(screen.getByTestId('edit-line-billed-l1'), { target: { value: '45.00' } });
    fireEvent.click(screen.getByTestId('save-line-l1'));

    await waitFor(() => expect(sink.method).toBe('PATCH'));
    expect(sink.url).toContain('/dental/billing/claims/claim-1/lines/l1');
    expect(sink.body).toMatchObject({ billedAmountCents: 4500 });
  });
});
