/**
 * OnboardingWizard component tests
 *
 * Drives the SHIPPED OnboardingWizard through its real multi-step flow and the
 * handleFinish submit chain (onboarding-wizard.tsx). Verifies:
 *   - per-step validation blocks Next and surfaces errors
 *   - the "Get Started" path fires the new 3-call chain in order
 *     (onboarding → set-pin → patient) with the entered data, seeds the
 *     org-context store from the 3-ID onboarding response, and calls onComplete
 *   - "Skip for now" runs the same chain minus the patient call
 *   - a failure mid-chain surfaces the error and does NOT call onComplete
 *   - a 409 (already have a clinic) routes straight to the dashboard
 *   - a 403 EMAIL_NOT_VERIFIED surfaces the verify-email message and stops
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingWizard } from './onboarding-wizard';
import { useOrgContextStore } from '@/stores/org-context.store';
// Install the error interceptor so SdkError is thrown (same as what ApiProvider does at runtime).
// Without this, the SDK throws the raw JSON body (no status code) and the onboarding wizard's
// 409/403/429 error handling code can never run in tests.
import { client as sdkClient } from '@monobase/sdk-ts/generated/client.gen';
import { errorInterceptor } from '@monobase/sdk-ts/client';

// Guard: only install once per process, matching ApiProvider's useRef guard.
let _interceptorInstalled = false;
if (!_interceptorInstalled) {
  sdkClient.interceptors.error.use(errorInterceptor);
  _interceptorInstalled = true;
}

function makeWrapper(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

interface FetchCall { url: string; method: string; body: any }

type OnboardingOutcome =
  | { kind: 'ok' }
  | { kind: 'fail'; on: 'onboarding' | 'pin' }
  | { kind: 'status'; status: number; body: Record<string, unknown> };

function installFetch(outcome: OnboardingOutcome = { kind: 'ok' }) {
  const calls: FetchCall[] = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });

    const json = (data: unknown, status = 201) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.endsWith('/dental/onboarding')) {
      if (outcome.kind === 'fail' && outcome.on === 'onboarding') return json({ message: 'boom' }, 422);
      if (outcome.kind === 'status') return json(outcome.body, outcome.status);
      return json({ organizationId: 'org-1', branchId: 'branch-1', membershipId: 'member-1' });
    }
    if (url.endsWith('/set-pin')) {
      return outcome.kind === 'fail' && outcome.on === 'pin' ? json({ message: 'boom' }, 422) : json({ ok: true }, 200);
    }
    if (url.endsWith('/dental/patients')) return json({ id: 'pat-1' });
    return json({});
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
      render(makeWrapper(React.createElement(OnboardingWizard, { onComplete: () => {} })));
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
      render(makeWrapper(React.createElement(OnboardingWizard, { onComplete: () => {} })));
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

  test('runs the onboarding → set-pin → patient chain in order and completes', async () => {
    const user = userEvent.setup();
    const onComplete = mock(() => {});
    const f = installFetch();
    try {
      render(makeWrapper(React.createElement(OnboardingWizard, { onComplete })));
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
      expect(posts[0]!.endsWith('/dental/onboarding')).toBe(true);
      expect(posts[1]!.endsWith('/members/member-1/set-pin')).toBe(true);
      expect(posts[2]!.endsWith('/dental/patients')).toBe(true);

      // entered data flowed into the single onboarding request
      const onb = f.calls.find(c => c.url.endsWith('/dental/onboarding'))!.body;
      expect(onb.organizationName).toBe('Bright Smiles');
      expect(onb.tier).toBe('solo');
      expect(onb.ownerDisplayName).toBe('Dr. Ana Reyes');
      expect(f.calls.find(c => c.url.endsWith('/set-pin'))!.body.pin).toBe('123456');

      const patientBody = f.calls.find(c => c.url.endsWith('/dental/patients'))!.body;
      expect(patientBody.displayName).toBe('Juan dela Cruz');
      // Regression: the first-patient call must carry branchId + consentGiven, or
      // createDentalPatient rejects it and the entered patient is silently dropped.
      expect(patientBody.branchId).toBe('branch-1');
      expect(patientBody.consentGiven).toBe(true);

      // org context seeded from the 3-ID onboarding response
      const ctx = useOrgContextStore.getState();
      expect(ctx.orgId).toBe('org-1');
      expect(ctx.branchId).toBe('branch-1');
      expect(ctx.memberId).toBe('member-1');
    } finally {
      f.restore();
    }
  });

  test('submits entered fee-schedule prices on finish (G-11)', async () => {
    const user = userEvent.setup();
    const onComplete = mock(() => {});
    const f = installFetch();
    try {
      render(makeWrapper(React.createElement(OnboardingWizard, { onComplete })));
      await fillClinicAndAdvance(user);
      await fillDentistAndAdvance(user);

      // fees step: set ₱500 for the first CDT (D0120), leave the rest at 0
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Fee Schedule' })).not.toBeNull());
      const priceInputs = screen.getAllByRole('spinbutton');
      await user.type(priceInputs[0]!, '500');
      await user.click(screen.getByRole('button', { name: /^next$/i }));

      // skip the patient step and finish
      await waitFor(() => expect(screen.getByRole('button', { name: /skip for now/i })).not.toBeNull());
      await user.click(screen.getByRole('button', { name: /skip for now/i }));
      await waitFor(() => expect(onComplete.mock.calls.length).toBe(1));

      // G-11: the entered price must be PATCHed to /dental/fee-schedule/{cdt} with the
      // new branch — previously the fees state was held but never submitted (dropped).
      const feeCall = f.calls.find(c => c.method === 'PATCH' && c.url.includes('/dental/fee-schedule/D0120'));
      expect(feeCall).toBeDefined();
      expect(feeCall!.body.priceCents).toBe(50000);
      expect(feeCall!.body.branchId).toBe('branch-1');

      // a fee left at 0 (default) is NOT submitted
      expect(f.calls.some(c => c.method === 'PATCH' && c.url.includes('/dental/fee-schedule/D7140'))).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('"Skip for now" runs the chain without the patient call', async () => {
    const user = userEvent.setup();
    const onComplete = mock(() => {});
    const f = installFetch();
    try {
      render(makeWrapper(React.createElement(OnboardingWizard, { onComplete })));
      await fillClinicAndAdvance(user);
      await fillDentistAndAdvance(user);
      await advanceFees(user);

      await waitFor(() => expect(screen.getByRole('button', { name: /skip for now/i })).not.toBeNull());
      await user.click(screen.getByRole('button', { name: /skip for now/i }));

      await waitFor(() => expect(onComplete.mock.calls.length).toBe(1));
      expect(f.calls.some(c => c.url.endsWith('/dental/patients'))).toBe(false);
      // onboarding + set-pin only
      expect(f.calls.filter(c => c.method === 'POST').length).toBe(2);
    } finally {
      f.restore();
    }
  });

  test('stops the chain and surfaces an error when onboarding fails', async () => {
    const user = userEvent.setup();
    const onComplete = mock(() => {});
    const f = installFetch({ kind: 'fail', on: 'onboarding' });
    try {
      render(makeWrapper(React.createElement(OnboardingWizard, { onComplete })));
      await fillClinicAndAdvance(user);
      await fillDentistAndAdvance(user);
      await advanceFees(user);
      await user.click(screen.getByRole('button', { name: /skip for now/i }));

      await waitFor(() => expect(screen.getByText(/boom|Clinic setup failed/i)).not.toBeNull());
      expect(onComplete.mock.calls.length).toBe(0);
      // onboarding POST happened, set-pin did not
      expect(f.calls.some(c => c.url.endsWith('/dental/onboarding'))).toBe(true);
      expect(f.calls.some(c => c.url.endsWith('/set-pin'))).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('routes to the dashboard when onboarding returns 409 (already have a clinic)', async () => {
    const user = userEvent.setup();
    const onComplete = mock(() => {});
    const f = installFetch({ kind: 'status', status: 409, body: { code: 'ORG_LIMIT_REACHED', message: 'You already have an active clinic' } });
    try {
      render(makeWrapper(React.createElement(OnboardingWizard, { onComplete })));
      await fillClinicAndAdvance(user);
      await fillDentistAndAdvance(user);
      await advanceFees(user);
      await user.click(screen.getByRole('button', { name: /skip for now/i }));

      // 409 → straight to dashboard, no set-pin, no error surfaced
      await waitFor(() => expect(onComplete.mock.calls.length).toBe(1));
      expect(f.calls.some(c => c.url.endsWith('/set-pin'))).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('preserves entered first-patient details across a page refresh (G-40)', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      const first = render(makeWrapper(React.createElement(OnboardingWizard, { onComplete: () => {} })));
      await fillClinicAndAdvance(user);
      await fillDentistAndAdvance(user);
      await advanceFees(user);

      // patient step — enter the first patient's details
      await waitFor(() => expect(screen.getByLabelText('Date of Birth')).not.toBeNull());
      await user.type(screen.getByLabelText('Full Name'), 'Juan dela Cruz');
      await user.type(screen.getByLabelText('Date of Birth'), '2000-01-01');

      // Simulate a page refresh: unmount + remount so loadState() re-reads
      // localStorage exactly as a fresh page load would.
      first.unmount();
      cleanup();
      render(makeWrapper(React.createElement(OnboardingWizard, { onComplete: () => {} })));

      // resumeStep (G-26) clamps a saved 'patient' step back to 'dentist' to force
      // PIN re-entry (the PIN is never persisted). Re-enter it and walk forward.
      await waitFor(() => expect(screen.getByLabelText('6-digit PIN')).not.toBeNull());
      await user.type(screen.getByLabelText('6-digit PIN'), '123456');
      await user.click(screen.getByRole('button', { name: /^next$/i }));
      await advanceFees(user);

      // The patient details entered before the refresh must still be there.
      await waitFor(() => expect(screen.getByLabelText('Date of Birth')).not.toBeNull());
      expect((screen.getByLabelText('Full Name') as HTMLInputElement).value).toBe('Juan dela Cruz');
      expect((screen.getByLabelText('Date of Birth') as HTMLInputElement).value).toBe('2000-01-01');
    } finally {
      f.restore();
    }
  });

  test('surfaces a verify-email message on 403 EMAIL_NOT_VERIFIED and stops', async () => {
    const user = userEvent.setup();
    const onComplete = mock(() => {});
    const f = installFetch({ kind: 'status', status: 403, body: { code: 'EMAIL_NOT_VERIFIED', message: 'forbidden' } });
    try {
      render(makeWrapper(React.createElement(OnboardingWizard, { onComplete })));
      await fillClinicAndAdvance(user);
      await fillDentistAndAdvance(user);
      await advanceFees(user);
      await user.click(screen.getByRole('button', { name: /skip for now/i }));

      await waitFor(() => expect(screen.getByText(/verify your email/i)).not.toBeNull());
      expect(onComplete.mock.calls.length).toBe(0);
      expect(f.calls.some(c => c.url.endsWith('/set-pin'))).toBe(false);
    } finally {
      f.restore();
    }
  });
});
