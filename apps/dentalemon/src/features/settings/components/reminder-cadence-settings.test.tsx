/**
 * ReminderCadenceSettings — dunning reminder cadence (BR-050, Phase 2.3b).
 *
 * Clinic-configurable days-past-due offsets at which the daily dunning sweep
 * sends payment reminders. Reads settings.billingReminderOffsetDays and saves it
 * back via the branch-settings endpoint. Asserts the DOWNSTREAM effect: Save
 * writes a sorted, deduped offset array.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { ReminderCadenceSettings } from './reminder-cadence-settings';

const BRANCH_ID = 'b0000000-0000-1000-8000-00000000be50';

const originalFetch = global.fetch;
let putCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
let savedOffsets: number[] | undefined;

beforeEach(() => {
  putCalls = [];
  savedOffsets = [7, 14]; // pre-saved cadence
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
      return jsonResponse({ branchId: BRANCH_ID, settings: { billingReminderOffsetDays: savedOffsets } });
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
  render(React.createElement(ReminderCadenceSettings), { wrapper: makeWrapper(qc) });
}

describe('ReminderCadenceSettings — dunning cadence', () => {
  test('prefills selected offsets from saved settings (7 and 14)', async () => {
    renderPanel();
    const chip7 = await screen.findByTestId('offset-chip-7');
    await waitFor(() => expect(chip7.getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByTestId('offset-chip-14').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('offset-chip-3').getAttribute('aria-pressed')).toBe('false');
  });

  test('toggling offset 3 on and saving writes a sorted [3,7,14]', async () => {
    renderPanel();
    await screen.findByTestId('offset-chip-3');
    fireEvent.click(screen.getByTestId('offset-chip-3'));
    fireEvent.click(screen.getByTestId('save-reminder-cadence'));

    await waitFor(() => expect(putCalls.length).toBeGreaterThan(0));
    expect(putCalls[0].url).toContain(`/dental/branches/${BRANCH_ID}/settings`);
    expect(putCalls[0].body.billingReminderOffsetDays).toEqual([3, 7, 14]);
  });

  test('deselecting all offsets saves an empty array (reminders off)', async () => {
    renderPanel();
    await screen.findByTestId('offset-chip-7');
    fireEvent.click(screen.getByTestId('offset-chip-7'));
    fireEvent.click(screen.getByTestId('offset-chip-14'));
    fireEvent.click(screen.getByTestId('save-reminder-cadence'));

    await waitFor(() => expect(putCalls.length).toBeGreaterThan(0));
    expect(putCalls[0].body.billingReminderOffsetDays).toEqual([]);
  });
});
