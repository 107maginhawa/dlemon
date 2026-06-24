/**
 * RecallsSheet component tests
 *
 * Renders the SHIPPED RecallsSheet (driven by the real useRecalls TanStack-Query
 * hook) and exercises its interaction wiring end-to-end against a mocked fetch:
 *   - lists recalls returned by GET /recalls and renders FSM transition buttons
 *   - the "New Recall" form submits a POST /recalls with the entered fields
 *   - a transition button fires PATCH /recalls/:id with the next status
 *   - empty + error states render
 *
 * No re-declared component logic — the assertions go through the component +
 * hook + fetch, matching the real route shapes in use-recalls.ts.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { RecallsSheet } from './recalls-sheet';
import type { DentalRecall } from '../hooks/use-recalls';

const PATIENT_ID = 'p-1';

function makeRecall(overrides: Partial<DentalRecall> = {}): DentalRecall {
  return {
    id: 'r-1',
    patientId: PATIENT_ID,
    type: 'cleaning',
    status: 'pending',
    dueDate: '2026-07-01T00:00:00.000Z',
    notes: undefined,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Mock fetch routed by method: GET → the supplied recall list; POST/PATCH →
 * echo a recall. Every call is recorded for assertion.
 */
function installFetch(list: DentalRecall[] = []) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    if (method === 'GET') {
      return new Response(JSON.stringify({ data: list }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(makeRecall({ id: 'r-new', status: 'sent' })), {
      status: method === 'POST' ? 201 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderSheet(props: Partial<React.ComponentProps<typeof RecallsSheet>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(RecallsSheet, {
        patientId: PATIENT_ID,
        open: true,
        onClose: () => {},
        ...props,
      }),
    ),
  );
}

afterEach(cleanup);

describe('RecallsSheet — shipped component', () => {
  test('does not render when open=false', () => {
    const f = installFetch();
    try {
      renderSheet({ open: false });
      expect(screen.queryByTestId('recalls-sheet')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('renders the recall list returned by GET with a transition button', async () => {
    const f = installFetch([makeRecall({ type: 'checkup', status: 'pending' })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText('Check-up')).not.toBeNull());
      // pending → can be marked Sent
      expect(screen.getByRole('button', { name: 'Mark Sent' })).not.toBeNull();
      expect(f.calls.some(c => c.method === 'GET' && c.url.includes(`/patients/${PATIENT_ID}/recalls`))).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('shows empty state when there are no recalls', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No recalls yet/i)).not.toBeNull());
    } finally {
      f.restore();
    }
  });

  test('renders as a dialog (role) with its testid preserved through the drawer conversion', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByTestId('recalls-sheet')).not.toBeNull());
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
      await user.click(await screen.findByTestId('recalls-back-btn'));
      expect(onClose).toHaveBeenCalled();
    } finally {
      f.restore();
    }
  });

  test('L6: empty state hosts a primary "New recall" affordance that opens the form', async () => {
    const user = userEvent.setup();
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No recalls yet/i)).not.toBeNull());
      await user.click(screen.getByTestId('recalls-empty-new-btn'));
      expect(screen.getByLabelText('Due Date')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('submits a POST /recalls with the entered fields from the new-recall form', async () => {
    const user = userEvent.setup();
    const f = installFetch([]);
    try {
      renderSheet();
      await user.click(screen.getByRole('button', { name: /new recall/i }));

      await user.selectOptions(screen.getByLabelText('Type'), 'Treatment');
      // date input is keyed directly (happy-dom accepts the ISO date value)
      const due = screen.getByLabelText('Due Date') as HTMLInputElement;
      await user.type(due, '2026-08-15');
      await user.type(screen.getByLabelText(/Notes/i), 'Six-month follow-up');

      await user.click(screen.getByRole('button', { name: /save recall/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/recalls'))).toBe(true),
      );
      const post = f.calls.find(c => c.method === 'POST' && c.url.includes('/recalls'))!;
      expect((post.body as { type: string }).type).toBe('treatment');
      expect((post.body as { dueDate: string }).dueDate).toBe('2026-08-15');
      expect((post.body as { notes: string }).notes).toBe('Six-month follow-up');
    } finally {
      f.restore();
    }
  });

  test('1.3: clicking the "6 mo" interval chip pre-fills Due Date and stays editable', async () => {
    const user = userEvent.setup();
    const f = installFetch([]);
    // Replicates the component's clamp-day addMonths so the expectation can't
    // disagree with a different algorithm.
    function addMonths(base: Date, n: number): string {
      const target = new Date(base.getFullYear(), base.getMonth() + n, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(base.getDate(), lastDay));
      const p = (x: number) => String(x).padStart(2, '0');
      return `${target.getFullYear()}-${p(target.getMonth() + 1)}-${p(target.getDate())}`;
    }
    try {
      renderSheet();
      await user.click(screen.getByRole('button', { name: /new recall/i }));
      await user.click(screen.getByRole('button', { name: '6 mo' }));
      const due = screen.getByLabelText('Due Date') as HTMLInputElement;
      expect(due.value).toBe(addMonths(new Date(), 6));
      // still editable — typing overrides the chip value
      await user.clear(due);
      await user.type(due, '2027-01-15');
      expect(due.value).toBe('2027-01-15');
    } finally {
      f.restore();
    }
  });

  test('fires PATCH /recalls/:id with the next status on a transition button', async () => {
    const user = userEvent.setup();
    const f = installFetch([makeRecall({ id: 'r-42', status: 'pending' })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Mark Sent' })).not.toBeNull());
      await user.click(screen.getByRole('button', { name: 'Mark Sent' }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'PATCH' && c.url.includes('/recalls/r-42'))).toBe(true),
      );
      const patch = f.calls.find(c => c.method === 'PATCH')!;
      expect((patch.body as { status: string }).status).toBe('sent');
    } finally {
      f.restore();
    }
  });

  test('1.1: a past-due pending recall renders an "Overdue" badge', async () => {
    // 30 days ago — comfortably in the past regardless of run date.
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const f = installFetch([makeRecall({ status: 'pending', dueDate: past })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText('Cleaning')).not.toBeNull());
      expect(screen.getByText('Overdue')).not.toBeNull();
      // relative text accompanies the absolute date
      expect(screen.getByText(/overdue\)/i)).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('1.1: a future pending recall does NOT render "Overdue"', async () => {
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const f = installFetch([makeRecall({ status: 'pending', dueDate: future })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText('Cleaning')).not.toBeNull());
      expect(screen.queryByText('Overdue')).toBeNull();
      // relative text shows it's upcoming ("in …")
      expect(screen.getByText(/\(in /i)).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('1.1: a completed recall never shows "Overdue" even when past due', async () => {
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const f = installFetch([makeRecall({ status: 'completed', dueDate: past })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText('Cleaning')).not.toBeNull());
      expect(screen.queryByText('Overdue')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('3: the header purpose line renders with id="recalls-desc" (a11y describedby target)', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByTestId('recalls-sheet')).not.toBeNull());
      const desc = document.getElementById('recalls-desc');
      expect(desc).not.toBeNull();
      expect(desc!.textContent).toMatch(/recare visits/i);
    } finally {
      f.restore();
    }
  });

  test('shows an error state when the recalls fetch fails', async () => {
    const original = global.fetch;
    global.fetch = mock(async () =>
      new Response('nope', { status: 500 }),
    ) as unknown as typeof fetch;
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/Couldn’t load recalls/i)).not.toBeNull());
    } finally {
      global.fetch = original;
    }
  });
});
