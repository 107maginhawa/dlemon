/**
 * SoapNotesSheet — E2 role-gated affordance test.
 *
 * The Sign & Lock button is dentist-only. dental_assistant may DRAFT (Save is
 * still present) but must NOT see Sign & Lock. dentist_owner sees both.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { SoapNotesSheet } from './soap-notes-sheet';
import { useOrgContextStore } from '@/stores/org-context.store';
import type { DentalRole } from '@/lib/rbac';

const originalFetch = global.fetch;

// Return an UNSIGNED note so the editable footer (Save + Sign & Lock) renders.
function unsignedNoteResponse() {
  return Promise.resolve(
    new Response(
      JSON.stringify({
        id: 'note-1',
        visitId: 'v-1',
        subjective: 'S',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
        notes: '',
        signed: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
}
const mockFetch = mock(unsignedNoteResponse);

function renderSheet(role: DentalRole) {
  useOrgContextStore.setState({ role });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(SoapNotesSheet, { visitId: 'v-1', open: true, onClose: () => {} }),
    ),
  );
}

describe('SoapNotesSheet — Sign & Lock role gate (E2)', () => {
  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    mockFetch.mockImplementation(unsignedNoteResponse);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    useOrgContextStore.setState({ role: null });
    cleanup();
    mockFetch.mockReset();
  });

  test('dentist_owner SEES Sign & Lock and Save (draft)', async () => {
    renderSheet('dentist_owner');
    // Save (draft) is always available to writers.
    expect(await screen.findByTestId('sign-lock-btn')).not.toBeNull();
    expect(screen.getByLabelText('Save SOAP notes')).not.toBeNull();
  });

  test('dental_assistant CANNOT see Sign & Lock but CAN Save (draft)', async () => {
    renderSheet('dental_assistant');
    // Wait for the editable footer to be present (Save renders for the assistant).
    await waitFor(() => expect(screen.getByLabelText('Save SOAP notes')).not.toBeNull());
    // Sign & Lock must NOT be in the DOM for the assistant.
    expect(screen.queryByTestId('sign-lock-btn')).toBeNull();
  });
});
