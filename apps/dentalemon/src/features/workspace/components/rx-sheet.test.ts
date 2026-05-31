/**
 * RxSheet component tests
 *
 * Renders the SHIPPED RxSheet and exercises its real validation + submit wiring
 * (drug/dosage/frequency required → error banner; valid save → createPrescription
 * POST with the entered fields). Replaces the prior version, which asserted a
 * re-declared copy of the validation/payload logic and never mounted the component.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RxSheet } from './rx-sheet';

function installFetch() {
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

  test('submits createPrescription with the entered fields when valid', async () => {
    const user = userEvent.setup();
    const onSaved = mock(() => {});
    const onClose = mock(() => {});
    const f = installFetch();
    try {
      renderSheet({ onSaved, onClose });

      await user.type(screen.getByLabelText('Drug name'), 'Amoxicillin');
      await user.type(screen.getByLabelText('Dosage'), '500mg');
      await user.selectOptions(
        screen.getByLabelText('Frequency selection'),
        'TID (three times daily)',
      );
      await user.click(screen.getByRole('button', { name: /save prescription/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/prescriptions'))).toBe(true),
      );
      const post = f.calls.find(c => c.url.includes('/prescriptions'))!;
      expect((post.body as { drugName: string }).drugName).toBe('Amoxicillin');
      expect((post.body as { dosage: string }).dosage).toBe('500mg');
      expect((post.body as { frequency: string }).frequency).toBe('TID (three times daily)');
      await waitFor(() => expect(onSaved.mock.calls.length).toBe(1));
      expect(onClose.mock.calls.length).toBe(1);
    } finally {
      f.restore();
    }
  });
});
