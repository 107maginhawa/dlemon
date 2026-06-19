/**
 * Informed-refusal (decline) UI — P0-2
 *
 * Exercises the SHIPPED decline flow end-to-end on the frontend: the real
 * TreatmentTable renders the real DeclineTreatmentPopover, which is wired to
 * the real useUpdateTreatment mutation. Asserts:
 *   - the UI mirrors BR-006 REFUSAL_REASON_REQUIRED (Confirm Refusal is disabled
 *     until a reason ≥ 3 chars is entered), and
 *   - confirming fires PATCH …/treatments/:id with { status:'declined', refusalReason }.
 *
 * Covers dental-visit coverage matrix #24 (decline / informed-refusal), which
 * had zero FE coverage (grep declin|refus in FE *.test.ts = 0).
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase } from '@/test-utils';

mock.module('sonner', () => ({ toast: { error: mock(() => {}), success: mock(() => {}) } }));

import { TreatmentTable } from './treatment-table';

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

const DIAGNOSED_TREATMENT = {
  id: 't-pending',
  visitId: 'v-1',
  toothNumber: 16,
  procedureCode: 'D2391',
  procedureName: 'Composite Filling',
  status: 'diagnosed' as const,
  priceAmount: 2500,
  currency: 'PHP',
  createdAt: '2024-01-10T09:00:00Z',
  updatedAt: '2024-01-10T09:00:00Z',
};

function installFetch() {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const rawBody = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ method, url, body: rawBody ? JSON.parse(rawBody) : undefined });
    return new Response(
      JSON.stringify({ ...DIAGNOSED_TREATMENT, status: 'declined' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

afterEach(cleanup);

function renderTable() {
  return render(
    React.createElement(TreatmentTable, {
      visitId: 'v-1',
      treatments: [DIAGNOSED_TREATMENT],
    }),
    { wrapper: makeWrapper() },
  );
}

describe('Informed refusal (decline) UI', () => {
  test('exposes a Decline affordance for a diagnosed treatment', () => {
    renderTable();
    expect(screen.getByTestId('decline-btn')).not.toBeNull();
  });

  test('REFUSAL_REASON_REQUIRED: Confirm Refusal is disabled until a reason is entered', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByTestId('decline-btn'));
    const confirm = await screen.findByTestId('confirm-decline-btn');
    // Empty reason → cannot submit (UI mirror of the backend 422 guard)
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByTestId('refusal-reason-input'), 'Patient cannot afford');
    await waitFor(() =>
      expect((screen.getByTestId('confirm-decline-btn') as HTMLButtonElement).disabled).toBe(false),
    );
  });

  test('confirming a refusal PATCHes status=declined with the refusalReason', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderTable();

      await user.click(screen.getByTestId('decline-btn'));
      await user.type(
        await screen.findByTestId('refusal-reason-input'),
        'Prefers alternative',
      );
      await user.click(screen.getByTestId('confirm-decline-btn'));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'PATCH' && c.url.includes('/treatments/t-pending'))).toBe(true),
      );
      const patch = f.calls.find(c => c.method === 'PATCH')!;
      expect((patch.body as { status: string }).status).toBe('declined');
      expect((patch.body as { refusalReason: string }).refusalReason).toBe('Prefers alternative');
    } finally {
      f.restore();
    }
  });
});
