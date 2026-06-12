/**
 * RxSheet component tests
 *
 * Renders the SHIPPED RxSheet and exercises its real validation + submit wiring
 * (drug/dosage/frequency required → error banner; valid save → createPrescription
 * POST with the entered fields).
 *
 * QW-1/P1-1: allergy conflict surfacing
 * When the server returns warnings.allergyConflicts, the sheet must:
 *   a) render a visible allergy warning banner listing the allergens, and
 *   b) gate the final close/save on an explicit acknowledgment — the sheet
 *      must NOT call onSaved/onClose until the clinician confirms.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RxSheet } from './rx-sheet';

/** Build a global.fetch stub returning the given response JSON at status 201. */
function installFetch(responseBody: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    return new Response(
      JSON.stringify({
        id: 'rx-1',
        visitId: 'v-1',
        drugName: 'Amoxicillin',
        createdAt: '2024-01-10T09:00:00Z',
        updatedAt: '2024-01-10T09:00:00Z',
        ...responseBody,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

afterEach(cleanup);

function renderSheet(overrides: Partial<{ onSaved: () => void; onClose: () => void }> = {}) {
  return render(
    React.createElement(RxSheet, {
      visitId: 'v-1',
      patientId: 'p-1',
      prescriberMemberId: 'm-1',
      open: true,
      onClose: overrides.onClose ?? (() => {}),
      onSaved: overrides.onSaved,
    }),
  );
}

/** Fill in the minimum required fields and click Save. */
async function fillAndSave(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Drug name'), 'Amoxicillin');
  await user.type(screen.getByLabelText('Dosage'), '500mg');
  await user.selectOptions(
    screen.getByLabelText('Frequency selection'),
    'TID (three times daily)',
  );
  await user.click(screen.getByRole('button', { name: /save prescription/i }));
}

describe('RxSheet — shipped component', () => {
  test('blocks submit and shows required-field errors when fields are empty', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderSheet();
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      expect(screen.getByText('Drug name is required')).not.toBeNull();
      expect(screen.getByText('Dosage is required')).not.toBeNull();
      expect(screen.getByText('Frequency is required')).not.toBeNull();
      // No prescription request must have been sent.
      expect(f.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('submits createPrescription with the entered fields when valid (no allergy conflicts)', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const onClose = mock(() => {});
    const f = installFetch(); // no warnings in response
    try {
      renderSheet({ onSaved, onClose });
      await fillAndSave(user);

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/prescriptions'))).toBe(true),
      );
      const post = f.calls.find(c => c.url.includes('/prescriptions'))!;
      expect((post.body as { drugName: string }).drugName).toBe('Amoxicillin');
      expect((post.body as { dosage: string }).dosage).toBe('500mg');
      expect((post.body as { frequency: string }).frequency).toBe('TID (three times daily)');
      // No allergy warning → sheet closes immediately.
      await waitFor(() => expect(onSaved.mock.calls.length).toBe(1));
      expect(onClose.mock.calls.length).toBe(1);
    } finally {
      f.restore();
    }
  });

  // ── QW-1/P1-1: allergy conflict ────────────────────────────────────────────

  test('shows allergy conflict warning banner when server returns allergyConflicts', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const onClose = mock(() => {});
    const f = installFetch({ warnings: { allergyConflicts: ['Penicillin'] } });
    try {
      renderSheet({ onSaved, onClose });
      await fillAndSave(user);

      // Banner must appear listing the conflicting allergen.
      await waitFor(() =>
        expect(screen.getByRole('alert')).not.toBeNull(),
      );
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('Penicillin');

      // Sheet must NOT have closed yet — acknowledgment required.
      expect(onSaved.mock.calls.length).toBe(0);
      expect(onClose.mock.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('allows completion only after the clinician acknowledges the allergy conflict', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const onClose = mock(() => {});
    const f = installFetch({ warnings: { allergyConflicts: ['Penicillin', 'Amoxicillin'] } });
    try {
      renderSheet({ onSaved, onClose });
      await fillAndSave(user);

      // Wait for the warning to appear.
      await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());

      // Both allergens must be listed.
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('Penicillin');
      expect(alert.textContent).toContain('Amoxicillin');

      // An acknowledgment button must be present.
      const ackBtn = screen.getByRole('button', { name: /acknowledge.*prescribe|prescribe anyway/i });
      expect(ackBtn).not.toBeNull();

      // Sheet still not closed before acknowledgment.
      expect(onSaved.mock.calls.length).toBe(0);
      expect(onClose.mock.calls.length).toBe(0);

      // Clinician acknowledges → sheet closes.
      await user.click(ackBtn);
      await waitFor(() => expect(onSaved.mock.calls.length).toBe(1));
      expect(onClose.mock.calls.length).toBe(1);
    } finally {
      f.restore();
    }
  });

  // ── P2-13: legal fields (US-context, optional) ─────────────────────────────

  test('renders the optional legal fields (schedule, DEA, NPI)', async () => {
    const f = installFetch();
    try {
      renderSheet();
      expect(screen.getByLabelText('Controlled-substance schedule')).not.toBeNull();
      expect(screen.getByLabelText('Prescriber DEA number')).not.toBeNull();
      expect(screen.getByLabelText('Prescriber NPI')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('omits legal fields from the POST body when left at defaults', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderSheet();
      await fillAndSave(user);
      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/prescriptions'))).toBe(true),
      );
      const post = f.calls.find(c => c.url.includes('/prescriptions'))!;
      const body = post.body as Record<string, unknown>;
      // schedule 'none' is not transmitted; DEA/NPI blank → undefined (dropped)
      expect(body['controlledSubstanceSchedule']).toBeUndefined();
      expect(body['prescriberDea']).toBeUndefined();
      expect(body['prescriberNpi']).toBeUndefined();
    } finally {
      f.restore();
    }
  });

  test('sends the legal fields when the clinician fills them in', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderSheet();
      await user.type(screen.getByLabelText('Drug name'), 'Codeine');
      await user.type(screen.getByLabelText('Dosage'), '30mg');
      await user.selectOptions(screen.getByLabelText('Frequency selection'), 'PRN (as needed)');
      await user.selectOptions(screen.getByLabelText('Controlled-substance schedule'), 'III');
      await user.type(screen.getByLabelText('Prescriber DEA number'), 'AB1234567');
      await user.type(screen.getByLabelText('Prescriber NPI'), '1234567893');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/prescriptions'))).toBe(true),
      );
      const post = f.calls.find(c => c.url.includes('/prescriptions'))!;
      const body = post.body as Record<string, unknown>;
      expect(body['controlledSubstanceSchedule']).toBe('III');
      expect(body['prescriberDea']).toBe('AB1234567');
      expect(body['prescriberNpi']).toBe('1234567893');
    } finally {
      f.restore();
    }
  });

  test('does not show allergy banner when response has no warnings field', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const f = installFetch(); // response has no `warnings`
    try {
      renderSheet({ onSaved });
      await fillAndSave(user);

      await waitFor(() => expect(onSaved.mock.calls.length).toBe(1));
      // No allergy alert should be in the DOM.
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      f.restore();
    }
  });
});

// ── FIX-006 (WF-016): Rx list + dispense/cancel lifecycle ────────────────────

type RxRow = {
  id: string;
  drugName: string;
  dosage?: string;
  frequency?: string;
  status: 'pending' | 'dispensed' | 'cancelled';
};

/**
 * A realistic fetch router for the per-visit prescription list + PATCH lifecycle.
 *   GET   .../prescriptions          → 200 { data: RxRow[], pagination }   (list-shape trap)
 *   PATCH .../prescriptions/:id       → 200 updated row (status echoed from body);
 *                                       also mutates the backing list so a refetch flips it
 *   POST  .../prescriptions           → 201 created row (status 'pending')
 */
type RxRequestBody = { status?: string; drugName?: string };

function installRxRouter(initial: RxRow[]) {
  const list: RxRow[] = initial.map(r => ({ ...r }));
  const calls: Array<{ url: string; method: string; body: RxRequestBody | undefined }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    const body = raw ? (JSON.parse(raw) as RxRequestBody) : undefined;
    calls.push({ url, method, body });

    if (method === 'GET' && /\/prescriptions$/.test(url.split('?')[0]!)) {
      return json(200, {
        data: list,
        pagination: { offset: 0, limit: 50, count: list.length, totalCount: list.length, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
      });
    }
    if (method === 'PATCH') {
      const id = url.split('/').pop()!;
      const row = list.find(r => r.id === id);
      if (row && typeof body?.status === 'string') row.status = body.status as RxRow['status'];
      return json(200, row ?? { id, status: body?.status });
    }
    if (method === 'POST') {
      return json(201, { id: 'rx-new', visitId: 'v-1', drugName: body?.drugName ?? 'Drug', status: 'pending' });
    }
    return json(200, {});
  }) as unknown as typeof fetch;
  return { calls, list, restore: () => { global.fetch = original; } };
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

function renderLifecycleSheet(
  overrides: Partial<{ onSaved: () => void; onClose: () => void; canManage: boolean }> = {},
) {
  return render(
    React.createElement(RxSheet, {
      visitId: 'v-1',
      patientId: 'p-1',
      prescriberMemberId: 'm-1',
      canManage: overrides.canManage,
      open: true,
      onClose: overrides.onClose ?? (() => {}),
      onSaved: overrides.onSaved,
    } as React.ComponentProps<typeof RxSheet>),
  );
}

/** Click the "Prescriptions" list tab to switch out of the create form. */
async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /prescriptions/i }));
}

