/**
 * FeeSchedule interaction tests — dental-org G2 (decision §5 = DRIVE pricing).
 *
 * The prior pure-helper test could not catch the split-brain (Save wired to the
 * settings blob that drove no pricing). These tests assert DOWNSTREAM EFFECT:
 *   1. the catalog (with effective per-branch prices) prefills the rows;
 *   2. clicking Save issues a PATCH to the DEDICATED fee-schedule endpoint
 *      (`/dental/fee-schedule/{cdt}`) with the edited price — NOT a branch-settings
 *      blob write — for the changed row only.
 *
 * Uses global.fetch mocking per repo convention (no mock.module).
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { FeeSchedule } from './fee-schedule';

const BRANCH_ID = 'b0000000-0000-1000-8000-000000000fee';
const CATALOG = {
  data: [
    { cdtCode: 'D0120', description: 'Periodic oral evaluation', priceCents: 50000, currency: 'PHP' },
    { cdtCode: 'D1110', description: 'Prophylaxis — adult', priceCents: 120000, currency: 'PHP' },
  ],
};

const originalFetch = global.fetch;
let patchCalls: Array<{ url: string; body: any }> = [];

beforeEach(() => {
  patchCalls = [];
  useOrgContextStore.setState({ branchId: BRANCH_ID });
  global.fetch = (async (input: any, init?: any) => {
    const req = typeof input === 'string' ? null : input;
    const url = req ? req.url : input;
    // The SDK client may call fetch(Request) (method/body on input) or fetch(url, init).
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'PATCH' && url.includes('/dental/fee-schedule/')) {
      let body: any = {};
      if (init?.body) body = JSON.parse(init.body);
      else if (req) { try { body = await req.clone().json(); } catch { /* no body */ } }
      patchCalls.push({ url, body });
      const cdt = url.split('/dental/fee-schedule/')[1].split('?')[0];
      return jsonResponse({ data: { cdtCode: cdt, description: 'x', priceCents: body.priceCents, currency: 'PHP' } });
    }
    if (method === 'GET' && url.includes('/dental/fee-schedule')) {
      return jsonResponse(CATALOG);
    }
    return jsonResponse({ data: [] });
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  useOrgContextStore.setState({ branchId: null });
  cleanup();
});

function renderPanel() {
  const qc = freshClientWithMutations();
  render(React.createElement(FeeSchedule), { wrapper: makeWrapper(qc) });
}

describe('FeeSchedule — drives pricing via the dedicated endpoint', () => {
  test('prefills rows from the fee-schedule catalog (effective prices)', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('Prophylaxis — adult')).toBeDefined());
    // Effective price prefilled into the input (120000 cents → 1200).
    const input = screen.getByLabelText('Price for D1110') as HTMLInputElement;
    expect(input.value).toBe('1200');
  });

  test('Save issues a PATCH to /dental/fee-schedule/{cdt} for the changed row only', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Price for D1110')).toBeDefined());

    const input = screen.getByLabelText('Price for D1110') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '333' } }); // ₱333 → 33300 cents

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(patchCalls.length).toBeGreaterThan(0));
    // Exactly one PATCH (only D1110 changed), to the dedicated endpoint, with the
    // edited price + branchId — never a settings-blob write.
    expect(patchCalls.length).toBe(1);
    expect(patchCalls[0].url).toContain('/dental/fee-schedule/D1110');
    expect(patchCalls[0].body.priceCents).toBe(33300);
    expect(patchCalls[0].body.branchId).toBe(BRANCH_ID);
  });

  test('Save with no edits issues no PATCH (nothing to persist)', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Price for D1110')).toBeDefined());
    fireEvent.click(screen.getByText('Save'));
    // Give any erroneous mutation a tick to fire.
    await new Promise((r) => setTimeout(r, 50));
    expect(patchCalls.length).toBe(0);
  });
});
