/**
 * PaymentTermsSettings — clinic-wide default payment terms (BR-048, Phase 2.1b).
 *
 * The default terms (days) feed dueDate computation at invoice issue. This panel
 * reads settings.defaultPaymentTermsDays and saves it back via the branch-settings
 * endpoint. Asserts the DOWNSTREAM effect: Save writes defaultPaymentTermsDays.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { PaymentTermsSettings } from './payment-terms-settings';

const BRANCH_ID = 'b0000000-0000-1000-8000-00000000be48';

const originalFetch = global.fetch;
let putCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

beforeEach(() => {
  putCalls = [];
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
      return jsonResponse({ branchId: BRANCH_ID, settings: { defaultPaymentTermsDays: 30 } });
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
  render(React.createElement(PaymentTermsSettings), { wrapper: makeWrapper(qc) });
}

describe('PaymentTermsSettings — clinic default terms', () => {
  test('prefills the active preset from saved settings (Net 30)', async () => {
    renderPanel();
    const net30 = await screen.findByTestId('terms-preset-30');
    await waitFor(() => expect(net30.getAttribute('aria-pressed')).toBe('true'));
  });

  test('selecting Net 60 and saving writes defaultPaymentTermsDays: 60', async () => {
    renderPanel();
    await screen.findByTestId('terms-preset-60');
    fireEvent.click(screen.getByTestId('terms-preset-60'));
    fireEvent.click(screen.getByTestId('save-payment-terms'));

    await waitFor(() => expect(putCalls.length).toBeGreaterThan(0));
    expect(putCalls[0].url).toContain(`/dental/branches/${BRANCH_ID}/settings`);
    expect(putCalls[0].body.defaultPaymentTermsDays).toBe(60);
  });

  test('Due on receipt saves 0', async () => {
    renderPanel();
    await screen.findByTestId('terms-preset-0');
    fireEvent.click(screen.getByTestId('terms-preset-0'));
    fireEvent.click(screen.getByTestId('save-payment-terms'));

    await waitFor(() => expect(putCalls.length).toBeGreaterThan(0));
    expect(putCalls[0].body.defaultPaymentTermsDays).toBe(0);
  });
});
