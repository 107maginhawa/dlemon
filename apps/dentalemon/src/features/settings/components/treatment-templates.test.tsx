/**
 * TreatmentTemplates panel tests — dental-visit GAP-2 / decision #13 (WIRE FE).
 *
 * The treatment-template CRUD backend exists (FR1.8) but had zero UI; the demo
 * seeded templates the clinic could not create or manage. These tests pin the
 * real wiring of a new settings panel to the contract-correct endpoints:
 *   GET    /dental/treatment-templates?branchId=...  -> { templates: [...] } envelope
 *   POST   /dental/treatment-templates               -> created template (201)
 *   PATCH  /dental/treatment-templates/{id}           -> updated template
 *   DELETE /dental/treatment-templates/{id}           -> { success: true } (soft delete)
 *
 * The create body carries `items[]` (TemplateTreatmentItem[]) with priceCents in
 * cents + the branchId from the org-context store. Mutation-call assertions (not
 * helper-only) prove the wire shape. global.fetch mock per repo convention.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { TreatmentTemplates } from './treatment-templates';

const BRANCH_ID = 'b0000000-0000-4000-8000-0000000c0n5t';
const TEMPLATES = [
  {
    id: 't1000000-0000-4000-8000-000000000001',
    branchId: BRANCH_ID,
    name: 'New Patient Exam',
    description: 'Standard comprehensive exam',
    items: [
      { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', priceCents: 150000 },
      { cdtCode: 'D0210', description: 'Full-mouth X-ray series', priceCents: 250000 },
    ],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 't1000000-0000-4000-8000-000000000002',
    branchId: BRANCH_ID,
    name: 'Crown Workflow',
    description: 'RCT + crown',
    items: [{ cdtCode: 'D2740', description: 'Crown — porcelain', priceCents: 1800000 }],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const originalFetch = global.fetch;
let writes: Array<{ method: string; url: string; body: any }> = [];

function installFetch(role: 'dentist_owner' | 'dentist_associate' | 'staff_full' = 'dentist_owner') {
  useOrgContextStore.setState({ branchId: BRANCH_ID, role });
  global.fetch = (async (input: any, init?: any) => {
    const req = typeof input === 'string' ? null : input;
    const url = req ? req.url : input;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (url.includes('/treatment-templates')) {
      if (method === 'GET') return jsonResponse({ templates: TEMPLATES });
      let body: any = {};
      if (init?.body) body = JSON.parse(init.body);
      else if (req) { try { body = await req.clone().json(); } catch { /* none */ } }
      writes.push({ method, url, body });
      if (method === 'POST') return jsonResponse({ id: 't-new', active: true, ...body }, 201);
      if (method === 'PATCH') return jsonResponse({ id: url.split('/').pop(), active: true, ...body });
      if (method === 'DELETE') return jsonResponse({ success: true });
    }
    return jsonResponse({ templates: [] });
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
  render(React.createElement(TreatmentTemplates), { wrapper: makeWrapper(qc) });
}

describe('TreatmentTemplates — list + create/edit/delete wiring', () => {
  test('lists templates from the { templates: [...] } envelope', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByText('New Patient Exam')).toBeDefined());
    expect(screen.getByText('Crown Workflow')).toBeDefined();
  });

  test('create issues POST /treatment-templates with {name, branchId, items[]} in cents', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByText('New Patient Exam')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /add template/i }));
    fireEvent.change(screen.getByLabelText(/template name/i), { target: { value: 'Extraction Pack' } });
    // First item row is present by default; fill it.
    fireEvent.change(screen.getByLabelText(/item 1 cdt code/i), { target: { value: 'D7140' } });
    fireEvent.change(screen.getByLabelText(/item 1 description/i), { target: { value: 'Extraction, erupted tooth' } });
    fireEvent.change(screen.getByLabelText(/item 1 price/i), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: /^save template$/i }));

    await waitFor(() => expect(writes.filter(w => w.method === 'POST').length).toBe(1));
    const post = writes.find(w => w.method === 'POST')!;
    expect(post.url).toContain('/dental/treatment-templates');
    expect(post.body.name).toBe('Extraction Pack');
    expect(post.body.branchId).toBe(BRANCH_ID);
    expect(post.body.items).toHaveLength(1);
    expect(post.body.items[0].cdtCode).toBe('D7140');
    expect(post.body.items[0].description).toBe('Extraction, erupted tooth');
    // 1200 pesos entered -> 120000 cents on the wire (the unit trap).
    expect(post.body.items[0].priceCents).toBe(120000);
  });

  test('add/remove item rows adjusts the create payload', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByText('New Patient Exam')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /add template/i }));
    fireEvent.change(screen.getByLabelText(/template name/i), { target: { value: 'Two Items' } });
    fireEvent.change(screen.getByLabelText(/item 1 cdt code/i), { target: { value: 'D1110' } });
    fireEvent.change(screen.getByLabelText(/item 1 description/i), { target: { value: 'Prophy' } });
    fireEvent.change(screen.getByLabelText(/item 1 price/i), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    fireEvent.change(screen.getByLabelText(/item 2 cdt code/i), { target: { value: 'D1206' } });
    fireEvent.change(screen.getByLabelText(/item 2 description/i), { target: { value: 'Fluoride' } });
    fireEvent.change(screen.getByLabelText(/item 2 price/i), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: /^save template$/i }));

    await waitFor(() => expect(writes.filter(w => w.method === 'POST').length).toBe(1));
    const post = writes.find(w => w.method === 'POST')!;
    expect(post.body.items).toHaveLength(2);
    expect(post.body.items[1].cdtCode).toBe('D1206');
    expect(post.body.items[1].priceCents).toBe(80000);
  });

  test('blocks save with no name or no valid item (no POST fires)', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByText('New Patient Exam')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /add template/i }));
    // Save with empty name + empty item.
    fireEvent.click(screen.getByRole('button', { name: /^save template$/i }));
    expect(screen.getByText(/template name is required/i)).toBeDefined();
    expect(writes.filter(w => w.method === 'POST').length).toBe(0);
  });

  test('delete issues DELETE /treatment-templates/{id} (mutation-call assertion)', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByText('New Patient Exam')).toBeDefined());

    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    await waitFor(() => expect(writes.filter(w => w.method === 'DELETE').length).toBe(1));
    expect(writes.find(w => w.method === 'DELETE')!.url).toContain(`/treatment-templates/${TEMPLATES[0].id}`);
  });

  test('empty state shows when no templates exist', async () => {
    useOrgContextStore.setState({ branchId: BRANCH_ID, role: 'dentist_owner' });
    global.fetch = (async () => jsonResponse({ templates: [] })) as typeof fetch;
    renderPanel();
    await waitFor(() => expect(screen.getByText(/no treatment templates/i)).toBeDefined());
  });

  test('non-owner sees no write affordances (owner-only management)', async () => {
    installFetch('dentist_associate');
    renderPanel();
    await waitFor(() => expect(screen.getByText('New Patient Exam')).toBeDefined());
    expect(screen.queryByRole('button', { name: /add template/i })).toBeNull();
    expect(screen.queryAllByRole('button', { name: /^delete$/i }).length).toBe(0);
    expect(screen.queryAllByRole('button', { name: /^edit$/i }).length).toBe(0);
  });
});
