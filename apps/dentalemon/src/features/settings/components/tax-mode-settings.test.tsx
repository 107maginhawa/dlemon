/**
 * TaxModeSettings — clinic VAT registration mode (BR-054, PH).
 *
 * Reads settings.taxMode and saves it back via the branch-settings endpoint.
 * Default is non-VAT. Asserts the DOWNSTREAM effect: Save writes taxMode.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { TaxModeSettings } from './tax-mode-settings';

const BRANCH_ID = 'b0000000-0000-1000-8000-00000000be54';

const originalFetch = global.fetch;
let putCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
let getSettings: Record<string, unknown> = {};

beforeEach(() => {
  putCalls = [];
  getSettings = {};
  useOrgContextStore.setState({ branchId: BRANCH_ID });
  global.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = req ? req.url : String(input);
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'PUT' && url.includes('/settings')) {
      let body: Record<string, unknown> = {};
      if (init?.body) body = JSON.parse(init.body as string);
      else if (req) { try { body = await req.clone().json(); } catch { /* none */ } }
      putCalls.push({ url, body });
      return jsonResponse({ branchId: BRANCH_ID, settings: body });
    }
    if (method === 'GET' && url.includes('/settings')) {
      return jsonResponse({ branchId: BRANCH_ID, settings: getSettings });
    }
    return jsonResponse({ branchId: BRANCH_ID, settings: {} });
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  useOrgContextStore.setState({ branchId: null });
  cleanup();
});

function renderPanel() {
  const qc = freshClientWithMutations();
  render(React.createElement(TaxModeSettings), { wrapper: makeWrapper(qc) });
}

describe('TaxModeSettings — clinic VAT mode (BR-054)', () => {
  test('defaults to Non-VAT when no setting is saved', async () => {
    renderPanel();
    const nonVat = await screen.findByTestId('tax-mode-non_vat');
    await waitFor(() => expect(nonVat.getAttribute('aria-pressed')).toBe('true'));
  });

  test('prefills VAT-registered from saved settings', async () => {
    getSettings = { taxMode: 'vat_registered' };
    renderPanel();
    const vat = await screen.findByTestId('tax-mode-vat_registered');
    await waitFor(() => expect(vat.getAttribute('aria-pressed')).toBe('true'));
  });

  test('selecting VAT-registered and saving writes taxMode: vat_registered', async () => {
    renderPanel();
    await screen.findByTestId('tax-mode-vat_registered');
    fireEvent.click(screen.getByTestId('tax-mode-vat_registered'));
    fireEvent.click(screen.getByTestId('save-tax-mode'));

    await waitFor(() => expect(putCalls.length).toBeGreaterThan(0));
    expect(putCalls[0].url).toContain(`/dental/branches/${BRANCH_ID}/settings`);
    expect(putCalls[0].body.taxMode).toBe('vat_registered');
  });

  test('switching back to Non-VAT saves taxMode: non_vat', async () => {
    getSettings = { taxMode: 'vat_registered' };
    renderPanel();
    await screen.findByTestId('tax-mode-non_vat');
    fireEvent.click(screen.getByTestId('tax-mode-non_vat'));
    fireEvent.click(screen.getByTestId('save-tax-mode'));

    await waitFor(() => expect(putCalls.length).toBeGreaterThan(0));
    expect(putCalls[0].body.taxMode).toBe('non_vat');
  });
});
