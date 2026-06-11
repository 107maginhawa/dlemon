/**
 * WorkspaceTopBar — E2 role-gated affordance test.
 *
 * dental_assistant works under dentist supervision: it may draft notes + manage
 * attachments, but must NOT prescribe, capture consent, or add/finalize
 * treatments. Those top-bar affordances (Rx / Consent / Treatment Plan) are
 * hidden for the assistant and visible for the dentist.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
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

// =============================================================================
// AHA dental-clinical FIX-001/002: the Lab + PMD affordances were dead props —
// declared and plumbed but never rendered, so the entire (tested) lab FSM and
// PMD viewer/import surfaces were unreachable. Both are dentist-gated (Lab
// matches the backend createLabOrder gate ['dentist_owner','dentist_associate'];
// PMD generation is dentist-only).
// =============================================================================

function renderBarWithSpies(role: DentalRole) {
  useOrgContextStore.setState({ role });
  const calls = { lab: 0, pmd: 0 };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(WorkspaceTopBar, {
        patientId: 'p-1',
        onRx: NOOP, onConsent: NOOP,
        onLab: () => { calls.lab++; },
        onPmd: () => { calls.pmd++; },
        onAttachments: NOOP, onNotes: NOOP, onTreatmentPlan: NOOP, onCompleteVisit: NOOP,
        visitStatus: 'active',
      }),
    ),
  );
  return calls;
}

describe('WorkspaceTopBar — Lab + PMD affordances (FIX-001/002)', () => {
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

  test('dentist sees a Lab button that fires onLab', async () => {
    const calls = renderBarWithSpies('dentist_owner');
    const lab = await screen.findByLabelText('Lab orders');
    fireEvent.click(lab);
    expect(calls.lab).toBe(1);
  });

  test('dentist sees a PMD button that fires onPmd', async () => {
    const calls = renderBarWithSpies('dentist_owner');
    const pmd = await screen.findByLabelText('Portable medical document');
    fireEvent.click(pmd);
    expect(calls.pmd).toBe(1);
  });

  test('dental_assistant sees neither Lab nor PMD (dentist-gated)', async () => {
    renderBarWithSpies('dental_assistant');
    await waitFor(() => expect(screen.getByLabelText('Attachments')).not.toBeNull());
    expect(screen.queryByLabelText('Lab orders')).toBeNull();
    expect(screen.queryByLabelText('Portable medical document')).toBeNull();
  });
});
