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
