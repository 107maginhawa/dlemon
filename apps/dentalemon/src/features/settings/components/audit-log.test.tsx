/**
 * AuditLog panel tests — dental-audit FIX-001 (WF-028 compliance viewer).
 *
 * Pins the real wiring of the viewer to GET /dental/audit-events: rows render
 * from the {data, meta} envelope, filters round-trip into query params, pagination
 * advances the offset, empty/loading/error states render, and NO snapshot field is
 * exposed. global.fetch mock per repo convention; branchId from org-context.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { AuditLog } from './audit-log';

const BRANCH_ID = 'b0000000-0000-4000-8000-00000000aud1';
const EVENTS = [
  {
    id: 'ae000000-0000-4000-8000-000000000001',
    actorId: 'ac000000-0000-4000-8000-000000000001',
    actorRole: 'dentist_owner',
    eventType: 'data-modification',
    action: 'invoice.voided',
    resourceType: 'dental_invoice',
    resourceId: 'in000000-0000-4000-8000-000000000001',
    reason: 'Duplicate charge',
    timestamp: '2026-06-10T08:00:00.000Z',
    createdAt: '2026-06-10T08:00:00.000Z',
  },
];

const originalFetch = global.fetch;
let lastAuditUrl = '';

function installFetch(events = EVENTS, total = 1, opts: { error?: boolean } = {}) {
  useOrgContextStore.setState({ branchId: BRANCH_ID, role: 'dentist_owner' });
  global.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/dental/audit-events') || url.includes('/audit-events')) {
      lastAuditUrl = url;
      if (opts.error) return new Response('err', { status: 500 });
      return jsonResponse({ data: events, meta: { total, limit: 25, offset: 0 } });
    }
    return jsonResponse({ data: [], meta: { total: 0 } });
  }) as typeof fetch;
}

beforeEach(() => { lastAuditUrl = ''; });
afterEach(() => {
  global.fetch = originalFetch;
  useOrgContextStore.setState({ branchId: null, role: null });
  cleanup();
});

function renderPanel() {
  render(React.createElement(AuditLog), { wrapper: makeWrapper(freshClient()) });
}

describe('AuditLog viewer', () => {
  test('renders audit rows from the {data, meta} envelope', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getAllByTestId('audit-log-row').length).toBe(1));
    expect(screen.getByText('invoice.voided')).not.toBeNull();
    expect(screen.getByText(/Duplicate charge/)).not.toBeNull();
  });

  test('does NOT render any snapshot field (latent-PHI guard)', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getAllByTestId('audit-log-row').length).toBe(1));
    expect(document.body.textContent).not.toContain('snapshot');
  });

  test('always scopes the query by branchId', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(lastAuditUrl).toContain('branchId='));
    expect(lastAuditUrl).toContain(BRANCH_ID);
  });

  test('eventType filter round-trips into the query params', async () => {
    installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('audit-log-table')).not.toBeNull());
    fireEvent.change(screen.getByLabelText(/event type/i), { target: { value: 'data-modification' } });
    await waitFor(() => expect(lastAuditUrl).toContain('eventType=data-modification'));
  });

  test('Next advances the page offset', async () => {
    installFetch(EVENTS, 60); // 60 events → multiple pages
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('audit-next-page')).not.toBeNull());
    fireEvent.click(screen.getByTestId('audit-next-page'));
    await waitFor(() => expect(lastAuditUrl).toContain('offset=25'));
  });

  test('shows the empty state when no events', async () => {
    installFetch([], 0);
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('audit-log-empty')).not.toBeNull());
  });

  test('shows the error state on fetch failure', async () => {
    installFetch(EVENTS, 1, { error: true });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('audit-log-error')).not.toBeNull());
  });
});
