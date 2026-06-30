/**
 * PreCompletionChecklist — completion-gate UI tests (P0-1)
 *
 * Exercises the SHIPPED component (not a re-declared copy): renders the real
 * PreCompletionChecklist, lets its 4 async checks run against a mocked fetch,
 * and asserts the gate surfaces warnings, fires the completion PATCH, and
 * surfaces the backend 422 hard-gate (VISIT_HAS_OPEN_TREATMENTS) on the
 * "Complete anyway" override path.
 *
 * Covers dental-visit coverage matrix #12 (open-treatments gate), #13 (consent
 * gate), #15 (complete happy path), #16 ("Complete anyway" override).
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase } from '@/test-utils';

// Radix Dialog portals + focus-trap don't behave under happy-dom. The primitive
// is stubbed GLOBALLY in src/test-setup.ts (mock.module is process-wide and
// leaks across files, so a per-file partial stub here used to poison sibling
// suites — see FE-FLAKE-CALIBRATION). The real PreCompletionChecklist logic
// still runs against that shared stub.

import { PreCompletionChecklist } from './pre-completion-checklist';

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

// ── Configurable fetch router ──────────────────────────────────────────────
// Each test sets the 4 check payloads + the PATCH outcome. The component fires
// GET consents/treatments/notes/lab-orders in parallel, then PATCH on confirm.

interface FetchConfig {
  consents: Array<{ signed: boolean }>;
  treatments: Array<{ status: string }>;
  notes: Record<string, unknown>;
  labOrders: Array<{ status: string }>;
  patch: { status: number; body: unknown };
}

const DATES = { createdAt: '2024-01-10T09:00:00Z', updatedAt: '2024-01-10T09:00:00Z' };

function withItems<T>(items: T[]) {
  return { data: items.map((it) => ({ ...DATES, orderedAt: DATES.createdAt, ...it })) };
}

function installFetch(cfg: FetchConfig) {
  const patchCalls: Array<{ url: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    if (method === 'PATCH') {
      const rawBody = req instanceof Request ? await req.clone().text() : init?.body;
      patchCalls.push({ url, body: rawBody ? JSON.parse(String(rawBody)) : undefined });
      return json(cfg.patch.body, cfg.patch.status);
    }
    if (url.includes('/consents')) return json(withItems(cfg.consents));
    if (url.includes('/treatments')) return json(withItems(cfg.treatments));
    if (url.includes('/lab-orders')) return json(withItems(cfg.labOrders));
    if (url.includes('/notes')) return json({ visitId: 'v-1', ...DATES, ...cfg.notes });
    return json({ data: [] });
  }) as unknown as typeof fetch;

  return { patchCalls, restore: () => { global.fetch = original; } };
}

const ALL_PASS: FetchConfig = {
  consents: [{ signed: true }],
  treatments: [{ status: 'performed' }],
  notes: { subjective: 'CC: pain', objective: '', assessment: '', plan: '' },
  labOrders: [{ status: 'fitted' }],
  patch: { status: 200, body: { id: 'v-1', status: 'completed', ...DATES } },
};

afterEach(cleanup);

function renderChecklist(overrides: Partial<{ onClose: () => void; onCompleted: () => void }> = {}) {
  return render(
    React.createElement(PreCompletionChecklist, {
      visitId: 'v-1',
      patientId: 'p-1',
      open: true,
      onClose: overrides.onClose ?? (() => {}),
      onCompleted: overrides.onCompleted,
    }),
    { wrapper: makeWrapper() },
  );
}

describe('PreCompletionChecklist — completion gate UI', () => {
  test('#13 surfaces unsigned-consent warning when no signed consent on file', async () => {
    const f = installFetch({ ...ALL_PASS, consents: [{ signed: false }] });
    try {
      renderChecklist();
      await waitFor(() =>
        expect(screen.getByText('No signed consent form on file')).not.toBeNull(),
      );
    } finally {
      f.restore();
    }
  });

  test('#12 open-treatment is a HARD block — no "Complete anyway", completion disabled (G-09)', async () => {
    const f = installFetch({ ...ALL_PASS, treatments: [{ status: 'diagnosed' }] });
    try {
      renderChecklist();
      await waitFor(() =>
        expect(screen.getByText(/1 treatment not done yet/)).not.toBeNull(),
      );
      // G-09: open treatments are a server hard-gate (VISIT_HAS_OPEN_TREATMENTS,
      // 422, no override). The old "Complete anyway" was a false affordance — it is
      // gone; "Complete visit" is shown but disabled until the blocker is resolved.
      expect(screen.queryByRole('button', { name: 'Complete anyway' })).toBeNull();
      const complete = screen.getByRole('button', { name: 'Complete visit' }) as HTMLButtonElement;
      expect(complete.disabled).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('#15 all checks pass → shows "Complete Visit", confirm fires PATCH status=completed', async () => {
    const onCompleted = mock(() => {});
    const onClose = mock(() => {});
    const f = installFetch(ALL_PASS);
    try {
      renderChecklist({ onCompleted, onClose });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Complete visit' })).not.toBeNull(),
      );

      await userEvent.setup().click(screen.getByRole('button', { name: 'Complete visit' }));

      await waitFor(() => expect(f.patchCalls.length).toBeGreaterThan(0));
      expect(f.patchCalls[0].url).toContain('/dental/visits/v-1');
      expect((f.patchCalls[0].body as { status: string }).status).toBe('completed');
      await waitFor(() => expect(onCompleted.mock.calls.length).toBe(1));
      expect(onClose.mock.calls.length).toBe(1);
    } finally {
      f.restore();
    }
  });

  test('#16 soft-override path: a 422 the server returns on confirm surfaces in dialog, stays open', async () => {
    const onClose = mock(() => {});
    // A SOFT warning (open lab order) keeps "Complete anyway" available — the
    // overridable path. If the server still rejects the confirm (422), the error
    // must surface and the dialog must stay open. (Hard blocks like open
    // treatments / unsigned consent no longer reach this path — see #12.)
    const f = installFetch({
      ...ALL_PASS,
      labOrders: [{ status: 'ordered' }],
      patch: {
        status: 422,
        body: { code: 'SOME_SERVER_GUARD', message: 'Server rejected the completion.' },
      },
    });
    try {
      renderChecklist({ onClose });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Complete anyway' })).not.toBeNull(),
      );

      await userEvent.setup().click(screen.getByRole('button', { name: 'Complete anyway' }));

      await waitFor(() =>
        expect(screen.getByText(/Server rejected the completion/)).not.toBeNull(),
      );
      // The dialog must NOT close on a rejected completion.
      expect(onClose.mock.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });
});
