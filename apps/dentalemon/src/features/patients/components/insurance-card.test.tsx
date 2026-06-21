/**
 * InsuranceCard — PP-2 (ISSUE-036) patient insurance profiles.
 *
 * Pins the create/edit gap closed: list rendering, the required-field validation,
 * and the POST body the backend expects. The claim payer-picker reads the SAME
 * query key, so a profile created here must round-trip into claims.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import {
  InsuranceCard,
  validateInsuranceProfileForm,
  buildInsuranceBody,
  emptyInsuranceForm,
} from './insurance-card';

// ─── Pure: validation ────────────────────────────────────────────────────────

describe('validateInsuranceProfileForm', () => {
  test('flags the three required identity fields when blank', () => {
    const errs = validateInsuranceProfileForm({ insurerName: '', policyNumber: ' ', subscriberName: '' });
    expect(errs).toContain('Insurer name is required');
    expect(errs).toContain('Policy number is required');
    expect(errs).toContain('Subscriber name is required');
  });

  test('passes when all three are present', () => {
    expect(validateInsuranceProfileForm({ insurerName: 'Maxicare', policyNumber: 'MX-1', subscriberName: 'Ana' })).toEqual([]);
  });
});

describe('buildInsuranceBody', () => {
  test('trims required fields and drops empty optionals to undefined', () => {
    const body = buildInsuranceBody({ ...emptyInsuranceForm(), insurerName: ' Maxicare ', policyNumber: ' MX-1 ', subscriberName: ' Ana ' });
    expect(body.insurerName).toBe('Maxicare');
    expect(body.policyNumber).toBe('MX-1');
    expect(body.subscriberName).toBe('Ana');
    expect(body.groupNumber).toBeUndefined();
    expect(body.subscriberDob).toBeUndefined();
    expect(body.notes).toBeUndefined();
    expect(body.payerType).toBe('hmo');
    expect(body.relationship).toBe('self');
  });

  test('keeps non-empty optionals', () => {
    const body = buildInsuranceBody({ ...emptyInsuranceForm(), insurerName: 'A', policyNumber: 'P', subscriberName: 'S', groupNumber: 'G1', payerType: 'philhealth' });
    expect(body.groupNumber).toBe('G1');
    expect(body.payerType).toBe('philhealth');
  });
});

// ─── DOM: card ───────────────────────────────────────────────────────────────

const PROFILE = {
  id: 'ip1', patientId: 'pt-1', insurerName: 'Maxicare', policyNumber: 'MX-100',
  payerType: 'hmo', relationship: 'self', subscriberName: 'Ana', groupNumber: null,
  subscriberDob: null, active: true, notes: null, version: 1,
  createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
};

describe('InsuranceCard', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; cleanup(); });

  function renderCard(fetchImpl: Parameters<typeof mock>[0]) {
    global.fetch = mock(fetchImpl);
    const qc = freshClientWithMutations();
    render(React.createElement(InsuranceCard, { patientId: 'pt-1' }), { wrapper: makeWrapper(qc) });
  }

  test('loading skeleton then empty state with no profiles', async () => {
    renderCard(() => jsonResponse([]));
    await waitFor(() => expect(screen.getByTestId('insurance-empty')).not.toBeNull());
    expect(screen.getByTestId('add-insurance-btn')).not.toBeNull();
  });

  test('renders a profile row', async () => {
    renderCard(() => jsonResponse([PROFILE]));
    await waitFor(() => expect(screen.getByTestId('insurance-row')).not.toBeNull());
    expect(screen.getByText('Maxicare')).not.toBeNull();
    expect(screen.getByTestId('edit-insurance-ip1')).not.toBeNull();
  });

  test('error state on non-2xx list', async () => {
    renderCard(() => Promise.resolve(new Response('boom', { status: 500 })));
    await waitFor(() => expect(screen.getByTestId('insurance-error')).not.toBeNull());
  });

  test('Add → empty save is blocked by validation', async () => {
    renderCard(() => jsonResponse([]));
    await waitFor(() => expect(screen.getByTestId('add-insurance-btn')).not.toBeNull());
    fireEvent.click(screen.getByTestId('add-insurance-btn'));
    await waitFor(() => expect(screen.getByTestId('insurance-form')).not.toBeNull());
    fireEvent.click(screen.getByTestId('save-insurance-btn'));
    await waitFor(() => expect(screen.getByTestId('insurance-form-error')).not.toBeNull());
    expect(screen.getByText('Insurer name is required')).not.toBeNull();
  });

  test('Add → fill → save POSTs the create body', async () => {
    const captured: { method?: string; url?: string; body?: Record<string, unknown> } = {};
    renderCard(async (req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      if (method === 'POST' && url.includes('/insurance-profiles')) {
        captured.method = method; captured.url = url;
        const raw = req instanceof Request ? await req.text() : (init?.body as string);
        captured.body = raw ? JSON.parse(raw) : undefined;
        return jsonResponse({ ...PROFILE, id: 'ip-new' }, 201);
      }
      return jsonResponse([]); // GET list
    });

    await waitFor(() => expect(screen.getByTestId('add-insurance-btn')).not.toBeNull());
    fireEvent.click(screen.getByTestId('add-insurance-btn'));
    await waitFor(() => expect(screen.getByTestId('insurance-form')).not.toBeNull());

    fireEvent.change(screen.getByTestId('ins-insurer'), { target: { value: 'Intellicare' } });
    fireEvent.change(screen.getByTestId('ins-policy'), { target: { value: 'IC-42' } });
    fireEvent.change(screen.getByTestId('ins-subscriber'), { target: { value: 'Juan Dela Cruz' } });
    fireEvent.change(screen.getByTestId('ins-payer'), { target: { value: 'philhealth' } });

    fireEvent.click(screen.getByTestId('save-insurance-btn'));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.method).toBe('POST');
    expect(captured.url).toContain('/dental/patients/pt-1/insurance-profiles');
    expect(captured.body).toMatchObject({
      insurerName: 'Intellicare',
      policyNumber: 'IC-42',
      subscriberName: 'Juan Dela Cruz',
      payerType: 'philhealth',
      relationship: 'self',
    });
    // form closes on success
    await waitFor(() => expect(screen.queryByTestId('insurance-form')).toBeNull());
  });

  test('Edit → toggle active → PATCHes the profile', async () => {
    const captured: { method?: string; url?: string; body?: Record<string, unknown> } = {};
    renderCard(async (req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      if (method === 'PATCH' && url.includes('/insurance-profiles/')) {
        captured.method = method; captured.url = url;
        const raw = req instanceof Request ? await req.text() : (init?.body as string);
        captured.body = raw ? JSON.parse(raw) : undefined;
        return jsonResponse({ ...PROFILE, active: false });
      }
      return jsonResponse([PROFILE]); // GET list
    });

    await waitFor(() => expect(screen.getByTestId('edit-insurance-ip1')).not.toBeNull());
    fireEvent.click(screen.getByTestId('edit-insurance-ip1'));
    await waitFor(() => expect(screen.getByTestId('insurance-form')).not.toBeNull());
    // prefilled from the profile
    expect((screen.getByTestId('ins-insurer') as HTMLInputElement).value).toBe('Maxicare');
    fireEvent.click(screen.getByTestId('ins-active')); // active → false
    fireEvent.click(screen.getByTestId('save-insurance-btn'));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.method).toBe('PATCH');
    expect(captured.url).toContain('/dental/patients/pt-1/insurance-profiles/ip1');
    expect(captured.body).toMatchObject({ insurerName: 'Maxicare', active: false });
  });
});
