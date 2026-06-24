/**
 * OcclusionScreeningSheet component tests (PP-7 sub-slice 3 / ISSUE-044)
 *
 * Renders the shipped OcclusionScreeningSheet (driven by the real
 * useOcclusionScreenings hook) against a mocked fetch:
 *   - lists screenings from GET (paginated {data,pagination} envelope)
 *   - the "New Screening" form submits a POST with the entered clinical fields
 *   - empty + error states render
 *
 * Occlusion screening is create + list only (no HTTP PATCH/single-GET exposed),
 * so there are no FSM/transition assertions.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { OcclusionScreeningSheet } from './occlusion-screening-sheet';
import type { OcclusionScreening } from '../hooks/use-occlusion-screenings';

const PATIENT_ID = 'p-1';

function makeScreening(overrides: Partial<OcclusionScreening> = {}): OcclusionScreening {
  return {
    id: 'o-1',
    version: 1,
    patientId: PATIENT_ID,
    visitId: null,
    angleClass: 'class_i',
    overbiteMm: null,
    overjetMm: null,
    crossbite: false,
    crowding: false,
    spacing: false,
    midlineDeviation: null,
    notes: null,
    createdAt: '2026-05-01T00:00:00.000Z' as unknown as Date,
    updatedAt: '2026-05-01T00:00:00.000Z' as unknown as Date,
    ...overrides,
  };
}

function installFetch(list: OcclusionScreening[] = []) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    if (method === 'GET') {
      return new Response(
        JSON.stringify({ data: list, pagination: { offset: 0, limit: 25, count: list.length, totalCount: list.length, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify(makeScreening({ id: 'o-new' })), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderSheet(props: Partial<React.ComponentProps<typeof OcclusionScreeningSheet>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(OcclusionScreeningSheet, {
        patientId: PATIENT_ID,
        open: true,
        onClose: () => {},
        ...props,
      }),
    ),
  );
}

afterEach(cleanup);

describe('OcclusionScreeningSheet — shipped component', () => {
  test('does not render when open=false', () => {
    const f = installFetch();
    try {
      renderSheet({ open: false });
      expect(screen.queryByTestId('occlusion-screening-sheet')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('renders the screening list returned by GET (paginated envelope)', async () => {
    const f = installFetch([makeScreening({ angleClass: 'class_iii', overjetMm: 2 })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText('Class III')).not.toBeNull());
      expect(f.calls.some(c => c.method === 'GET' && c.url.includes(`/patients/${PATIENT_ID}/occlusion-screenings`))).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('shows empty state when there are no screenings', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No occlusion screenings/i)).not.toBeNull());
    } finally {
      f.restore();
    }
  });

  test('#2: a screening row shows labeled metrics (overjet/overbite/midline/notes)', async () => {
    const f = installFetch([
      makeScreening({
        angleClass: 'class_ii_div1',
        overjetMm: 3,
        overbiteMm: 2,
        midlineDeviation: '2mm to the left',
        crossbite: false,
        crowding: false,
        spacing: false,
        notes: 'Monitor at recall',
      }),
    ]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText('Class II div 1')).not.toBeNull());
      expect(screen.getByText('Overjet')).not.toBeNull();
      expect(screen.getByText('3 mm')).not.toBeNull();
      expect(screen.getByText('Overbite')).not.toBeNull();
      expect(screen.getByText('Midline')).not.toBeNull();
      expect(screen.getByText('2mm to the left')).not.toBeNull();
      expect(screen.getByText('Notes')).not.toBeNull();
      expect(screen.getByText('Monitor at recall')).not.toBeNull();
      // no crossbite/crowding/spacing → Findings reads "None"
      expect(screen.getByText('None')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('renders as a dialog with its testid preserved through the drawer conversion', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByTestId('occlusion-screening-sheet')).not.toBeNull());
      expect(screen.getByRole('dialog')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('"Back to workspace" closes the modal', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    const f = installFetch([]);
    try {
      renderSheet({ onClose });
      await user.click(await screen.findByTestId('occlusion-back-btn'));
      expect(onClose).toHaveBeenCalled();
    } finally {
      f.restore();
    }
  });

  test('L6: empty state hosts a primary "New screening" affordance that opens the form', async () => {
    const user = userEvent.setup();
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No occlusion screenings/i)).not.toBeNull());
      await user.click(screen.getByTestId('occlusion-empty-new-btn'));
      expect(screen.getByLabelText('Angle class')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('submits a POST with the entered clinical fields from the new-screening form', async () => {
    const user = userEvent.setup();
    const f = installFetch([]);
    try {
      renderSheet();
      await user.click(screen.getByRole('button', { name: /new screening/i }));

      await user.selectOptions(screen.getByLabelText('Angle class'), 'Class II div 1');
      await user.type(screen.getByLabelText(/Overjet/i), '5');
      await user.click(screen.getByLabelText('Crossbite'));

      await user.click(screen.getByRole('button', { name: /save screening/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/occlusion-screenings'))).toBe(true),
      );
      const post = f.calls.find(c => c.method === 'POST' && c.url.includes('/occlusion-screenings'))!;
      expect((post.body as { angleClass: string }).angleClass).toBe('class_ii_div1');
      expect((post.body as { overjetMm: number }).overjetMm).toBe(5);
      expect((post.body as { crossbite: boolean }).crossbite).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('shows an error state when the screenings fetch fails', async () => {
    const original = global.fetch;
    global.fetch = mock(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/Couldn’t load occlusion screenings/i)).not.toBeNull());
    } finally {
      global.fetch = original;
    }
  });

  test('4: renders skeleton rows (occlusion-loading) while the fetch is in flight', () => {
    const original = global.fetch;
    global.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    try {
      renderSheet();
      const loading = screen.getByTestId('occlusion-loading');
      expect(loading).not.toBeNull();
      expect(screen.queryByText(/Loading screenings/i)).toBeNull();
      expect(loading.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(2);
    } finally {
      global.fetch = original;
    }
  });
});
