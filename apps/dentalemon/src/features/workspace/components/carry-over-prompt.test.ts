/**
 * CarryOverPrompt — FIX-002 (Batch B) carry-over affordance.
 *
 * Placement (product-decisions.md Q2): the returning-patient / new-visit entry point.
 *
 * Mechanism (restore-dismissed): the visit-completion gate (updateDentalVisit) forbids
 * completing a visit that still has diagnosed/planned treatments, so a completed prior
 * visit never carries pending work forward via auto-discovery. The functional, FR1.11
 * path is "dismiss-to-defer → restore next visit": when a returning patient has DEFERRED
 * (dismissed) treatments from the previous visit, this prompt offers to restore them into
 * the new visit via the canonical carry-over endpoint with restoreDismissedIds.
 *
 * RED-first: these fail until carry-over-prompt.tsx + use-carry-over-treatments.ts exist.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import { CarryOverPrompt } from './carry-over-prompt';

const _toastSuccess = mock(() => {});
const _toastError = mock(() => {});
mock.module('sonner', () => ({ toast: { success: _toastSuccess, error: _toastError } }));

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

const baseProps = {
  open: true,
  visitId: 'visit-new',
  patientId: 'patient-1',
  branchId: 'branch-1',
  deferredIds: ['t-deferred-1'],
  onClose: () => {},
};

afterEach(cleanup);

describe('CarryOverPrompt — FIX-002 restore-dismissed affordance', () => {
  test('renders the carry-over affordance when the previous visit has deferred treatments', () => {
    render(React.createElement(CarryOverPrompt, baseProps), { wrapper: makeWrapper() });
    expect(screen.getByTestId('carry-over-confirm')).not.toBeNull();
  });

  test('does NOT render when there are no deferred treatments to restore', () => {
    render(
      React.createElement(CarryOverPrompt, { ...baseProps, deferredIds: [] }),
      { wrapper: makeWrapper() },
    );
    expect(screen.queryByTestId('carry-over-confirm')).toBeNull();
  });

  test('does NOT render when closed', () => {
    render(
      React.createElement(CarryOverPrompt, { ...baseProps, open: false }),
      { wrapper: makeWrapper() },
    );
    expect(screen.queryByTestId('carry-over-confirm')).toBeNull();
  });

  test('clicking "Restore" calls the carry-over endpoint with restoreDismissedIds (via SDK, not raw fetch)', async () => {
    const user = userEvent.setup();
    const urls: string[] = [];
    const bodies: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      urls.push(req instanceof Request ? req.url : String(req));
      if (req instanceof Request) { void req.clone().text().then((b) => bodies.push(b)).catch(() => {}); }
      else if (init?.body) bodies.push(String(init.body));
      return jsonResponse({
        carriedOver: [],
        restoredDismissed: [{ id: 't-deferred-1' }],
        message: 'Restored 1 deferred treatment.',
      });
    }) as unknown as typeof fetch;
    try {
      render(
        React.createElement(CarryOverPrompt, { ...baseProps, deferredIds: ['t-deferred-1', 't-deferred-2'] }),
        { wrapper: makeWrapper() },
      );
      await user.click(screen.getByTestId('carry-over-confirm'));
      await waitFor(() =>
        expect(urls.some((u) => u.includes('/carry-over') && u.includes('visit-new'))).toBe(true),
      );
      await waitFor(() =>
        expect(
          bodies.some((b) => b.includes('restoreDismissedIds') && b.includes('t-deferred-1')),
        ).toBe(true),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('ISSUE-010: pressing Escape dismisses the prompt (hand-rolled overlay a11y)', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(
      React.createElement(CarryOverPrompt, { ...baseProps, onClose }),
      { wrapper: makeWrapper() },
    );
    expect(screen.getByTestId('carry-over-prompt')).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking "Skip" closes without calling the endpoint', async () => {
    const user = userEvent.setup();
    const urls: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = mock((req: Request | string | URL) => {
      urls.push(req instanceof Request ? req.url : String(req));
      return jsonResponse({});
    }) as unknown as typeof fetch;
    try {
      const onClose = mock(() => {});
      render(
        React.createElement(CarryOverPrompt, { ...baseProps, onClose }),
        { wrapper: makeWrapper() },
      );
      await user.click(screen.getByTestId('carry-over-skip'));
      expect(onClose).toHaveBeenCalled();
      expect(urls.some((u) => u.includes('/carry-over'))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
