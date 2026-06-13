/**
 * ConsentTemplates panel tests — dental-org AHA FIX-004 (GAP-2).
 *
 * The consent-template CRUD backend exists (owner-only) but had zero UI; legal
 * text was hardcoded in consent-sheet.tsx. These tests pin the real wiring of a
 * new settings panel to the contract-correct endpoints:
 *   GET    /dental/branches/{branchId}/consent-templates   -> bare array
 *   POST   .../consent-templates                           -> bare created object (201)
 *   PATCH  .../consent-templates/{id}                       -> bare updated object
 *   DELETE .../consent-templates/{id}                       -> {} (soft delete)
 *
 * Mutation-call assertions (not helper-only) — closes the GAP-8 blind spot for
 * this batch's new wiring. global.fetch mock per repo convention.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { ConsentTemplates } from './consent-templates';

const BRANCH_ID = 'b0000000-0000-4000-8000-0000000c0n5t';
const TEMPLATES = [
  { id: 't1000000-0000-4000-8000-000000000001', branchId: BRANCH_ID, name: 'General Dental Consent', body: 'Body A', requiresWitnessSignature: false, active: true },
  { id: 't1000000-0000-4000-8000-000000000002', branchId: BRANCH_ID, name: 'Extraction Consent', body: 'Body B', requiresWitnessSignature: true, active: true },
];

const originalFetch = global.fetch;
let writes: Array<{ method: string; url: string; body: any }> = [];

function installFetch(role: 'dentist_owner' | 'staff_full' = 'dentist_owner') {
  useOrgContextStore.setState({ branchId: BRANCH_ID, role });
  global.fetch = (async (input: any, init?: any) => {
    const req = typeof input === 'string' ? null : input;
    const url = req ? req.url : input;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (url.includes('/consent-templates')) {
      if (method === 'GET') return jsonResponse(TEMPLATES);
      let body: any = {};
      if (init?.body) body = JSON.parse(init.body);
      else if (req) { try { body = await req.clone().json(); } catch { /* none */ } }
      writes.push({ method, url, body });
      if (method === 'POST') return jsonResponse({ id: 't-new', branchId: BRANCH_ID, ...body, active: true }, 201);
      if (method === 'PATCH') return jsonResponse({ id: url.split('/').pop(), branchId: BRANCH_ID, ...body, active: true });
      if (method === 'DELETE') return jsonResponse({});
    }
    return jsonResponse([]);
  }) as typeof fetch;
}

beforeEach(() => { writes = []; });
afterEach(() => {
  global.fetch = originalFetch;
  useOrgContextStore.setState({ branchId: null, role: null });
  cleanup();
});

function renderPanel() {
  const qc = freshClientWithMutations();
  render(React.createElement(ConsentTemplates), { wrapper: makeWrapper(qc) });
}

describe('ConsentTemplates — list + create/edit/delete wiring', () => {
  test('lists templates from the API (bare-array contract shape)', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByText('General Dental Consent')).toBeDefined());
    expect(screen.getByText('Extraction Consent')).toBeDefined();
  });

  test('create issues POST /consent-templates with {name, body} (mutation-call assertion)', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByText('General Dental Consent')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /add template/i }));
    fireEvent.change(screen.getByLabelText(/template name/i), { target: { value: 'Implant Consent' } });
    fireEvent.change(screen.getByLabelText(/consent body/i), { target: { value: 'Implant legal text' } });
    fireEvent.click(screen.getByRole('button', { name: /^save template$/i }));

    await waitFor(() => expect(writes.filter(w => w.method === 'POST').length).toBe(1));
    const post = writes.find(w => w.method === 'POST')!;
    expect(post.url).toContain(`/dental/branches/${BRANCH_ID}/consent-templates`);
    expect(post.body.name).toBe('Implant Consent');
    expect(post.body.body).toBe('Implant legal text');
  });

  test('edit issues PATCH /consent-templates/{id} with the changed fields (mutation-call assertion)', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByText('General Dental Consent')).toBeDefined());

    // Edit the first template: change name + toggle witness signature.
    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    const nameInput = screen.getByLabelText(/template name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('General Dental Consent'); // prefilled from the row
    fireEvent.change(nameInput, { target: { value: 'General Dental Consent v2' } });
    fireEvent.click(screen.getByLabelText(/requires witness signature/i));
    fireEvent.click(screen.getByRole('button', { name: /^save template$/i }));

    await waitFor(() => expect(writes.filter(w => w.method === 'PATCH').length).toBe(1));
    const patch = writes.find(w => w.method === 'PATCH')!;
    expect(patch.url).toContain(`/dental/branches/${BRANCH_ID}/consent-templates/${TEMPLATES[0].id}`);
    expect(patch.body.name).toBe('General Dental Consent v2');
    expect(patch.body.requiresWitnessSignature).toBe(true);
  });

  test('delete issues DELETE /consent-templates/{id} (mutation-call assertion)', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByText('General Dental Consent')).toBeDefined());

    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    // Inline two-step confirm (no window.confirm) — better for shared iPads.
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    await waitFor(() => expect(writes.filter(w => w.method === 'DELETE').length).toBe(1));
    expect(writes.find(w => w.method === 'DELETE')!.url).toContain(`/consent-templates/${TEMPLATES[0].id}`);
  });

  test('empty state shows when no templates exist', async () => {
    useOrgContextStore.setState({ branchId: BRANCH_ID, role: 'dentist_owner' });
    global.fetch = (async () => jsonResponse([])) as typeof fetch;
    renderPanel();
    await waitFor(() => expect(screen.getByText(/no consent templates/i)).toBeDefined());
  });

  test('non-owner sees no write affordances (owner-only writes)', async () => {
    installFetch('staff_full');
    renderPanel();
    await waitFor(() => expect(screen.getByText('General Dental Consent')).toBeDefined());
    expect(screen.queryByRole('button', { name: /add template/i })).toBeNull();
    expect(screen.queryAllByRole('button', { name: /^delete$/i }).length).toBe(0);
  });
});
