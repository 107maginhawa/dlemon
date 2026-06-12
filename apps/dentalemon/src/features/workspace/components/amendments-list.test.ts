/**
 * AmendmentsList component tests (FIX-007 / FR1.16 "both visible")
 *
 * Renders the SHIPPED AmendmentsList, which reads the visit's amendments via the
 * generated listAmendments SDK function. That issues a GET through globalThis.fetch,
 * so we mock fetch (no module replacement) — the same harness amendment-form.test.ts
 * uses for the write side.
 *
 * §15 list-shape trap: listAmendments returns the offset envelope
 * `{ data: Amendment[], pagination }` (NOT a bare array / `{items}`). The list MUST
 * unwrap `data.data`. These tests pin that, plus the read-only / empty / error /
 * refetch behaviours.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { AmendmentsList } from './amendments-list';

function amendment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'amd-1',
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
    version: 1,
    visitId: 'v-1',
    patientId: 'p-1',
    authorMemberId: 'm-1',
    originalRecordType: 'tooth_treatment',
    originalRecordId: 'f1000000-0000-4000-8000-000000000099',
    reason: 'correction',
    content: 'Procedure performed on upper left, not lower left.',
    ...overrides,
  };
}

function installFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; method: string }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    calls.push({ url, method });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

afterEach(cleanup);

describe('AmendmentsList — shipped component', () => {
  test('renders one row per amendment, unwrapping the {data,pagination} envelope', async () => {
    const f = installFetch({
      data: [
        amendment({ id: 'amd-1', content: 'First correction note.' }),
        amendment({ id: 'amd-2', content: 'Second correction note.', reason: 'clarification' }),
      ],
      pagination: { offset: 0, limit: 50, count: 2, totalCount: 2, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
    });
    try {
      render(React.createElement(AmendmentsList, { visitId: 'v-1' }));

      await waitFor(() => expect(screen.getByText('First correction note.')).not.toBeNull());
      expect(screen.getByText('Second correction note.')).not.toBeNull();

      // Coherence oracle: rendered row count must equal the number of items returned
      // (guards the list-shape trap — reading `data` instead of `data.data` would
      // render 0 rows from a truthy-but-wrong shape).
      const rows = screen.getAllByTestId('amendment-row');
      expect(rows.length).toBe(2);

      // It read the visit-scoped endpoint.
      expect(f.calls.some((c) => c.method === 'GET' && c.url.includes('/dental/visits/v-1/amendments'))).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('labels the original record type and the amendment reason', async () => {
    const f = installFetch({
      data: [amendment({ originalRecordType: 'tooth_treatment', reason: 'correction' })],
      pagination: { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
    });
    try {
      render(React.createElement(AmendmentsList, { visitId: 'v-1' }));
      await waitFor(() => expect(screen.getByText(/Tooth treatment/i)).not.toBeNull());
      expect(screen.getByText(/Correction/i)).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('shows an empty state when the visit has no amendments', async () => {
    const f = installFetch({
      data: [],
      pagination: { offset: 0, limit: 50, count: 0, totalCount: 0, totalPages: 0, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
    });
    try {
      render(React.createElement(AmendmentsList, { visitId: 'v-1' }));
      await waitFor(() => expect(screen.getByText(/no amendments/i)).not.toBeNull());
      expect(screen.queryAllByTestId('amendment-row').length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('shows an error state when the request fails', async () => {
    const f = installFetch({ code: 'INTERNAL', message: 'boom' }, 500);
    try {
      render(React.createElement(AmendmentsList, { visitId: 'v-1' }));
      await waitFor(() => expect(screen.getByText(/failed to load amendments/i)).not.toBeNull());
    } finally {
      f.restore();
    }
  });

  test('is read-only — renders no buttons or text inputs', async () => {
    const f = installFetch({
      data: [amendment()],
      pagination: { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
    });
    try {
      render(React.createElement(AmendmentsList, { visitId: 'v-1' }));
      await waitFor(() => expect(screen.getAllByTestId('amendment-row').length).toBe(1));
      expect(screen.queryAllByRole('button').length).toBe(0);
      expect(screen.queryAllByRole('textbox').length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('refetches when reloadToken changes (write→read loop)', async () => {
    const f = installFetch({
      data: [amendment({ id: 'amd-1', content: 'Only one so far.' })],
      pagination: { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
    });
    try {
      const { rerender } = render(React.createElement(AmendmentsList, { visitId: 'v-1', reloadToken: 0 }));
      await waitFor(() => expect(screen.getByText('Only one so far.')).not.toBeNull());
      const firstCount = f.calls.filter((c) => c.method === 'GET').length;

      rerender(React.createElement(AmendmentsList, { visitId: 'v-1', reloadToken: 1 }));
      await waitFor(() =>
        expect(f.calls.filter((c) => c.method === 'GET').length).toBeGreaterThan(firstCount),
      );
    } finally {
      f.restore();
    }
  });
});
