/**
 * BillingList — error-state rendering (V-FE-ERR-002)
 *
 * Asserts that when the invoices query fails, the list surfaces a distinct
 * error state with a Retry control — NOT the "No invoices found" empty state.
 *
 * Uses global.fetch mocking (no mock.module) per repo convention.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { BillingList } from './billing-list';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

function renderList() {
  const qc = freshClient();
  // branchId is required to enable the invoices query (enabled: !!branchId);
  // without it the query never runs and neither error nor empty state resolves.
  render(React.createElement(BillingList, { branchId: 'b1' }), { wrapper: makeWrapper(qc) });
  return qc;
}

describe('BillingList — error state', () => {
  test('shows error state (not empty state) when the query fails', async () => {
    global.fetch = mock(() => Promise.resolve(new Response('boom', { status: 500 })));
    renderList();
    await waitFor(() => expect(screen.getByTestId('billing-list-error')).not.toBeNull());
    expect(screen.getByTestId('list-error-retry')).not.toBeNull();
    // Must NOT collapse to the empty "No invoices found." state
    expect(screen.queryByText(/No invoices found/i)).toBeNull();
  });

  test('shows empty state (not error state) when the query succeeds with no invoices', async () => {
    global.fetch = mock(() => jsonResponse({ data: [] }));
    renderList();
    await waitFor(() => expect(screen.getByText(/No invoices found/i)).not.toBeNull());
    expect(screen.queryByTestId('billing-list-error')).toBeNull();
  });
});
