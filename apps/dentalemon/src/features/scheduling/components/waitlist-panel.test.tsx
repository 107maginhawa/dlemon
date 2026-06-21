/**
 * WaitlistPanel — PP-5 (ISSUE-039) front-desk waitlist.
 *
 * Pins the staff surface closed: list active entries + promote (fill a slot).
 * Asserts the POST /waitlist/:id/promote body the backend expects.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { WaitlistPanel, canPromote, initialPromoteForm } from './waitlist-panel';

const BRANCH_ID = '7b000000-0000-4000-8000-0000000000e5';

const ENTRY = {
  id: 'wl-1', patientId: 'a0000000-0000-1000-8000-000000000001', branchId: BRANCH_ID,
  preferredProviderId: '7c000000-0000-4000-8000-000000000001', visitType: 'checkup',
  urgency: 'asap', status: 'active', notes: 'Wants earliest slot', version: 1,
  createdAt: '2026-06-10T00:00:00Z', updatedAt: '2026-06-10T00:00:00Z',
};

describe('canPromote', () => {
  test('requires date, time and a provider', () => {
    expect(canPromote({ date: '', time: '', durationMinutes: 30, providerId: '', visitType: 'checkup' })).toBe(false);
    expect(canPromote({ date: '2026-07-01', time: '', durationMinutes: 30, providerId: 'p', visitType: 'checkup' })).toBe(false);
    expect(canPromote({ date: '2026-07-01', time: '10:00', durationMinutes: 30, providerId: 'p', visitType: 'checkup' })).toBe(true);
  });
});

describe('initialPromoteForm', () => {
  test('prefills provider + visit type from the entry', () => {
    const f = initialPromoteForm(ENTRY);
    expect(f.providerId).toBe(ENTRY.preferredProviderId);
    expect(f.visitType).toBe('checkup');
  });
});

describe('WaitlistPanel', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; cleanup(); });

  function renderPanel(fetchImpl: Parameters<typeof mock>[0]) {
    global.fetch = mock(fetchImpl);
    const qc = freshClientWithMutations();
    render(React.createElement(WaitlistPanel, { branchId: BRANCH_ID }), { wrapper: makeWrapper(qc) });
  }

  test('empty state when no one is waiting', async () => {
    renderPanel(() => jsonResponse([]));
    await waitFor(() => expect(screen.getByTestId('waitlist-empty')).not.toBeNull());
  });

  test('renders an active entry', async () => {
    renderPanel(() => jsonResponse([ENTRY]));
    await waitFor(() => expect(screen.getByTestId('waitlist-row')).not.toBeNull());
    expect(screen.getByText(/Wants earliest slot/)).not.toBeNull();
  });

  test('Fill slot → book POSTs the promote body', async () => {
    const captured: { method?: string; url?: string; body?: Record<string, unknown> } = {};
    renderPanel(async (req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      if (method === 'POST' && url.includes('/promote')) {
        captured.method = method; captured.url = url;
        const raw = req instanceof Request ? await req.text() : (init?.body as string);
        captured.body = raw ? JSON.parse(raw) : undefined;
        return jsonResponse({ id: 'appt-1', status: 'scheduled' }, 200);
      }
      return jsonResponse([ENTRY]); // GET waitlist
    });

    await waitFor(() => expect(screen.getByTestId('waitlist-fill-wl-1')).not.toBeNull());
    fireEvent.click(screen.getByTestId('waitlist-fill-wl-1'));
    await waitFor(() => expect(screen.getByTestId('waitlist-promote-form')).not.toBeNull());

    fireEvent.change(screen.getByTestId('waitlist-date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByTestId('waitlist-time'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByTestId('waitlist-book-wl-1'));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.method).toBe('POST');
    expect(captured.url).toContain('/dental/waitlist/wl-1/promote');
    expect(captured.body!.providerId).toBe(ENTRY.preferredProviderId);
    expect(captured.body!.visitType).toBe('checkup');
    expect(typeof captured.body!.startAt).toBe('string');
    expect(typeof captured.body!.endAt).toBe('string');
  });
});
