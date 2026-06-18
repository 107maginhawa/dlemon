/**
 * ClaimsWorklist — P1-26 worklist render: empty state, populated rows, payer
 * aging summary, and the error state. Uses global.fetch mocking by URL.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper } from '@/test-utils';
import { ClaimsWorklist } from './claims-worklist';

const originalFetch = global.fetch;
const BRANCH = 'b0000000-0000-4000-8000-000000000001';

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

function mockByUrl(map: (url: string) => unknown | undefined, fallbackStatus = 200) {
  global.fetch = mock((input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const body = map(url);
    if (body === undefined) return Promise.resolve(new Response('not mocked', { status: 500 }));
    return Promise.resolve(new Response(JSON.stringify(body), { status: fallbackStatus, headers: { 'Content-Type': 'application/json' } }));
  }) as any;
}

function renderWorklist() {
  const qc = freshClient();
  render(React.createElement(ClaimsWorklist, { branchId: BRANCH, canWrite: true }), { wrapper: makeWrapper(qc) });
  return qc;
}

describe('ClaimsWorklist', () => {
  beforeEach(() => {
    mockByUrl((url) => {
      if (url.includes('/claims/aging')) {
        return {
          asOf: new Date().toISOString(),
          summary: { currentCents: 50000, days30Cents: 0, days60Cents: 0, days90PlusCents: 0, totalOutstandingCents: 50000, payerCount: 1, claimCount: 1 },
          payers: [{ insuranceProfileId: 'p1', payerName: 'Maxicare', currentCents: 50000, days30Cents: 0, days60Cents: 0, days90PlusCents: 0, totalOutstandingCents: 50000, claimCount: 1, oldestClaimDays: 5 }],
        };
      }
      if (url.includes('/claims')) {
        return {
          items: [
            { id: 'c1', claimNumber: 'CLM-2026-AAA', patientId: 'pat1', insuranceProfileId: 'p1', status: 'submitted', billedAmountCents: 100000, paidByPayerCents: 0, disallowedCents: null, patientPortionCents: 100000, payerReference: null, submittedAt: null },
          ],
          total: 1,
        };
      }
      return undefined;
    });
  });

  test('renders claim rows + the payer aging summary', async () => {
    renderWorklist();
    await waitFor(() => expect(screen.getByTestId('claims-worklist')).not.toBeNull());
    await waitFor(() => expect(screen.getByText('CLM-2026-AAA')).not.toBeNull());
    expect(screen.getByTestId('payer-aging')).not.toBeNull();
    expect(screen.getByText('Maxicare')).not.toBeNull();
  });

  test('a submitted claim exposes the Manage action (canWrite + remittance-eligible)', async () => {
    renderWorklist();
    await waitFor(() => expect(screen.getByTestId('claim-action-c1')).not.toBeNull());
  });

  test('shows the empty state when there are no claims', async () => {
    mockByUrl((url) => {
      if (url.includes('/claims/aging')) return { asOf: '', summary: { currentCents: 0, days30Cents: 0, days60Cents: 0, days90PlusCents: 0, totalOutstandingCents: 0, payerCount: 0, claimCount: 0 }, payers: [] };
      if (url.includes('/claims')) return { items: [], total: 0 };
      return undefined;
    });
    renderWorklist();
    await waitFor(() => expect(screen.getByTestId('claims-empty')).not.toBeNull());
  });

  test('exposes a create-claim affordance for writers (Phase 1b — roadmap-approved, supersedes the parked decision #3)', async () => {
    renderWorklist();
    await waitFor(() => expect(screen.getByTestId('claims-worklist')).not.toBeNull());
    // DECISION REVERSAL: the billing roadmap (BILLING_ROADMAP_AND_SPECS §3, Phase 1b,
    // approved 2026-06-18) builds the full HMO cycle INCLUDING create-claim into this
    // worklist. The earlier "parked Phase-2" pin is superseded. Full create-flow
    // behaviour is covered in claims-worklist.create.test.tsx; here we just confirm
    // the affordance is present (writer) so a regression that drops it flips RED.
    expect(screen.getByTestId('new-claim-btn')).not.toBeNull();
    // Non-vacuous: the worklist itself rendered (read path works) + a row is present.
    await waitFor(() => expect(screen.getByText('CLM-2026-AAA')).not.toBeNull());
  });

  test('surfaces the error state when the claims query fails', async () => {
    global.fetch = mock((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/claims/aging')) {
        return Promise.resolve(new Response(JSON.stringify({ asOf: '', summary: { currentCents: 0, days30Cents: 0, days60Cents: 0, days90PlusCents: 0, totalOutstandingCents: 0, payerCount: 0, claimCount: 0 }, payers: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response('boom', { status: 500 }));
    }) as any;
    renderWorklist();
    await waitFor(() => expect(screen.getByTestId('claims-error')).not.toBeNull());
  });
});
