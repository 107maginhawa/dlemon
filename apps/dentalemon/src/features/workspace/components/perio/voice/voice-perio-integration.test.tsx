/**
 * Tier 3 (integration) — voice wired into the SHIPPED PerioChartOverlay.
 *
 * Injects a FakeSpeechProvider + voiceEnabled into the real overlay (which uses
 * the real usePerioChart + useVoicePerio against a mocked fetch) and asserts:
 *   - the voice controls render only when the flag/capability allow + a draft chart,
 *   - toggling on starts the provider and a spoken depth advances the grid cursor
 *     (data-perio-active moves) and PUTs the tooth on "next tooth",
 *   - a low-confidence value raises the confirmation prompt instead of writing.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { PerioChartOverlay } from '../perio-chart-overlay';
import { FakeSpeechProvider } from './speech-provider';
import { PERIO_SITES } from '../perio-types';

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
    readings: Array.from({ length: readingCount }, (_, i) => makeReading(11 + i)),
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function installFetch() {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    let body: unknown;
    try {
      body = init?.body ? JSON.parse(init.body as string) : undefined;
    } catch {
      /* ignore */
    }
    calls.push({ url, method, body });
    if (method === 'GET') return new Response(JSON.stringify(makeChart('draft', 2)), { status: 200 });
    if (url.includes('/readings/')) return new Response(JSON.stringify(makeReading(18)), { status: 200 });
    return new Response(JSON.stringify(makeChart('draft', 2)), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderOverlay(provider: FakeSpeechProvider) {
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
        speechProvider: provider,
        voiceEnabled: true,
      }),
    ),
  );
}

afterEach(cleanup);

describe('PerioChartOverlay — voice integration', () => {
  test('voice controls render for a draft chart when enabled + provider injected', async () => {
    const f = installFetch();
    try {
      renderOverlay(new FakeSpeechProvider());
      await waitFor(() => expect(screen.getByTestId('voice-perio-controls')).not.toBeNull());
      expect(screen.getByTestId('voice-mic-toggle')).not.toBeNull();
      expect(screen.getByTestId('voice-mic-state')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('toggling on + a spoken depth moves the grid cursor (data-perio-active)', async () => {
    const user = userEvent.setup();
    const provider = new FakeSpeechProvider();
    const f = installFetch();
    try {
      renderOverlay(provider);
      await waitFor(() => expect(screen.getByTestId('voice-mic-toggle')).not.toBeNull());
      await user.click(screen.getByTestId('voice-mic-toggle'));
      expect(provider.isListening).toBe(true);

      act(() => provider.emit('three', 1, true));
      // cursor advanced from 18 BM → 18 BC; the BC depth cell is now active.
      await waitFor(() => {
        const active = document.querySelector('[data-perio-active="true"]');
        expect(active?.getAttribute('data-perio-site')).toBe('BC');
        expect(active?.getAttribute('data-perio-tooth')).toBe('18');
      });
    } finally {
      f.restore();
    }
  });

  test('a low-confidence depth raises the confirmation prompt, no write', async () => {
    const user = userEvent.setup();
    const provider = new FakeSpeechProvider();
    const f = installFetch();
    try {
      renderOverlay(provider);
      await waitFor(() => expect(screen.getByTestId('voice-mic-toggle')).not.toBeNull());
      await user.click(screen.getByTestId('voice-mic-toggle'));
      act(() => provider.emit('three', 0.2, true));
      await waitFor(() => expect(screen.getByTestId('voice-pending-confirm')).not.toBeNull());
      expect(f.calls.some((c) => c.method === 'PUT')).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('walking a tooth then "next" PUTs a single coalesced reading', async () => {
    const user = userEvent.setup();
    const provider = new FakeSpeechProvider();
    const f = installFetch();
    try {
      renderOverlay(provider);
      await waitFor(() => expect(screen.getByTestId('voice-mic-toggle')).not.toBeNull());
      await user.click(screen.getByTestId('voice-mic-toggle'));
      act(() => provider.emit('three two three', 1, true)); // BM BC BD
      act(() => provider.emit('two two two', 1, true)); // LM LC LD
      act(() => provider.emit('next tooth', 1, true)); // flush tooth 18
      await waitFor(() => {
        const puts = f.calls.filter((c) => c.method === 'PUT' && c.url.includes('/readings/18'));
        expect(puts.length).toBe(1);
      });
    } finally {
      f.restore();
    }
  });
});
