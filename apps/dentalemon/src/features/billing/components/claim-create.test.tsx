/**
 * ClaimCreate — create-claim form (roadmap Phase 1b sub-slice A).
 *
 * The worklist must be able to ORIGINATE a claim: pick patient → their insurance
 * profile → an anchor invoice → file. Lines derive from the invoice server-side.
 * These tests pin the gating (all three required) and the POST body.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { ClaimCreate, canFileClaim } from './claim-create';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

describe('canFileClaim', () => {
  test('requires patient + insurance profile + invoice', () => {
    expect(canFileClaim({ patientId: '', insuranceProfileId: '', invoiceId: '' })).toBe(false);
    expect(canFileClaim({ patientId: 'p1', insuranceProfileId: '', invoiceId: '' })).toBe(false);
    expect(canFileClaim({ patientId: 'p1', insuranceProfileId: 'ip1', invoiceId: '' })).toBe(false);
    expect(canFileClaim({ patientId: 'p1', insuranceProfileId: 'ip1', invoiceId: 'inv-1' })).toBe(true);
  });
});

function routeFetch(captured: { url?: string; body?: unknown }) {
  return mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = req instanceof Request ? req.method : (init?.method ?? 'GET');

    if (method === 'POST' && url.includes('/dental/billing/claims')) {
      captured.url = url;
      const raw = req instanceof Request ? await req.text() : (init?.body as string);
      captured.body = raw ? JSON.parse(raw) : null;
      return jsonResponse({ id: 'claim-1', claimNumber: 'CLM-001', status: 'draft', lines: [] }, 201);
    }
    // Order matters: insurance-profiles URL also contains '/dental/patients/'.
    if (url.includes('/insurance-profiles')) {
      return jsonResponse([
        { id: 'ip1', patientId: 'p1', insurerName: 'Maxicare', policyNumber: 'MX-100', payerType: 'hmo', active: true },
      ]);
    }
    if (url.includes('/dental/billing/invoices')) {
      return jsonResponse({
        data: [
          { id: 'inv-1', invoiceNumber: 'INV-001', patientId: 'p1', totalCents: 350000, paidCents: 0, balanceCents: 350000, status: 'issued', createdAt: '2026-05-01T00:00:00Z' },
        ],
        pagination: { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1 },
      });
    }
    if (url.includes('/dental/patients')) {
      return jsonResponse({
        data: [
          { id: 'p1', person: { firstName: 'Rosa', lastName: 'Dela Cruz', dateOfBirth: null }, displayName: 'Rosa Dela Cruz', visitCount: 2, lastVisit: null, needsFollowUp: false, hasBalance: true, hasActivePaymentPlan: false, status: 'active' },
        ],
      });
    }
    return jsonResponse({});
  });
}

describe('ClaimCreate', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('patient → insurance profile → invoice → file claim POSTs the anchored claim', async () => {
    const captured: { url?: string; body?: unknown } = {};
    global.fetch = routeFetch(captured);
    let created = false;

    const qc = freshClient();
    render(
      <ClaimCreate branchId="br-1" open onClose={() => {}} onCreated={() => { created = true; }} />,
      { wrapper: makeWrapper(qc) },
    );

    // Search and select the patient.
    fireEvent.change(screen.getByTestId('claim-patient-search'), { target: { value: 'Rosa' } });
    const patientOpt = await screen.findByTestId('claim-patient-opt-p1');
    fireEvent.click(patientOpt);

    // Pick the insurance profile + anchor invoice.
    fireEvent.click(await screen.findByTestId('claim-profile-opt-ip1'));
    fireEvent.click(await screen.findByTestId('claim-invoice-opt-inv-1'));

    const fileBtn = screen.getByTestId('file-claim-btn');
    expect((fileBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(fileBtn);

    await waitFor(() => expect(created).toBe(true));
    expect(captured.url).toContain('/dental/billing/claims');
    expect(captured.body).toMatchObject({ patientId: 'p1', insuranceProfileId: 'ip1', invoiceId: 'inv-1' });
  });

  test('file button is disabled until all three selections are made', async () => {
    global.fetch = routeFetch({});
    const qc = freshClient();
    render(<ClaimCreate branchId="br-1" open onClose={() => {}} onCreated={() => {}} />, { wrapper: makeWrapper(qc) });

    expect((screen.getByTestId('file-claim-btn') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId('claim-patient-search'), { target: { value: 'Rosa' } });
    fireEvent.click(await screen.findByTestId('claim-patient-opt-p1'));
    fireEvent.click(await screen.findByTestId('claim-profile-opt-ip1'));
    // invoice not yet chosen → still disabled
    expect((screen.getByTestId('file-claim-btn') as HTMLButtonElement).disabled).toBe(true);
  });
});
