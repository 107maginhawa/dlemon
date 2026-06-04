/**
 * AmendmentForm component tests
 *
 * Renders the SHIPPED AmendmentForm and drives its real validation + write path.
 * The form calls the generated createAmendment SDK function, which issues a POST
 * via globalThis.fetch — so we mock fetch (no module replacement) and assert the
 * request shape, plus the onSaved/onClose callbacks and the failure branch.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AmendmentForm } from './amendment-form';

function installFetch(impl?: () => Promise<Response>) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    if (impl) return impl();
    return new Response(
      JSON.stringify({
        id: 'amd-1',
        visitId: 'v-1',
        patientId: 'p-1',
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderForm(overrides: Partial<React.ComponentProps<typeof AmendmentForm>> = {}) {
  const onClose = overrides.onClose ?? mock(() => {});
  const onSaved = overrides.onSaved ?? mock(() => {});
  render(
    React.createElement(AmendmentForm, {
      visitId: 'v-1',
      patientId: 'p-1',
      originalRecordType: 'tooth',
      originalRecordId: 'tooth-11',
      onClose,
      onSaved,
      ...overrides,
    }),
  );
  return { onClose, onSaved };
}

afterEach(cleanup);

describe('AmendmentForm — shipped component', () => {
  test('Save is disabled until a reason is chosen and content is ≥10 chars', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderForm();
      const save = screen.getByRole('button', { name: /save amendment/i }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);

      // reason only → still disabled (content empty)
      await user.selectOptions(screen.getByLabelText(/Reason/i), 'Correction');
      expect(save.disabled).toBe(true);

      // short content → still disabled
      await user.type(screen.getByLabelText(/Details/i), 'too short');
      expect(save.disabled).toBe(true);

      expect(f.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('submits createAmendment with the entered fields and calls onSaved + onClose', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      const { onClose, onSaved } = renderForm();

      await user.selectOptions(screen.getByLabelText(/Reason/i), 'Additional Finding');
      await user.type(screen.getByLabelText(/Details/i), 'Distal caries noted on review of bitewing.');

      const save = screen.getByRole('button', { name: /save amendment/i }) as HTMLButtonElement;
      expect(save.disabled).toBe(false);
      await user.click(save);

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/dental/visits/v-1/amendments'))).toBe(true),
      );
      const post = f.calls.find(c => c.url.includes('/amendments'))!;
      expect(post.body.patientId).toBe('p-1');
      expect(post.body.originalRecordType).toBe('tooth');
      expect(post.body.originalRecordId).toBe('tooth-11');
      expect(post.body.reason).toBe('additional_finding');
      expect(post.body.content).toBe('Distal caries noted on review of bitewing.');

      await waitFor(() => expect((onSaved as any).mock.calls.length).toBe(1));
      expect((onClose as any).mock.calls.length).toBe(1);
    } finally {
      f.restore();
    }
  });

  test('shows an error and does not close when the request throws', async () => {
    const user = userEvent.setup();
    const f = installFetch(() => Promise.reject(new Error('network down')));
    try {
      const { onClose } = renderForm();
      await user.selectOptions(screen.getByLabelText(/Reason/i), 'Clarification');
      await user.type(screen.getByLabelText(/Details/i), 'Clarifying the prior charting entry.');
      await user.click(screen.getByRole('button', { name: /save amendment/i }));

      await waitFor(() => expect(screen.getByText(/Failed to save amendment/i)).not.toBeNull());
      expect((onClose as any).mock.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });
});
