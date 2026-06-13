/**
 * StaffList rendered tests — dental-org AHA FIX-001 affordance + FIX-002 pins.
 *
 * The pre-existing staff-list.test.ts asserts pure helpers only (GAP-8 blind
 * spot). These tests render the real component against a mocked fetch and pin:
 *   1. owner sees an Edit affordance on each row;
 *   2. non-owner sees no Edit affordance (RBAC at the affordance level);
 *   3. clicking Edit opens the edit modal prefilled with that member.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { StaffList } from './staff-list';

const BRANCH_ID = 'b0000000-0000-4000-8000-00000000s7af';
const MEMBERS = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    branchId: BRANCH_ID,
    displayName: 'Dr. Owner One',
    role: 'dentist_owner',
    status: 'active',
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    pinFailedAttempts: 0,
    version: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    branchId: BRANCH_ID,
    displayName: 'Dr. Ana Cruz',
    role: 'dentist_associate',
    status: 'active',
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    licenseNumber: 'PRC-12345',
    pinFailedAttempts: 0,
    version: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = (async (input: any, init?: any) => {
    const req = typeof input === 'string' ? null : input;
    const url = req ? req.url : input;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'GET' && url.includes('/dental/org/members')) {
      return jsonResponse({ data: MEMBERS });
    }
    return jsonResponse({ data: [] });
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

function renderList(role: 'dentist_owner' | 'staff_full') {
  const qc = freshClientWithMutations();
  render(
    React.createElement(StaffList, { branchId: BRANCH_ID, currentUserRole: role }),
    { wrapper: makeWrapper(qc) },
  );
}

describe('StaffList — edit affordance (FIX-001)', () => {
  test('owner sees an Edit button on every row', async () => {
    renderList('dentist_owner');
    await waitFor(() => expect(screen.getByText('Dr. Ana Cruz')).toBeDefined());
    const editButtons = screen.getAllByRole('button', { name: /^edit/i });
    expect(editButtons.length).toBe(MEMBERS.length);
  });

  test('non-owner sees no Edit affordance', async () => {
    renderList('staff_full');
    await waitFor(() => expect(screen.getByText('Dr. Ana Cruz')).toBeDefined());
    expect(screen.queryAllByRole('button', { name: /^edit/i }).length).toBe(0);
  });

  test('clicking Edit opens the edit modal prefilled with that member', async () => {
    renderList('dentist_owner');
    await waitFor(() => expect(screen.getByText('Dr. Ana Cruz')).toBeDefined());

    const editButtons = screen.getAllByRole('button', { name: /^edit/i });
    fireEvent.click(editButtons[1]); // second row = Dr. Ana Cruz

    await waitFor(() => expect(screen.getByTestId('staff-edit-modal')).toBeDefined());
    expect((screen.getByLabelText(/display name/i) as HTMLInputElement).value).toBe('Dr. Ana Cruz');
  });
});
