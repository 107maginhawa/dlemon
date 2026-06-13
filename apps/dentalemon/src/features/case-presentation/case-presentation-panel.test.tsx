/**
 * CasePresentationPanel tests — case-presentation FIX-002 entry point.
 *
 * Pins the read-back routing: a DECIDED presentation renders the read-only
 * AcceptedPlanViewer (the signed legal record), an UNDECIDED one renders the
 * interactive CasePresentationView. global.fetch mocks the getCasePresentation op.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { CasePresentationPanel } from './case-presentation-panel';

const PAT = 'aa000000-0000-4000-8000-000000000001';
const PRES = 'bb000000-0000-4000-8000-000000000002';

function sdkAggregate(decision: 'accepted' | 'rejected' | null) {
  const base = {
    id: PRES, version: 1, createdAt: '2026-06-11T08:00:00.000Z', updatedAt: '2026-06-11T08:30:00.000Z',
    patientId: PAT, treatmentPlanId: 'plan1', planVersionId: null,
    status: decision === 'accepted' ? 'accepted' : decision === 'rejected' ? 'rejected' : 'viewed',
    decision: decision ?? undefined,
    decisionAt: decision ? '2026-06-11T08:30:00.000Z' : null,
    signerName: decision === 'accepted' ? 'Maria Santos' : null,
    consentFormId: null, rejectionReason: decision === 'rejected' ? 'Deferring' : null,
    firstViewedAt: null, lastViewedAt: null,
  };
  return {
    presentation: base,
    plan: { id: 'plan1', version: 1, createdAt: '2026-06-11T08:00:00.000Z', updatedAt: '2026-06-11T08:00:00.000Z', patientId: PAT, providerId: 'prov1', status: 'approved', totalEstimateCents: 500000 },
    patientFirstName: 'Maria',
    phases: [{ phase: 'disease_control', subtotalCents: 500000, items: [{ id: 't1', toothNumber: 14, surfaces: null, description: 'Filling', cdtCode: 'D2391', status: 'planned', priceCents: 500000, optionGroupId: null, recommended: false }] }],
    optionGroups: [],
    images: [],
    grandTotalCents: 500000,
  };
}

const originalFetch = global.fetch;

function installFetch(decision: 'accepted' | 'rejected' | null) {
  global.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/case-presentations/')) return jsonResponse(sdkAggregate(decision));
    return jsonResponse({});
  }) as typeof fetch;
}

afterEach(() => { global.fetch = originalFetch; cleanup(); });

function renderPanel() {
  render(React.createElement(CasePresentationPanel, { patientId: PAT, presentationId: PRES }), {
    wrapper: makeWrapper(freshClient()),
  });
}

describe('CasePresentationPanel — decided read-back routing', () => {
  test('an accepted presentation renders the signed-acceptance viewer (not the sign controls)', async () => {
    installFetch('accepted');
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('accepted-plan-viewer')).not.toBeNull());
    expect(screen.getByTestId('accepted-plan-record')).not.toBeNull();
    expect(screen.queryByTestId('case-presentation-view')).toBeNull();
  });

  test('a rejected presentation also renders the read-back viewer', async () => {
    installFetch('rejected');
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('accepted-plan-viewer')).not.toBeNull());
  });

  test('an undecided presentation renders the interactive presentation view', async () => {
    installFetch(null);
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('case-presentation-view')).not.toBeNull());
    expect(screen.queryByTestId('accepted-plan-viewer')).toBeNull();
  });
});
