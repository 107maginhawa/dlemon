/**
 * CollectionsWorklist — overdue-account worklist + log-note action (BR-051).
 *
 * Asserts the worklist renders overdue rows and the per-row "Log" action posts
 * a collection note to /collections/notes with the chosen channel + text.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { CollectionsWorklist } from './collections-worklist';

const BRANCH = 'b0000000-0000-1000-8000-00000000be51';
const PATIENT = 'b1d6663a-e2c1-4c91-82fc-65a74574ac50';

const originalFetch = global.fetch;
let postBodies: Array<Record<string, unknown>> = [];

const worklist = {
  asOf: '2026-06-19T00:00:00.000Z',
  rows: [{
    patientId: PATIENT, patientName: 'Sofia Cruz', totalOverdueCents: 300000,
    oldestDaysOverdue: 47, openInvoiceCount: 2, hasActivePlan: false, noteCount: 0,
  }],
};

beforeEach(() => {
  postBodies = [];
  global.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = req ? req.url : String(input);
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'POST' && url.includes('/collections/notes')) {
      let body: Record<string, unknown> = {};
      if (init?.body) body = JSON.parse(init.body as string);
      else if (req) { try { body = await req.clone().json(); } catch { /* none */ } }
      postBodies.push(body);
      return jsonResponse({ id: 'n1', patientId: PATIENT, branchId: BRANCH, note: body['note'], contactChannel: body['contactChannel'], contactedAt: '2026-06-19T00:00:00.000Z', createdAt: '2026-06-19T00:00:00.000Z' }, 201);
    }
    return jsonResponse(worklist);
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

function renderWorklist() {
  const qc = freshClientWithMutations();
  render(React.createElement(CollectionsWorklist, { branchId: BRANCH }), { wrapper: makeWrapper(qc) });
}

describe('CollectionsWorklist', () => {
  test('renders an overdue row with patient name and overdue amount', async () => {
    renderWorklist();
    expect(await screen.findByText('Sofia Cruz')).toBeDefined();
    expect(screen.getByText('47d')).toBeDefined();
  });

  test('Log → fill note → Save posts a collection note with channel + text', async () => {
    renderWorklist();
    await screen.findByText('Sofia Cruz');

    fireEvent.click(screen.getByTestId(`log-note-${PATIENT}`));
    fireEvent.change(screen.getByTestId(`log-channel-${PATIENT}`), { target: { value: 'email' } });
    fireEvent.change(screen.getByTestId(`log-text-${PATIENT}`), { target: { value: 'Emailed reminder' } });
    fireEvent.click(screen.getByTestId(`log-save-${PATIENT}`));

    await waitFor(() => expect(postBodies.length).toBeGreaterThan(0));
    expect(postBodies[0].patientId).toBe(PATIENT);
    expect(postBodies[0].contactChannel).toBe('email');
    expect(postBodies[0].note).toBe('Emailed reminder');
  });
});
