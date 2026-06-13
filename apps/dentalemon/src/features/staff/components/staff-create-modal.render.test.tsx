/**
 * StaffCreateModal rendered mutation pins — dental-org AHA FIX-002 (GAP-8).
 *
 * The pre-existing staff-create-modal.test.ts asserts pure helpers only; a
 * mis-wired modal would stay green. This pin renders the real component and
 * asserts the create flow issues the real network calls:
 *   POST /dental/org/members?branchId= with {displayName, role}
 *   then POST /dental/org/members/{id}/reset-pin with the chosen PIN.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { StaffCreateModal } from './staff-create-modal';

const BRANCH_ID = 'b0000000-0000-4000-8000-00000000s7af';
const NEW_ID = 'a1000000-0000-4000-8000-00000000000n';

const originalFetch = global.fetch;
let postCalls: Array<{ url: string; body: any }> = [];

beforeEach(() => {
  postCalls = [];
  global.fetch = (async (input: any, init?: any) => {
    const req = typeof input === 'string' ? null : input;
    const url = req ? req.url : input;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'POST') {
      let body: any = {};
      if (init?.body) body = JSON.parse(init.body);
      else if (req) { try { body = await req.clone().json(); } catch { /* no body */ } }
      postCalls.push({ url, body });
      if (url.includes('/reset-pin')) return jsonResponse({ success: true });
      return jsonResponse({
        id: NEW_ID,
        branchId: BRANCH_ID,
        displayName: body.displayName,
        role: body.role,
        status: 'active',
        pinFailedAttempts: 0,
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }, 201);
    }
    return jsonResponse({ data: [] });
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

describe('StaffCreateModal — create mutation pin (FIX-002)', () => {
  test('create posts member body to the branch-scoped endpoint, then sets the PIN', async () => {
    const qc = freshClientWithMutations();
    let created = false;
    render(
      React.createElement(StaffCreateModal, {
        branchId: BRANCH_ID,
        open: true,
        onClose: () => {},
        onCreated: () => { created = true; },
      }),
      { wrapper: makeWrapper(qc) },
    );

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Nurse Pin' } });
    fireEvent.click(screen.getByText('Staff - Full Operations'));
    fireEvent.change(screen.getByLabelText(/^pin/i), { target: { value: '224466' } });
    fireEvent.change(screen.getByLabelText(/confirm pin/i), { target: { value: '224466' } });
    fireEvent.click(screen.getByRole('button', { name: /create staff member/i }));

    await waitFor(() => expect(postCalls.length).toBe(2));

    const createCall = postCalls[0];
    expect(createCall.url).toContain('/dental/org/members');
    expect(createCall.url).toContain(`branchId=${BRANCH_ID}`);
    expect(createCall.body.displayName).toBe('Nurse Pin');
    expect(createCall.body.role).toBe('staff_full');

    const pinCall = postCalls[1];
    expect(pinCall.url).toContain(`/dental/org/members/${NEW_ID}/reset-pin`);
    expect(pinCall.body.newPin).toBe('224466');

    await waitFor(() => expect(created).toBe(true));
  });
});
