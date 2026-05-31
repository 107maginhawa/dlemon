/**
 * OnboardingWizard component tests
 *
 * Drives the SHIPPED OnboardingWizard through its real multi-step flow and the
 * handleFinish submit chain (onboarding-wizard.tsx). The previous version of
 * this file asserted re-declared copies of the validation/label helpers and
 * never rendered the component or exercised the create chain — it proved nothing
 * about shipped behaviour. This rewrite mounts the wizard and verifies:
 *   - per-step validation blocks Next and surfaces errors
 *   - the full "Get Started" path fires the 5 POSTs in order
 *     (org → branch → member → set-pin → patient) with the entered data,
 *     seeds the org-context store, and calls onComplete
 *   - "Skip for now" runs the same chain minus the patient call
 *   - a failure mid-chain surfaces the error and does NOT call onComplete
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { OnboardingWizard } from './onboarding-wizard';
import { useOrgContextStore } from '@/stores/org-context.store';

interface FetchCall { url: string; method: string; body: any }

function installFetch(failOn?: string) {
  const calls: FetchCall[] = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });

    const fail = (status = 422, message = 'boom') =>
      new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });
    const ok = (data: unknown, status = 201) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.endsWith('/dental/organizations')) return failOn === 'org' ? fail() : ok({ id: 'org-1' });
    if (url.endsWith('/branches')) return failOn === 'branch' ? fail() : ok({ id: 'branch-1' });
    if (url.endsWith('/members')) return failOn === 'member' ? fail() : ok({ id: 'member-1' });
    if (url.endsWith('/set-pin')) return failOn === 'pin' ? fail() : ok({ ok: true }, 200);
    if (url.endsWith('/dental/patients')) return ok({ id: 'pat-1' });
    return ok({});
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

async function fillClinicAndAdvance(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Clinic Name'), 'Bright Smiles');
  await user.click(screen.getByRole('button', { name: /^next$/i }));
}
async function fillDentistAndAdvance(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByLabelText('6-digit PIN')).not.toBeNull());
  await user.type(screen.getByLabelText('Full Name'), 'Dr. Ana Reyes');
  await user.type(screen.getByLabelText('6-digit PIN'), '123456');
  await user.click(screen.getByRole('button', { name: /^next$/i }));
}
async function advanceFees(user: ReturnType<typeof userEvent.setup>) {
  // "Fee Schedule" also appears in the step indicator — match the step heading.
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Fee Schedule' })).not.toBeNull());
  await user.click(screen.getByRole('button', { name: /^next$/i }));
}

beforeEach(() => {
  localStorage.clear();
  useOrgContextStore.getState().clearContext?.();
});
afterEach(cleanup);

describe('OnboardingWizard — shipped component', () => {
  test('blocks Next on the clinic step until the clinic name is filled', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      render(React.createElement(OnboardingWizard, { onComplete: () => {} }));
      await user.click(screen.getByRole('button', { name: /^next$/i }));
      expect(screen.getByText('Clinic name is required')).not.toBeNull();
      // still on clinic step — no network calls
      expect(f.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('requires a valid 6-digit PIN on the dentist step', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      render(React.createElement(OnboardingWizard, { onComplete: () => {} }));
      await fillClinicAndAdvance(user);
      await waitFor(() => expect(screen.getByLabelText('6-digit PIN')).not.toBeNull());
      await user.type(screen.getByLabelText('Full Name'), 'Dr. Ana Reyes');
      // no PIN entered → Next blocked
      await user.click(screen.getByRole('button', { name: /^next$/i }));
      expect(screen.getByText('PIN must be exactly 6 digits')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('runs the full 5-call submit chain in order and completes', async () => {
    const user = userEvent.setup();
    const onComplete = mock(() => {});
    const f = installFetch();
    try {
      render(React.createElement(OnboardingWizard, { onComplete }));
      await fillClinicAndAdvance(user);
      await fillDentistAndAdvance(user);
      await advanceFees(user);

      // patient step
      await waitFor(() => expect(screen.getByLabelText('Date of Birth')).not.toBeNull());
      await user.type(screen.getByLabelText('Full Name'), 'Juan dela Cruz');
      await user.type(screen.getByLabelText('Date of Birth'), '2000-01-01');
      await user.click(screen.getByRole('button', { name: /get started/i }));

      await waitFor(() => expect(onComplete.mock.calls.length).toBe(1));

      const posts = f.calls.filter(c => c.method === 'POST').map(c => c.url);
      expect(posts[0]!.endsWith('/dental/organizations')).toBe(true);
      expect(posts[1]!.endsWith('/organizations/org-1/branches')).toBe(true);
      expect(posts[2]!.endsWith('/branches/branch-1/members')).toBe(true);
      expect(posts[3]!.endsWith('/members/member-1/set-pin')).toBe(true);
      expect(posts[4]!.endsWith('/dental/patients')).toBe(true);

      // entered data flowed into the requests
      expect(f.calls.find(c => c.url.endsWith('/dental/organizations'))!.body.name).toBe('Bright Smiles');
      expect(f.calls.find(c => c.url.endsWith('/members'))!.body.displayName).toBe('Dr. Ana Reyes');
      expect(f.calls.find(c => c.url.endsWith('/set-pin'))!.body.pin).toBe('123456');
      const patientBody = f.calls.find(c => c.url.endsWith('/dental/patients'))!.body;
      expect(patientBody.displayName).toBe('Juan dela Cruz');
      // Regression: the first-patient call must carry branchId + consentGiven, or
      // createDentalPatient rejects it (branchId required / CONSENT_REQUIRED) and
      // the patient the user entered is silently dropped.
      expect(patientBody.branchId).toBe('branch-1');
      expect(patientBody.consentGiven).toBe(true);

      // org context seeded from the created ids
      const ctx = useOrgContextStore.getState();
      expect(ctx.orgId).toBe('org-1');
      expect(ctx.branchId).toBe('branch-1');
      expect(ctx.memberId).toBe('member-1');
    } finally {
      f.restore();
    }
  });

  test('"Skip for now" runs the chain without the patient call', async () => {
    const user = userEvent.setup();
    const onComplete = mock(() => {});
    const f = installFetch();
    try {
      render(React.createElement(OnboardingWizard, { onComplete }));
      await fillClinicAndAdvance(user);
      await fillDentistAndAdvance(user);
      await advanceFees(user);

      await waitFor(() => expect(screen.getByRole('button', { name: /skip for now/i })).not.toBeNull());
      await user.click(screen.getByRole('button', { name: /skip for now/i }));

      await waitFor(() => expect(onComplete.mock.calls.length).toBe(1));
      expect(f.calls.some(c => c.url.endsWith('/dental/patients'))).toBe(false);
      expect(f.calls.filter(c => c.method === 'POST').length).toBe(4);
    } finally {
      f.restore();
    }
  });

  test('stops the chain and surfaces an error when branch creation fails', async () => {
    const user = userEvent.setup();
    const onComplete = mock(() => {});
    const f = installFetch('branch');
    try {
      render(React.createElement(OnboardingWizard, { onComplete }));
      await fillClinicAndAdvance(user);
      await fillDentistAndAdvance(user);
      await advanceFees(user);
      await user.click(screen.getByRole('button', { name: /skip for now/i }));

      await waitFor(() => expect(screen.getByText(/boom|Branch creation failed/i)).not.toBeNull());
      expect(onComplete.mock.calls.length).toBe(0);
      // org POST happened, member/set-pin did not
      expect(f.calls.some(c => c.url.endsWith('/dental/organizations'))).toBe(true);
      expect(f.calls.some(c => c.url.endsWith('/members'))).toBe(false);
    } finally {
      f.restore();
    }
  });
});
