/**
 * SoapNotesSheet — E2/E3 role-gated affordance test.
 *
 * E2: On a GENERAL visit the Sign & Lock button is dentist-only. dental_assistant
 * may DRAFT (Save is still present) but must NOT see Sign & Lock. dentist_owner
 * sees both.
 *
 * E3: On a HYGIENE visit the hygienist may ALSO sign — Sign & Lock is shown for
 * the hygienist on hygiene visits, but NOT on general visits. This keeps the UI
 * honest with the visitType-scoped backend signVisitNotes gate.
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

function renderSheet(role: DentalRole, visitType: 'general' | 'hygiene' = 'general') {
  useOrgContextStore.setState({ role });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(SoapNotesSheet, { visitId: 'v-1', open: true, onClose: () => {}, visitType }),
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

  // ─── E3: hygienist sign authority is scoped to hygiene visits ───────────────

  test('hygienist CANNOT see Sign & Lock on a GENERAL visit', async () => {
    renderSheet('hygienist', 'general');
    await waitFor(() => expect(screen.getByLabelText('Save SOAP notes')).not.toBeNull());
    expect(screen.queryByTestId('sign-lock-btn')).toBeNull();
  });

  test('hygienist CAN see Sign & Lock on a HYGIENE visit', async () => {
    renderSheet('hygienist', 'hygiene');
    expect(await screen.findByTestId('sign-lock-btn')).not.toBeNull();
    expect(screen.getByLabelText('Save SOAP notes')).not.toBeNull();
  });

  test('dentist_owner SEES Sign & Lock on a hygiene visit too (gate is not narrower)', async () => {
    renderSheet('dentist_owner', 'hygiene');
    expect(await screen.findByTestId('sign-lock-btn')).not.toBeNull();
  });
});
