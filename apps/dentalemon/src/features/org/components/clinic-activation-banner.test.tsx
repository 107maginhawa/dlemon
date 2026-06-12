/**
 * ClinicActivationBanner — C-1 owner activation affordance.
 *
 * A provisional clinic (self-service onboarded) must be activated by the owner
 * before PHI writes are allowed in production. This banner surfaces that to the
 * owner and calls POST /dental/organizations/{id}/activate.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { ClinicActivationBanner } from './clinic-activation-banner';

const ORG_ID = 'or100000-0000-4000-8000-000000000001';

const originalFetch = global.fetch;
let activateCalls: Array<{ url: string; method: string }> = [];

beforeEach(() => {
  activateCalls = [];
  global.fetch = (async (input: any, init?: any) => {
    const req = typeof input === 'string' ? null : input;
    const url = req ? req.url : input;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'POST' && url.includes('/activate')) {
      activateCalls.push({ url, method });
      return jsonResponse({
        id: ORG_ID, name: 'Test Clinic', tier: 'clinic', ownerPersonId: 'p1', countryCode: 'PH',
        active: true, status: 'live', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', version: 2,
      });
    }
    return jsonResponse({ data: [] });
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  useOrgContextStore.getState().clearContext();
  cleanup();
});

function renderBanner() {
  const qc = freshClientWithMutations();
  render(React.createElement(ClinicActivationBanner), { wrapper: makeWrapper(qc) });
}

describe('ClinicActivationBanner', () => {
  test('renders nothing for a live org', () => {
    useOrgContextStore.setState({ orgId: ORG_ID, role: 'dentist_owner', orgStatus: 'live' });
    renderBanner();
    expect(screen.queryByTestId('clinic-activation-banner')).toBeNull();
  });

  test('renders nothing for a non-owner even when provisional', () => {
    useOrgContextStore.setState({ orgId: ORG_ID, role: 'staff_full', orgStatus: 'provisional' });
    renderBanner();
    expect(screen.queryByTestId('clinic-activation-banner')).toBeNull();
  });

  test('renders the activate CTA for a provisional owner', () => {
    useOrgContextStore.setState({ orgId: ORG_ID, role: 'dentist_owner', orgStatus: 'provisional' });
    renderBanner();
    expect(screen.getByTestId('clinic-activation-banner')).toBeDefined();
    expect(screen.getByTestId('activate-clinic-btn')).toBeDefined();
  });

  test('clicking Activate POSTs to /activate and the banner disappears (status → live)', async () => {
    useOrgContextStore.setState({ orgId: ORG_ID, role: 'dentist_owner', orgStatus: 'provisional' });
    renderBanner();

    fireEvent.click(screen.getByTestId('activate-clinic-btn'));

    await waitFor(() => expect(activateCalls.length).toBe(1));
    expect(activateCalls[0].url).toContain(`/dental/organizations/${ORG_ID}/activate`);
    // Store flips to live → banner unmounts.
    await waitFor(() => expect(screen.queryByTestId('clinic-activation-banner')).toBeNull());
    expect(useOrgContextStore.getState().orgStatus).toBe('live');
  });
});
