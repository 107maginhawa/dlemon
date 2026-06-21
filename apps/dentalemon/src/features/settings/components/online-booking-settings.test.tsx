/**
 * OnlineBookingSettings — PP-4 (ISSUE-038) staff online-booking config.
 *
 * Reads settings.onlineBooking and saves it back via the branch-settings endpoint.
 * Default is disabled. Asserts the DOWNSTREAM effect: Save writes the onlineBooking
 * block (with enabled), which is the flag the public /book page gates on.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { OnlineBookingSettings, defaultOnlineBookingForm } from './online-booking-settings';

const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000b4';

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
  render(React.createElement(OnlineBookingSettings), { wrapper: makeWrapper(qc) });
}

describe('defaultOnlineBookingForm', () => {
  test('disabled by default with checkup+recall', () => {
    const d = defaultOnlineBookingForm();
    expect(d.enabled).toBe(false);
    expect(d.bookableVisitTypes).toEqual(['checkup', 'recall']);
  });
});

describe('OnlineBookingSettings — staff config (PP-4)', () => {
  test('defaults to Disabled when no setting is saved', async () => {
    renderPanel();
    const toggle = await screen.findByTestId('online-booking-enabled');
    await waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('false'));
    expect(toggle.textContent).toBe('Disabled');
  });

  test('prefills Enabled from saved settings', async () => {
    getSettings = { onlineBooking: { enabled: true, leadTimeMinutes: 240 } };
    renderPanel();
    const toggle = await screen.findByTestId('online-booking-enabled');
    await waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('true'));
    expect((screen.getByTestId('online-booking-lead') as HTMLInputElement).value).toBe('240');
  });

  test('enabling + saving writes onlineBooking.enabled: true', async () => {
    renderPanel();
    await screen.findByTestId('online-booking-enabled');
    fireEvent.click(screen.getByTestId('online-booking-enabled'));
    fireEvent.click(screen.getByTestId('save-online-booking'));

    await waitFor(() => expect(putCalls.length).toBeGreaterThan(0));
    expect(putCalls[0]!.url).toContain(`/dental/branches/${BRANCH_ID}/settings`);
    const ob = putCalls[0]!.body.onlineBooking as Record<string, unknown>;
    expect(ob).toBeDefined();
    expect(ob.enabled).toBe(true);
    expect(ob.bookableVisitTypes).toEqual(['checkup', 'recall']);
    expect(ob.leadTimeMinutes).toBe(120);
  });

  test('toggling a visit type persists in the saved body', async () => {
    renderPanel();
    await screen.findByTestId('online-booking-type-hygiene');
    fireEvent.click(screen.getByTestId('online-booking-type-hygiene')); // add hygiene
    fireEvent.click(screen.getByTestId('online-booking-type-recall')); // remove recall
    fireEvent.click(screen.getByTestId('save-online-booking'));

    await waitFor(() => expect(putCalls.length).toBeGreaterThan(0));
    const ob = putCalls[0]!.body.onlineBooking as Record<string, unknown>;
    expect(ob.bookableVisitTypes).toContain('hygiene');
    expect(ob.bookableVisitTypes).not.toContain('recall');
  });
});
