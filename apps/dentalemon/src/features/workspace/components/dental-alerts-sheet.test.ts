/**
 * DentalAlertsSheet component tests (PP-7 sub-slice 1 / ISSUE-042)
 *
 * Renders the shipped DentalAlertsSheet (driven by the real useDentalAlerts
 * TanStack-Query hook) and exercises its wiring end-to-end against a mocked
 * fetch:
 *   - lists alerts returned by GET /dental-alerts and renders a Deactivate button
 *   - the "New Alert" form submits a POST /dental-alerts with the entered fields
 *   - Deactivate fires PATCH /dental-alerts/:id with { active: false }
 *   - empty + error states render
 *
 * Assertions go through the component + hook + fetch, matching the real route
 * shapes in use-dental-alerts.ts.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DentalAlertsSheet } from './dental-alerts-sheet';
import type { DentalAlert } from '../hooks/use-dental-alerts';

const PATIENT_ID = 'p-1';

function makeAlert(overrides: Partial<DentalAlert> = {}): DentalAlert {
  return {
    id: 'a-1',
    version: 1,
    patientId: PATIENT_ID,
    alertType: 'latex_allergy',
    severity: 'high',
    description: null,
    active: true,
    createdAt: '2026-05-01T00:00:00.000Z' as unknown as Date,
    updatedAt: '2026-05-01T00:00:00.000Z' as unknown as Date,
    ...overrides,
  };
}

/**
 * Mock fetch routed by method: GET → the supplied alert list; POST/PATCH →
 * echo an alert. Every call is recorded for assertion.
 */
function installFetch(list: DentalAlert[] = []) {
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
    return new Response(JSON.stringify(makeAlert({ id: 'a-new' })), {
      status: method === 'POST' ? 201 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderSheet(props: Partial<React.ComponentProps<typeof DentalAlertsSheet>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(DentalAlertsSheet, {
        patientId: PATIENT_ID,
        open: true,
        onClose: () => {},
        ...props,
      }),
    ),
  );
}

afterEach(cleanup);

describe('DentalAlertsSheet — shipped component', () => {
  test('does not render when open=false', () => {
    const f = installFetch();
    try {
      renderSheet({ open: false });
      expect(screen.queryByTestId('dental-alerts-sheet')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('renders the alert list returned by GET with a Deactivate button', async () => {
    const f = installFetch([makeAlert({ alertType: 'needle_phobia', severity: 'high' })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText('Needle phobia')).not.toBeNull());
      expect(screen.getByRole('button', { name: /deactivate/i })).not.toBeNull();
      expect(f.calls.some(c => c.method === 'GET' && c.url.includes(`/patients/${PATIENT_ID}/dental-alerts`))).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('shows empty state when there are no alerts', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No alerts/i)).not.toBeNull());
    } finally {
      f.restore();
    }
  });

  test('submits a POST /dental-alerts with the entered fields from the new-alert form', async () => {
    const user = userEvent.setup();
    const f = installFetch([]);
    try {
      renderSheet();
      await user.click(screen.getByRole('button', { name: /new alert/i }));

      await user.selectOptions(screen.getByLabelText('Type'), 'Needle phobia');
      await user.selectOptions(screen.getByLabelText('Severity'), 'High');
      await user.type(screen.getByLabelText(/Description/i), 'Faints at the sight of a needle');

      await user.click(screen.getByRole('button', { name: /save alert/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/dental-alerts'))).toBe(true),
      );
      const post = f.calls.find(c => c.method === 'POST' && c.url.includes('/dental-alerts'))!;
      expect((post.body as { alertType: string }).alertType).toBe('needle_phobia');
      expect((post.body as { severity: string }).severity).toBe('high');
      expect((post.body as { description: string }).description).toBe('Faints at the sight of a needle');
    } finally {
      f.restore();
    }
  });

  test('fires PATCH /dental-alerts/:id with { active: false } on Deactivate', async () => {
    const user = userEvent.setup();
    const f = installFetch([makeAlert({ id: 'a-42', active: true })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByRole('button', { name: /deactivate/i })).not.toBeNull());
      await user.click(screen.getByRole('button', { name: /deactivate/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'PATCH' && c.url.includes('/dental-alerts/a-42'))).toBe(true),
      );
      const patch = f.calls.find(c => c.method === 'PATCH')!;
      expect((patch.body as { active: boolean }).active).toBe(false);
    } finally {
      f.restore();
    }
  });

  test('shows an error state when the alerts fetch fails', async () => {
    const original = global.fetch;
    global.fetch = mock(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/Couldn’t load alerts/i)).not.toBeNull());
    } finally {
      global.fetch = original;
    }
  });
});
