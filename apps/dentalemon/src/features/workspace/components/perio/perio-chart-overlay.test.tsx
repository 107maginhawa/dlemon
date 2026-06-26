/**
 * Test #6 — PerioChartOverlay bootstrap + completion states.
 *
 * Drives the SHIPPED overlay through the real usePerioChart hook against a mocked
 * fetch:
 *   - 404 → empty state with a "Start perio exam" button
 *   - draft chart → editable grid renders
 *   - completed chart → read-only (Start/Complete hidden, inputs read-only)
 *   - Complete disabled under 16 readings, enabled at ≥16
 *   - an INSUFFICIENT_READINGS completion error maps to inline copy
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { PerioChartOverlay } from './perio-chart-overlay';
import { PERIO_SITES } from './perio-types';

const VISIT_ID = 'v-1';
const PATIENT_ID = 'p-1';
const CHART_ID = 'c-1';

function makeReading(tooth: number) {
  const r: Record<string, unknown> = {
    id: `r-${tooth}`,
    chartId: CHART_ID,
    toothNumber: tooth,
    mobility: 0,
    furcation: 0,
    plaque: false,
    suppuration: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
  for (const s of PERIO_SITES) r[`depth${s}`] = 3;
  return r;
}

function makeChart(status: string, readingCount = 0) {
  return {
    id: CHART_ID,
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    branchId: 'b-1',
    examinerMemberId: 'm-1',
    status,
    summaryBopPercent: status === 'completed' ? 12 : undefined,
    summaryMeanDepth: status === 'completed' ? 3.2 : undefined,
    summaryDeepPocketCount: status === 'completed' ? 4 : undefined,
    readings: Array.from({ length: readingCount }, (_, i) => makeReading(11 + i)),
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

interface Opts {
  getStatus?: number;
  chart?: ReturnType<typeof makeChart>;
  completeStatus?: number;
  completeCode?: string;
}

function installFetch(opts: Opts) {
  const calls: Array<{ url: string; method: string }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    calls.push({ url, method });
    if (method === 'GET') {
      if ((opts.getStatus ?? 200) === 404) return new Response('nf', { status: 404 });
      return new Response(JSON.stringify(opts.chart ?? makeChart('draft')), { status: 200 });
    }
    if (url.includes('/complete')) {
      const status = opts.completeStatus ?? 200;
      if (status >= 400) {
        return new Response(JSON.stringify({ code: opts.completeCode ?? 'INSUFFICIENT_READINGS', message: 'too few' }), { status });
      }
      return new Response(JSON.stringify({ id: CHART_ID, status: 'completed', completedAt: '2026-06-02', summaryBopPercent: 12, summaryMeanDepth: 3.2, summaryDeepPocketCount: 4, stage: 'II', grade: 'B', extent: 'localized' }), { status: 200 });
    }
    return new Response(JSON.stringify(makeChart('draft')), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderOverlay(props: Partial<React.ComponentProps<typeof PerioChartOverlay>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(PerioChartOverlay, {
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        open: true,
        onClose: () => {},
        ...props,
      }),
    ),
  );
}

afterEach(cleanup);

describe('PerioChartOverlay', () => {
  test('does not render when open=false', () => {
    const f = installFetch({ getStatus: 404 });
    try {
      renderOverlay({ open: false });
      expect(screen.queryByTestId('perio-overlay')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('"Back to workspace" closes the overlay', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    const f = installFetch({ getStatus: 404 });
    try {
      renderOverlay({ onClose });
      await user.click(await screen.findByTestId('perio-back-btn'));
      expect(onClose).toHaveBeenCalled();
    } finally {
      f.restore();
    }
  });

  test('404 shows the empty state with a Start button', async () => {
    const f = installFetch({ getStatus: 404 });
    try {
      renderOverlay();
      await waitFor(() => expect(screen.getByTestId('perio-start-btn')).not.toBeNull());
      expect(screen.getByText(/No perio exam for this visit yet/i)).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('clicking Start POSTs a new chart', async () => {
    const user = userEvent.setup();
    const f = installFetch({ getStatus: 404 });
    try {
      renderOverlay();
      await waitFor(() => expect(screen.getByTestId('perio-start-btn')).not.toBeNull());
      await user.click(screen.getByTestId('perio-start-btn'));
      await waitFor(() =>
        expect(f.calls.some((c) => c.method === 'POST' && c.url.endsWith('/dental/perio-charts'))).toBe(true),
      );
    } finally {
      f.restore();
    }
  });

  test('draft chart renders the editable grid', async () => {
    const f = installFetch({ getStatus: 200, chart: makeChart('draft', 2) });
    try {
      renderOverlay();
      await waitFor(() => expect(screen.getByTestId('perio-grid')).not.toBeNull());
      expect(screen.getByTestId('perio-complete-btn')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('N5: the gate counter reads as a minimum, not a target', async () => {
    const f = installFetch({ getStatus: 200, chart: makeChart('draft', 10) });
    try {
      renderOverlay();
      await waitFor(() => expect(screen.getByTestId('perio-complete-btn')).not.toBeNull());
      // a full-mouth exam is ~28 teeth; "16/16" implied "done". The copy must
      // frame 16 as the minimum to complete.
      expect(screen.getByText(/minimum 16 to complete/i)).not.toBeNull();
      expect(screen.queryByText('16/16 teeth charted')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('Complete is disabled under 16 readings and enabled at 16', async () => {
    const f = installFetch({ getStatus: 200, chart: makeChart('draft', 10) });
    try {
      renderOverlay();
      await waitFor(() => expect(screen.getByTestId('perio-complete-btn')).not.toBeNull());
      expect((screen.getByTestId('perio-complete-btn') as HTMLButtonElement).disabled).toBe(true);
    } finally {
      f.restore();
    }
    cleanup();

    const f2 = installFetch({ getStatus: 200, chart: makeChart('draft', 16) });
    try {
      renderOverlay();
      await waitFor(() => expect(screen.getByTestId('perio-complete-btn')).not.toBeNull());
      expect((screen.getByTestId('perio-complete-btn') as HTMLButtonElement).disabled).toBe(false);
    } finally {
      f2.restore();
    }
  });

  test('completed chart is read-only (no Start/Complete, depth inputs read-only)', async () => {
    const f = installFetch({ getStatus: 200, chart: makeChart('completed', 16) });
    try {
      renderOverlay();
      await waitFor(() => expect(screen.getByTestId('perio-grid')).not.toBeNull());
      expect(screen.queryByTestId('perio-complete-btn')).toBeNull();
      expect(screen.queryByTestId('perio-start-btn')).toBeNull();
      const cell = screen.getByLabelText(/Tooth 11 mesiobuccal depth/i) as HTMLInputElement;
      expect(cell.readOnly).toBe(true);
      expect(screen.getByTestId('perio-status-badge').textContent).toContain('Completed');
    } finally {
      f.restore();
    }
  });

  test('INSUFFICIENT_READINGS completion error maps to inline copy', async () => {
    const user = userEvent.setup();
    const f = installFetch({ getStatus: 200, chart: makeChart('draft', 16), completeStatus: 422, completeCode: 'INSUFFICIENT_READINGS' });
    try {
      renderOverlay();
      await waitFor(() => expect(screen.getByTestId('perio-complete-btn')).not.toBeNull());
      await user.click(screen.getByTestId('perio-complete-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('perio-completion-error').textContent).toMatch(/at least 16 teeth/i),
      );
    } finally {
      f.restore();
    }
  });
});
