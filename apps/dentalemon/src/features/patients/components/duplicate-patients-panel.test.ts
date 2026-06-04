/**
 * DuplicatePatientsPanel unit tests — P2-16 duplicate detection
 *
 * Uses global.fetch mocking — no mock.module() to prevent process contamination.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { DuplicatePatientsPanel } from './duplicate-patients-panel';

const RESPONSE = {
  groupCount: 2,
  groups: [
    {
      matchType: 'strong',
      matchKey: 'maria|santos|1990-04-22',
      patients: [
        { id: 'p1', displayName: 'Maria Santos', dateOfBirth: '1990-04-22', email: null, phone: '+639170000001', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'p2', displayName: 'Maria Santos', dateOfBirth: '1990-04-22', email: null, phone: null, createdAt: '2026-02-01T00:00:00Z' },
      ],
    },
    {
      matchType: 'name',
      matchKey: 'jose|reyes',
      patients: [
        { id: 'p3', displayName: 'Jose Reyes', dateOfBirth: '1980-01-01', email: null, phone: null, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'p4', displayName: 'Jose Reyes', dateOfBirth: '1981-02-02', email: null, phone: null, createdAt: '2026-02-01T00:00:00Z' },
      ],
    },
  ],
};

describe('DuplicatePatientsPanel', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  function renderPanel(fetchImpl: () => unknown, branchId: string | null = 'branch-1') {
    global.fetch = mock(fetchImpl as Parameters<typeof mock>[0]);
    const qc = freshClient();
    render(React.createElement(DuplicatePatientsPanel, { branchId }), { wrapper: makeWrapper(qc) });
  }

  test('shows no-branch message when branchId is null', () => {
    renderPanel(() => new Promise(() => {}), null);
    expect(screen.getByTestId('duplicates-no-branch')).not.toBeNull();
  });

  test('renders loading state', () => {
    renderPanel(() => new Promise(() => {}));
    expect(screen.getByTestId('duplicates-loading')).not.toBeNull();
  });

  test('renders duplicate groups with candidates and match badges', async () => {
    renderPanel(() => jsonResponse(RESPONSE));
    await waitFor(() => expect(screen.getByTestId('duplicates-panel')).not.toBeNull());
    expect(screen.getAllByTestId('duplicate-group').length).toBe(2);
    expect(screen.getAllByTestId('duplicate-candidate').length).toBe(4);
    expect(screen.getAllByTestId('match-badge').length).toBe(2);
    expect(screen.getByText(/Likely duplicate/i)).not.toBeNull();
    expect(screen.getByText(/Possible match/i)).not.toBeNull();
  });

  test('renders empty state when no groups', async () => {
    renderPanel(() => jsonResponse({ groupCount: 0, groups: [] }));
    await waitFor(() => expect(screen.getByTestId('duplicates-empty')).not.toBeNull());
    expect(screen.getByText(/No duplicate patients found/i)).not.toBeNull();
  });

  test('renders error state on fetch failure', async () => {
    renderPanel(() => Promise.resolve(new Response('error', { status: 500 })));
    await waitFor(() => expect(screen.getByTestId('duplicates-error')).not.toBeNull());
  });
});
