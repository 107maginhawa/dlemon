/**
 * PatientAuthorizations — the LOA ("Letter of Authorization") finance panel.
 *
 * Closes the orphaned-UI gap (plan 013): the coverage-authorization backend +
 * hooks (usePatientAuthorizations / useAuthorizationMutations) shipped but no
 * component ever rendered them, so no user could reach the flow. This panel wires
 * them up: list authorizations with their FSM status, add one (insuranceProfileId
 * + loaNumber), and approve/deny a 'requested' one.
 *
 * Uses global.fetch mocking by url+method (mirrors claims-worklist.test.tsx).
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper } from '@/test-utils';
import { PatientAuthorizations } from './patient-authorizations';

const originalFetch = global.fetch;
const PATIENT = 'a0000000-0000-4000-8000-0000000000aa';
const PROFILE = 'b0000000-0000-4000-8000-0000000000bb';

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

type Call = { url: string; method: string; body: Record<string, unknown> | undefined };

/**
 * Mock fetch by url+method; record every call so mutation bodies can be asserted.
 * The SDK issues requests as `fetch(new Request(url, { method, body }))` — input is a
 * Request and init is undefined, so the body lives on the Request. Read it by cloning
 * (NOT from init.body, which is undefined for SDK calls). Async so the body can be awaited.
 */
function mockApi(opts: { authorizations?: unknown[]; profiles?: unknown[] }): Call[] {
  const calls: Call[] = [];
  const authz = opts.authorizations ?? [];
  const profiles = opts.profiles ?? [];
  global.fetch = mock(async (input: Request | string, init?: RequestInit) => {
    const url: string = typeof input === 'string' ? input : input.url;
    const method: string = String(
      init?.method ?? (typeof input === 'string' ? undefined : input.method) ?? 'GET',
    ).toUpperCase();
    let raw: string | undefined = typeof init?.body === 'string' ? init.body : undefined;
    if (raw == null && typeof input !== 'string') {
      try { raw = await input.clone().text(); } catch { /* no body */ }
    }
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined;
    calls.push({ url, method, body });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.includes('/insurance-profiles')) return json(profiles);
    if (url.includes('/authorizations') && url.includes('/status') && method === 'PATCH') {
      return json({ id: 'auth1', status: body?.status, insuranceProfileId: PROFILE, patientId: PATIENT, loaNumber: 'LOA-1', approvedAmountCents: body?.approvedAmountCents ?? null });
    }
    if (url.includes('/authorizations') && method === 'POST') {
      return json({ id: 'auth-new', status: 'requested', insuranceProfileId: body?.insuranceProfileId, patientId: PATIENT, loaNumber: body?.loaNumber ?? null, approvedAmountCents: body?.approvedAmountCents ?? null }, 201);
    }
    if (url.includes('/authorizations') && method === 'GET') return json(authz);
    return new Response('not mocked: ' + method + ' ' + url, { status: 500 });
  }) as unknown as typeof globalThis.fetch;
  return calls;
}

function renderPanel() {
  const qc = freshClientWithMutations();
  render(React.createElement(PatientAuthorizations, { patientId: PATIENT }), { wrapper: makeWrapper(qc) });
  return qc;
}

const PROFILES = [
  { id: PROFILE, insurerName: 'Maxicare', policyNumber: 'POL-1', subscriberName: 'Juan Cruz', relationship: 'self', payerType: 'hmo', active: true },
];
const REQUESTED = {
  id: 'auth1', status: 'requested', insuranceProfileId: PROFILE, patientId: PATIENT,
  loaNumber: 'LOA-123', approvedAmountCents: null, validUntil: null, approvedAt: null,
};

describe('PatientAuthorizations', () => {
  test('lists existing authorizations with their LOA number + FSM status', async () => {
    mockApi({ authorizations: [REQUESTED], profiles: PROFILES });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('patient-authorizations')).not.toBeNull());
    await waitFor(() => expect(screen.getByTestId('authorization-row-auth1')).not.toBeNull());
    expect(screen.getByText('LOA-123')).not.toBeNull();
    // status surfaced (the FSM state the user acts on)
    expect(screen.getByTestId('authorization-status-auth1').textContent?.toLowerCase()).toContain('requested');
  });

  test('shows the empty state when the patient has no authorizations', async () => {
    mockApi({ authorizations: [], profiles: PROFILES });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('authorizations-empty')).not.toBeNull());
  });

  test('Add authorization: opening the form, picking a profile + LOA number, submit → POST create', async () => {
    const calls = mockApi({ authorizations: [], profiles: PROFILES });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('authorizations-empty')).not.toBeNull());

    fireEvent.click(screen.getByTestId('add-authorization-btn'));
    await waitFor(() => expect(screen.getByTestId('authorization-form')).not.toBeNull());
    // The profile options load async — wait for the option before selecting it.
    const select = screen.getByTestId('authorization-insurer-select') as HTMLSelectElement;
    await waitFor(() => expect(select.querySelector(`option[value="${PROFILE}"]`)).not.toBeNull());

    fireEvent.change(select, { target: { value: PROFILE } });
    fireEvent.change(screen.getByTestId('authorization-loa-input'), { target: { value: 'LOA-NEW-9' } });
    fireEvent.click(screen.getByTestId('authorization-submit'));

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.includes('/authorizations'));
      expect(post).toBeDefined();
      expect(post!.body?.insuranceProfileId).toBe(PROFILE);
      expect(post!.body?.loaNumber).toBe('LOA-NEW-9');
    });
  });

  test('a requested authorization exposes Approve + Deny that PATCH the status FSM', async () => {
    const calls = mockApi({ authorizations: [REQUESTED], profiles: PROFILES });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('authorization-approve-auth1')).not.toBeNull());
    expect(screen.getByTestId('authorization-deny-auth1')).not.toBeNull();

    fireEvent.click(screen.getByTestId('authorization-approve-auth1'));
    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('/auth1/status'));
      expect(patch).toBeDefined();
      expect(patch!.body?.status).toBe('approved');
    });
  });

  test('Deny on a requested authorization PATCHes status=denied', async () => {
    const calls = mockApi({ authorizations: [REQUESTED], profiles: PROFILES });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('authorization-deny-auth1')).not.toBeNull());
    fireEvent.click(screen.getByTestId('authorization-deny-auth1'));
    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('/auth1/status'));
      expect(patch).toBeDefined();
      expect(patch!.body?.status).toBe('denied');
    });
  });
});
