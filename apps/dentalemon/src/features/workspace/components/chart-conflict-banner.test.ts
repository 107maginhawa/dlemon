/**
 * ChartConflictBanner — P0-A offline conflict visibility & resolution (FE).
 *
 * The real banner queries GET /dental/visits/chart-conflicts/:patientId and
 * renders a resolution panel. Resolving fires POST .../chart/resolve-conflict.
 * Written RED before the component exists.
 *
 * Coherence guard: the headline count must equal the number of rejected-tooth
 * rows actually rendered (the "summary computed from a different source than the
 * body" bug class).
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase, assertCountMatchesItems } from '@/test-utils';

mock.module('sonner', () => ({ toast: { error: mock(() => {}), success: mock(() => {}) } }));

import { ChartConflictBanner } from './chart-conflict-banner';

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

const ONE_CONFLICT = [{
  chartId: 'chart-1',
  visitId: 'visit-1',
  patientId: 'pat-1',
  reason: 'stale_clock_rejected',
  rejectedTeeth: [{ toothNumber: 14, state: 'caries', clock: 3 }],
  detectedAt: '2026-06-10T00:00:00Z',
}];

/** Mock fetch: GET conflicts returns `conflicts`; POST resolve returns synced + records the call. */
function installFetch(conflicts: unknown[]) {
  const calls: Array<{ method: string; url: string; body: any }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const rawBody = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ method, url, body: rawBody ? JSON.parse(rawBody) : undefined });
    if (url.includes('/resolve-conflict')) {
      return new Response(JSON.stringify({ id: 'chart-1', syncStatus: 'synced' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // GET chart-conflicts
    return new Response(JSON.stringify(conflicts), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

afterEach(cleanup);

describe('ChartConflictBanner', () => {
  test('renders nothing when there are no conflicts', async () => {
    const { restore } = installFetch([]);
    try {
      render(React.createElement(ChartConflictBanner, { patientId: 'pat-1' }), { wrapper: makeWrapper() });
      // give the query a tick; the banner must stay absent
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByTestId('chart-conflict-banner')).toBeNull();
    } finally { restore(); }
  });

  test('shows the banner with a headline count that matches the rejected-tooth rows', async () => {
    const { restore } = installFetch(ONE_CONFLICT);
    try {
      render(React.createElement(ChartConflictBanner, { patientId: 'pat-1' }), { wrapper: makeWrapper() });
      const banner = await screen.findByTestId('chart-conflict-banner');
      expect(banner).toBeTruthy();

      // the rejected tooth + state is shown
      const rows = await screen.findAllByTestId('conflict-tooth-row');
      expect(rows.length).toBe(1);
      expect(banner.textContent).toContain('14');
      expect(banner.textContent?.toLowerCase()).toContain('caries');

      // coherence: the headline count equals the rendered rejected-tooth rows
      const count = Number(screen.getByTestId('chart-conflict-count').textContent);
      assertCountMatchesItems({ count, itemCount: rows.length, label: 'conflict count' });
    } finally { restore(); }
  });

  test('Accept fires POST resolve-conflict with { resolution: "accept" }', async () => {
    const { calls, restore } = installFetch(ONE_CONFLICT);
    try {
      render(React.createElement(ChartConflictBanner, { patientId: 'pat-1' }), { wrapper: makeWrapper() });
      const acceptBtn = await screen.findByTestId('conflict-accept-visit-1');
      await userEvent.click(acceptBtn);
      await waitFor(() => {
        const post = calls.find((c) => c.method === 'POST' && c.url.includes('/resolve-conflict'));
        expect(post).toBeTruthy();
        expect(post!.url).toContain('/dental/visits/visit-1/chart/resolve-conflict');
        expect(post!.body.resolution).toBe('accept');
      });
    } finally { restore(); }
  });

  test('Dismiss requires a reason: confirm is disabled until a reason is typed, then sends it', async () => {
    const { calls, restore } = installFetch(ONE_CONFLICT);
    try {
      render(React.createElement(ChartConflictBanner, { patientId: 'pat-1' }), { wrapper: makeWrapper() });
      const dismissBtn = await screen.findByTestId('conflict-dismiss-visit-1');
      await userEvent.click(dismissBtn);

      const confirm = await screen.findByTestId('conflict-dismiss-confirm-visit-1');
      expect((confirm as HTMLButtonElement).disabled).toBe(true);

      const reason = await screen.findByTestId('conflict-reason-visit-1');
      await userEvent.type(reason, 'Duplicate offline edit; crown is correct.');
      expect((confirm as HTMLButtonElement).disabled).toBe(false);

      await userEvent.click(confirm);
      await waitFor(() => {
        const post = calls.find((c) => c.method === 'POST' && c.url.includes('/resolve-conflict'));
        expect(post).toBeTruthy();
        expect(post!.body.resolution).toBe('dismiss');
        expect(post!.body.reason).toContain('Duplicate offline edit');
      });
    } finally { restore(); }
  });
});
