/**
 * HouseholdCard unit tests — P1-27 household / guarantor
 *
 * Uses global.fetch mocking — no mock.module() to prevent process contamination.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { HouseholdCard } from './household-card';

const HOUSEHOLD_RESPONSE = {
  household: {
    id: 'hh-1',
    branchId: 'branch-1',
    name: 'Santos Family',
    guarantorPatientId: 'pt-1',
    notes: null,
  },
  members: [
    { id: 'm-1', householdId: 'hh-1', patientId: 'pt-1', relationship: 'self', isGuarantor: true },
    { id: 'm-2', householdId: 'hh-1', patientId: 'pt-2', relationship: 'child', isGuarantor: false },
  ],
};

describe('HouseholdCard', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  function renderCard(fetchImpl: () => unknown) {
    global.fetch = mock(fetchImpl as Parameters<typeof mock>[0]);
    const qc = freshClient();
    render(React.createElement(HouseholdCard, { patientId: 'pt-2' }), { wrapper: makeWrapper(qc) });
  }

  test('renders loading skeleton while loading', () => {
    renderCard(() => new Promise(() => {}));
    expect(screen.getByTestId('household-loading')).not.toBeNull();
  });

  test('renders the household with name + members + guarantor badge', async () => {
    renderCard(() => jsonResponse(HOUSEHOLD_RESPONSE));
    await waitFor(() => expect(screen.getByTestId('household-card')).not.toBeNull());
    expect(screen.getByTestId('household-name').textContent).toBe('Santos Family');
    expect(screen.getAllByTestId('household-member').length).toBe(2);
    expect(screen.getByTestId('guarantor-badge')).not.toBeNull();
  });

  test('renders empty state when patient has no household (404)', async () => {
    renderCard(() => Promise.resolve(new Response('not found', { status: 404 })));
    await waitFor(() => expect(screen.getByTestId('household-empty')).not.toBeNull());
    expect(screen.getByText(/not linked to a household/i)).not.toBeNull();
  });

  test('renders error state on non-404 failure', async () => {
    renderCard(() => Promise.resolve(new Response('error', { status: 500 })));
    await waitFor(() => expect(screen.getByTestId('household-error')).not.toBeNull());
  });
});
