/**
 * StaffEditModal interaction tests — dental-org AHA FIX-001 (GAP-1).
 *
 * FR6.1 requires staff edit; the backend updateMember handler exists (owner-only,
 * role-change audited) but had zero FE consumers. These tests pin the real wiring:
 *   1. the modal prefills from the member being edited;
 *   2. Save issues a PATCH to /dental/org/members/{memberId} with the changed
 *      fields (mutation-call assertion — not a helper-only test);
 *   3. success closes the modal and notifies the caller.
 *
 * Uses global.fetch mocking per repo convention (no mock.module).
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { StaffEditModal } from './staff-edit-modal';
import type { Member } from '../hooks/use-staff-members';

const BRANCH_ID = 'b0000000-0000-4000-8000-00000000s7af';
const MEMBER: Member = {
  id: 'a1000000-0000-4000-8000-000000000001',
  branchId: BRANCH_ID,
  displayName: 'Dr. Ana Cruz',
  role: 'dentist_associate',
  status: 'active',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  licenseNumber: 'PRC-12345',
  npi: '1234567890',
  credentialType: 'DMD',
};

const originalFetch = global.fetch;
let patchCalls: Array<{ url: string; body: any }> = [];

beforeEach(() => {
  patchCalls = [];
  global.fetch = (async (input: any, init?: any) => {
    const req = typeof input === 'string' ? null : input;
    const url = req ? req.url : input;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'PATCH' && url.includes('/dental/org/members/')) {
      let body: any = {};
      if (init?.body) body = JSON.parse(init.body);
      else if (req) { try { body = await req.clone().json(); } catch { /* no body */ } }
      patchCalls.push({ url, body });
      return jsonResponse({ ...MEMBER, ...body, version: 2, updatedAt: '2026-01-02T00:00:00.000Z' });
    }
    return jsonResponse({ data: [] });
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

function renderModal(overrides: Partial<React.ComponentProps<typeof StaffEditModal>> = {}) {
  const qc = freshClientWithMutations();
  const props = {
    branchId: BRANCH_ID,
    member: MEMBER,
    open: true,
    onClose: () => {},
    ...overrides,
  };
  render(React.createElement(StaffEditModal, props), { wrapper: makeWrapper(qc) });
  return props;
}

describe('StaffEditModal — prefill', () => {
  test('renders prefilled displayName, license, NPI and credential from the member', () => {
    renderModal();
    expect((screen.getByLabelText(/display name/i) as HTMLInputElement).value).toBe('Dr. Ana Cruz');
    expect((screen.getByLabelText(/license number/i) as HTMLInputElement).value).toBe('PRC-12345');
    expect((screen.getByLabelText(/npi/i) as HTMLInputElement).value).toBe('1234567890');
    expect((screen.getByLabelText(/credential/i) as HTMLInputElement).value).toBe('DMD');
  });

  test('marks the member current role as selected', () => {
    renderModal();
    const selected = screen.getByTestId('edit-role-dentist_associate');
    expect(selected.getAttribute('aria-pressed')).toBe('true');
  });

  test('does not render when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByTestId('staff-edit-modal')).toBeNull();
  });
});

describe('StaffEditModal — save wiring (mutation-call assertions)', () => {
  test('Save issues PATCH /dental/org/members/{memberId} with the changed role', async () => {
    let saved = false;
    renderModal({ onSaved: () => { saved = true; } });

    fireEvent.click(screen.getByTestId('edit-role-staff_full'));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(patchCalls.length).toBe(1));
    expect(patchCalls[0].url).toContain(`/dental/org/members/${MEMBER.id}`);
    expect(patchCalls[0].body.role).toBe('staff_full');
    await waitFor(() => expect(saved).toBe(true));
  });

  test('Save includes edited credentials (license/NPI) in the PATCH body', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/license number/i), { target: { value: 'PRC-99999' } });
    fireEvent.change(screen.getByLabelText(/npi/i), { target: { value: '0987654321' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(patchCalls.length).toBe(1));
    expect(patchCalls[0].body.licenseNumber).toBe('PRC-99999');
    expect(patchCalls[0].body.npi).toBe('0987654321');
  });

  test('Save with no edits issues no PATCH (nothing to persist)', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(patchCalls.length).toBe(0);
  });

  test('blank displayName blocks the save with a validation error', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(screen.getByText(/display name is required/i)).toBeDefined());
    expect(patchCalls.length).toBe(0);
  });
});
