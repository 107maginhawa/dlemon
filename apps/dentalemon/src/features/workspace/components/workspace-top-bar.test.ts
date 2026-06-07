/**
 * WorkspaceTopBar — E2 role-gated affordance test.
 *
 * dental_assistant works under dentist supervision: it may draft notes + manage
 * attachments, but must NOT prescribe, capture consent, or add/finalize
 * treatments. Those top-bar affordances (Rx / Consent / Treatment Plan) are
 * hidden for the assistant and visible for the dentist.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { WorkspaceTopBar } from './workspace-top-bar';
import { useOrgContextStore } from '@/stores/org-context.store';
import type { DentalRole } from '@/lib/rbac';

const originalFetch = global.fetch;

// Return empty/benign payloads — the test only asserts affordance presence.
function emptyResponse() {
  return Promise.resolve(
    new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}
const mockFetch = mock(emptyResponse);

const NOOP = () => {};

function renderBar(role: DentalRole) {
  useOrgContextStore.setState({ role });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(WorkspaceTopBar, {
        patientId: 'p-1',
        onRx: NOOP,
        onConsent: NOOP,
        onLab: NOOP,
        onPmd: NOOP,
        onAttachments: NOOP,
        onNotes: NOOP,
        onTreatmentPlan: NOOP,
        onCompleteVisit: NOOP,
        visitStatus: 'active',
      }),
    ),
  );
}

describe('WorkspaceTopBar — dentist-only affordance gate (E2)', () => {
  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    mockFetch.mockImplementation(emptyResponse);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    useOrgContextStore.setState({ role: null });
    cleanup();
    mockFetch.mockReset();
  });

  test('dentist_owner SEES Rx, Consent, Treatment Plan (+ Notes, Attachments)', async () => {
    renderBar('dentist_owner');
    await waitFor(() => expect(screen.getByLabelText('Notes / Medical History')).not.toBeNull());
    expect(screen.getByLabelText('Write prescription')).not.toBeNull();
    expect(screen.getByLabelText('Consent')).not.toBeNull();
    expect(screen.getByLabelText('Treatment Plan')).not.toBeNull();
    expect(screen.getByLabelText('Attachments')).not.toBeNull();
  });

  test('dental_assistant HIDES Rx, Consent, Treatment Plan but KEEPS Notes + Attachments', async () => {
    renderBar('dental_assistant');
    // Notes + Attachments stay (assistant may draft notes + manage attachments).
    await waitFor(() => expect(screen.getByLabelText('Notes / Medical History')).not.toBeNull());
    expect(screen.getByLabelText('Attachments')).not.toBeNull();
    // Dentist-only affordances are hidden.
    expect(screen.queryByLabelText('Write prescription')).toBeNull();
    expect(screen.queryByLabelText('Consent')).toBeNull();
    expect(screen.queryByLabelText('Treatment Plan')).toBeNull();
  });
});