describe('RxSheet — prescription list + lifecycle (FIX-006)', () => {
  test('list tab renders per-visit prescriptions with status badges (unwraps {data,pagination})', async () => {
    const user = userEvent.setup();
    const f = installRxRouter([
      { id: 'rx-1', drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID', status: 'pending' },
      { id: 'rx-2', drugName: 'Ibuprofen', dosage: '400mg', frequency: 'BID', status: 'dispensed' },
    ]);
    try {
      renderLifecycleSheet();
      await openList(user);

      // Both rows render (proves the {data,pagination} envelope was unwrapped, not a bare array).
      await waitFor(() => expect(screen.getByTestId('rx-row-rx-1')).not.toBeNull());
      expect(screen.getByTestId('rx-row-rx-2')).not.toBeNull();
      // Status badges reflect the row status.
      expect(screen.getByTestId('rx-status-rx-1').textContent?.toLowerCase()).toContain('pending');
      expect(screen.getByTestId('rx-status-rx-2').textContent?.toLowerCase()).toContain('dispensed');
      // The GET hit the per-visit prescriptions route.
      expect(f.calls.some(c => c.method === 'GET' && c.url.includes('/visits/v-1/prescriptions'))).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('dispense on a pending Rx PATCHes status=dispensed, refetches, and the badge flips', async () => {
    const user = userEvent.setup();
    const f = installRxRouter([
      { id: 'rx-1', drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID', status: 'pending' },
    ]);
    try {
      renderLifecycleSheet({ canManage: true });
      await openList(user);

      await waitFor(() => expect(screen.getByTestId('rx-row-rx-1')).not.toBeNull());
      await user.click(screen.getByRole('button', { name: /mark amoxicillin dispensed/i }));

      // PATCH carried the FSM transition to the right resource.
      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'PATCH' && c.url.includes('/prescriptions/rx-1'))).toBe(true),
      );
      const patch = f.calls.find(c => c.method === 'PATCH')!;
      expect(patch.body?.status).toBe('dispensed');
      // After the refetch the badge flips and the dispense action is gone (terminal).
      await waitFor(() =>
        expect(screen.getByTestId('rx-status-rx-1').textContent?.toLowerCase()).toContain('dispensed'),
      );
      expect(screen.queryByRole('button', { name: /mark amoxicillin dispensed/i })).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('cancel on a pending Rx PATCHes status=cancelled', async () => {
    const user = userEvent.setup();
    const f = installRxRouter([
      { id: 'rx-1', drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID', status: 'pending' },
    ]);
    try {
      renderLifecycleSheet({ canManage: true });
      await openList(user);

      await waitFor(() => expect(screen.getByTestId('rx-row-rx-1')).not.toBeNull());
      await user.click(screen.getByRole('button', { name: /cancel amoxicillin prescription/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'PATCH' && c.url.includes('/prescriptions/rx-1'))).toBe(true),
      );
      const patch = f.calls.find(c => c.method === 'PATCH')!;
      expect(patch.body?.status).toBe('cancelled');
      await waitFor(() =>
        expect(screen.getByTestId('rx-status-rx-1').textContent?.toLowerCase()).toContain('cancelled'),
      );
    } finally {
      f.restore();
    }
  });

  test('FSM-gated: no dispense/cancel actions on terminal (dispensed/cancelled) rows', async () => {
    const user = userEvent.setup();
    const f = installRxRouter([
      { id: 'rx-1', drugName: 'Amoxicillin', status: 'dispensed' },
      { id: 'rx-2', drugName: 'Ibuprofen', status: 'cancelled' },
    ]);
    try {
      renderLifecycleSheet({ canManage: true });
      await openList(user);

      await waitFor(() => expect(screen.getByTestId('rx-row-rx-1')).not.toBeNull());
      expect(screen.queryByRole('button', { name: /mark amoxicillin dispensed/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /cancel amoxicillin prescription/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /mark ibuprofen dispensed/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /cancel ibuprofen prescription/i })).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('role-gated: dispense/cancel hidden when canManage is false (list still readable)', async () => {
    const user = userEvent.setup();
    const f = installRxRouter([
      { id: 'rx-1', drugName: 'Amoxicillin', status: 'pending' },
    ]);
    try {
      renderLifecycleSheet({ canManage: false });
      await openList(user);

      await waitFor(() => expect(screen.getByTestId('rx-row-rx-1')).not.toBeNull());
      // Read affordance present, write affordances absent.
      expect(screen.getByTestId('rx-status-rx-1').textContent?.toLowerCase()).toContain('pending');
      expect(screen.queryByRole('button', { name: /mark amoxicillin dispensed/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /cancel amoxicillin prescription/i })).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('empty state when the visit has no prescriptions', async () => {
    const user = userEvent.setup();
    const f = installRxRouter([]);
    try {
      renderLifecycleSheet({ canManage: true });
      await openList(user);
      await waitFor(() => expect(screen.getByText(/no prescriptions for this visit/i)).not.toBeNull());
    } finally {
      f.restore();
    }
  });
});

// ── GAP-5 (FR1.12/FR2.15): allergy blocking-with-override, PRE-SUBMIT gate ────
//
// Decision #11 restored PRD "blocking-with-override": a recorded allergy that the
// drug being prescribed conflicts with must be confirmed via an explicit dialog
// BEFORE the prescription is created — not surfaced after a 201 (advisory). The
// FE already holds the patient's active allergies (workspace safety floor /
// listMedicalHistory); the parent passes them in as `patientAllergies` so the
// sheet stays prop-pure. The matcher mirrors the backend cross-check exactly
// (case-insensitive, substring in either direction).

import { within } from '@testing-library/react';

function renderRxWithAllergies(
  patientAllergies: string[],
  overrides: Partial<{ onSaved: () => void; onClose: () => void }> = {},
) {
  return render(
    React.createElement(RxSheet, {
      visitId: 'v-1',
      patientId: 'p-1',
      prescriberMemberId: 'm-1',
      patientAllergies,
      open: true,
      onClose: overrides.onClose ?? (() => {}),
      onSaved: overrides.onSaved,
    } as React.ComponentProps<typeof RxSheet>),
  );
}

async function fillForm(user: ReturnType<typeof userEvent.setup>, drug: string) {
  await user.type(screen.getByLabelText('Drug name'), drug);
  await user.type(screen.getByLabelText('Dosage'), '500mg');
  await user.selectOptions(screen.getByLabelText('Frequency selection'), 'TID (three times daily)');
}

describe('RxSheet — allergy blocking-with-override (GAP-5)', () => {
  test('a conflicting drug opens a confirm dialog BEFORE submit and does NOT POST', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const f = installFetch();
    try {
      renderRxWithAllergies(['Penicillin'], { onSaved });
      await fillForm(user, 'Penicillin');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      // A confirm dialog must appear naming the conflicting allergen…
      const dialog = await screen.findByTestId('allergy-confirm-dialog');
      expect(dialog.textContent).toContain('Penicillin');
      // …and NOTHING must have been POSTed yet (this is a PRE-submit gate).
      expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/prescriptions'))).toBe(false);
      expect(onSaved.mock.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('"Prescribe anyway" in the dialog is what actually POSTs the prescription', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const onClose = mock(() => {});
    const f = installFetch();
    try {
      renderRxWithAllergies(['Penicillin'], { onSaved, onClose });
      await fillForm(user, 'Penicillin');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      const dialog = await screen.findByTestId('allergy-confirm-dialog');
      // No POST until the explicit override.
      expect(f.calls.some(c => c.method === 'POST')).toBe(false);

      await user.click(within(dialog).getByRole('button', { name: /prescribe anyway/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/prescriptions'))).toBe(true),
      );
      const post = f.calls.find(c => c.url.includes('/prescriptions'))!;
      expect((post.body as { drugName: string }).drugName).toBe('Penicillin');
      // Allergy was already acknowledged pre-submit → the post-save server banner
      // must NOT re-prompt; the sheet completes.
      await waitFor(() => expect(onSaved.mock.calls.length).toBe(1));
      expect(onClose.mock.calls.length).toBe(1);
    } finally {
      f.restore();
    }
  });

  test('cancelling the dialog keeps the form and does NOT POST', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const f = installFetch();
    try {
      renderRxWithAllergies(['Penicillin'], { onSaved });
      await fillForm(user, 'Penicillin');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      const dialog = await screen.findByTestId('allergy-confirm-dialog');
      await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

      await waitFor(() => expect(screen.queryByTestId('allergy-confirm-dialog')).toBeNull());
      expect(f.calls.some(c => c.method === 'POST')).toBe(false);
      expect(onSaved.mock.calls.length).toBe(0);
      // The drug name is still in the form (not discarded).
      expect((screen.getByLabelText('Drug name') as HTMLInputElement).value).toBe('Penicillin');
    } finally {
      f.restore();
    }
  });

  test('matches the allergen as a substring in either direction (mirrors backend)', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      // Allergen "Amoxicillin"; prescribing "Amox" → drug ⊂ allergen → conflict.
      renderRxWithAllergies(['Amoxicillin']);
      await fillForm(user, 'Amox');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      const dialog = await screen.findByTestId('allergy-confirm-dialog');
      expect(dialog.textContent).toContain('Amoxicillin');
      expect(f.calls.some(c => c.method === 'POST')).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('a non-conflicting drug submits directly with no dialog', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const onClose = mock(() => {});
    const f = installFetch();
    try {
      renderRxWithAllergies(['Penicillin'], { onSaved, onClose });
      await fillForm(user, 'Ibuprofen');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/prescriptions'))).toBe(true),
      );
      // No pre-submit dialog was shown.
      expect(screen.queryByTestId('allergy-confirm-dialog')).toBeNull();
      await waitFor(() => expect(onSaved.mock.calls.length).toBe(1));
      expect(onClose.mock.calls.length).toBe(1);
    } finally {
      f.restore();
    }
  });

  test('matches when the allergen is a substring of the drug name (reverse direction)', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      // Allergen "Penicillin"; prescribing "Penicillin V" → allergen ⊂ drug → conflict.
      renderRxWithAllergies(['Penicillin']);
      await fillForm(user, 'Penicillin V');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      await screen.findByTestId('allergy-confirm-dialog');
      expect(f.calls.some(c => c.method === 'POST')).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('after override, the post-save server allergy banner does NOT re-prompt (no double gate)', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const onClose = mock(() => {});
    // The server ALSO returns allergyConflicts on the 201 (backend is unchanged).
    const f = installFetch({ warnings: { allergyConflicts: ['Penicillin'] } });
    try {
      renderRxWithAllergies(['Penicillin'], { onSaved, onClose });
      await fillForm(user, 'Penicillin');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      const dialog = await screen.findByTestId('allergy-confirm-dialog');
      await user.click(within(dialog).getByRole('button', { name: /prescribe anyway/i }));

      // POST fires, and the allergy was already acknowledged pre-submit → the sheet
      // completes without re-showing the post-save amber banner.
      await waitFor(() => expect(onSaved.mock.calls.length).toBe(1));
      expect(onClose.mock.calls.length).toBe(1);
      expect(screen.queryByText(/allergy conflict:/i)).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('after override, a server allergen the clinician did NOT acknowledge still surfaces post-save', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    // Client cache knows only Penicillin; the server returns an ADDITIONAL conflict
    // (e.g. a cross-reactive allergy added since the safety-floor cache loaded) that
    // was never shown in the confirm dialog. The override must NOT swallow it.
    const f = installFetch({ warnings: { allergyConflicts: ['Penicillin', 'Cephalexin'] } });
    try {
      renderRxWithAllergies(['Penicillin'], { onSaved });
      await fillForm(user, 'Penicillin');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));
      const dialog = await screen.findByTestId('allergy-confirm-dialog');
      // The dialog only named the acknowledged allergen.
      expect(dialog.textContent).toContain('Penicillin');
      expect(dialog.textContent).not.toContain('Cephalexin');
      await user.click(within(dialog).getByRole('button', { name: /prescribe anyway/i }));

      // The un-acknowledged Cephalexin conflict surfaces post-save; the sheet holds open.
      await waitFor(() => expect(screen.getByText(/allergy conflict:/i).textContent).toContain('Cephalexin'));
      expect(screen.getByText(/allergy conflict:/i).textContent).not.toContain('Penicillin');
      expect(onSaved.mock.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('drug interactions still surface post-save even when allergy was overridden', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const f = installFetch({
      warnings: {
        allergyConflicts: ['Penicillin'],
        drugInteractions: [{ interactingDrug: 'Warfarin', severity: 'major', description: 'Bleeding risk' }],
      },
    });
    try {
      renderRxWithAllergies(['Penicillin'], { onSaved });
      await fillForm(user, 'Penicillin');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));
      const dialog = await screen.findByTestId('allergy-confirm-dialog');
      await user.click(within(dialog).getByRole('button', { name: /prescribe anyway/i }));

      // The server-only drug-drug interaction (not knowable client-side) still gates post-save.
      await waitFor(() => expect(screen.getByText(/drug interaction warning/i)).not.toBeNull());
      expect(onSaved.mock.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('empty-string allergens never spuriously match a drug', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderRxWithAllergies(['']);
      await fillForm(user, 'Ibuprofen');
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/prescriptions'))).toBe(true),
      );
      expect(screen.queryByTestId('allergy-confirm-dialog')).toBeNull();
    } finally {
      f.restore();
    }
  });
});
