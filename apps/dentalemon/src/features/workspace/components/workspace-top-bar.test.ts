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
      }),
    ),
  );
}

// =============================================================================
// PP-7 (ISSUE-042): chairside dental alerts. Active alerts render as badges in
// the top-bar safety area, and an always-present "Alerts" button opens the
// manage sheet via onAlerts.
// =============================================================================

describe('WorkspaceTopBar — dental alerts (PP-7 / ISSUE-042)', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    useOrgContextStore.setState({ role: null });
    cleanup();
  });

  function renderBarRouted(role: DentalRole, onAlerts: () => void) {
    useOrgContextStore.setState({ role });
    // Route GET /dental-alerts → one active alert; everything else → empty.
    global.fetch = mock(async (req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : String(req);
      if (url.includes('/dental-alerts')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'al-1', version: 1, patientId: 'p-1', alertType: 'needle_phobia', severity: 'high', description: null, active: true, createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(WorkspaceTopBar, {
          patientId: 'p-1',
          onRx: NOOP, onConsent: NOOP, onLab: NOOP, onPmd: NOOP,
          onAttachments: NOOP, onNotes: NOOP, onTreatmentPlan: NOOP,
          onAlerts,
        }),
      ),
    );
  }

  test('renders an active dental-alert badge from listDentalAlerts', async () => {
    renderBarRouted('dentist_owner', NOOP);
    await waitFor(() => expect(screen.getByTestId('dental-alert-badges')).not.toBeNull());
    expect(screen.getByText('Needle phobia')).not.toBeNull();
  });

  test('the Alerts button fires onAlerts', async () => {
    let opened = 0;
    renderBarRouted('dentist_owner', () => { opened++; });
    const btn = await screen.findByLabelText('Alerts');
    fireEvent.click(btn);
    expect(opened).toBe(1);
  });
});

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
        onAttachments: NOOP, onNotes: NOOP, onTreatmentPlan: NOOP,
      }),
    ),
  );
  return calls;
}

// Lab + PMD are v2-deferred (workspace.lab_orders / workspace.pmd). These RBAC
// tests force the flags ON so they isolate the *role* gate, not the v1 flag gate.
function setFlag(key: string, val: string | undefined) {
  const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
  if (val === undefined) delete env[key];
  else env[key] = val;
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env = env;
}

describe('WorkspaceTopBar — Lab + PMD affordances (FIX-001/002)', () => {
  beforeEach(() => {
    setFlag('VITE_FF_WORKSPACE_LAB_ORDERS', 'true');
    setFlag('VITE_FF_WORKSPACE_PMD', 'true');
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    mockFetch.mockImplementation(emptyResponse);
  });
  afterEach(() => {
    setFlag('VITE_FF_WORKSPACE_LAB_ORDERS', undefined);
    setFlag('VITE_FF_WORKSPACE_PMD', undefined);
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

describe('WorkspaceTopBar — v1 feature-flag gating (Lab/PMD deferred)', () => {
  beforeEach(() => {
    // No flags set → v1 defaults (OFF).
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

  test('at v1 default (flags OFF), even a dentist sees neither Lab nor PMD', async () => {
    renderBarWithSpies('dentist_owner');
    // The v1 home-base affordances still render…
    await waitFor(() => expect(screen.getByLabelText('Attachments')).not.toBeNull());
    // …but the deferred tools are gated off.
    expect(screen.queryByLabelText('Lab orders')).toBeNull();
    expect(screen.queryByLabelText('Portable medical document')).toBeNull();
  });
});

// =============================================================================
// AHA dental-clinical FIX-008 (GAP-11): Notes / Medical History + Attachments are
// VIEW + supervised-draft ENTRY POINTS, not pure write launchers — they open
// SoapNotesSheet / AttachmentsSheet, which a view-capable role may legitimately open
// to review the record (write is gated backend-403 + Sign inside the notes sheet).
// Per ROLE_PERMISSION_MATRIX these must NOT be role-hidden in the top bar. These pins
// lock that intent so a future "blindly hide Notes/MH" change can't regress a role's
// VIEW access, while the 5 dentist-only WRITE launchers stay hidden for non-writers.
// =============================================================================

describe('WorkspaceTopBar — Notes/Attachments view-entry-point parity (FIX-008)', () => {
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

  // staff_full has "Clinical Workspace: View-only" + records payments + may upload
  // attachments (matrix). It must KEEP the Notes + Attachments view entry points but
  // see NONE of the dentist-only write launchers (Rx / Consent / Treatment Plan / Lab / PMD).
  test('staff_full (view-only workspace) SEES Notes + Attachments, HIDES all 5 write launchers', async () => {
    renderBar('staff_full');
    await waitFor(() => expect(screen.getByLabelText('Notes / Medical History')).not.toBeNull());
    expect(screen.getByLabelText('Attachments')).not.toBeNull();
    // All dentist-only write launchers hidden.
    expect(screen.queryByLabelText('Write prescription')).toBeNull();
    expect(screen.queryByLabelText('Consent')).toBeNull();
    expect(screen.queryByLabelText('Treatment Plan')).toBeNull();
    expect(screen.queryByLabelText('Lab orders')).toBeNull();
    expect(screen.queryByLabelText('Portable medical document')).toBeNull();
  });

  // The Notes + Attachments entry points are present for BOTH a writer (dentist_owner)
  // and a supervised assistant (dental_assistant) — view access is not role-hidden.
  test('Notes + Attachments stay visible across writer and supervised-assistant roles', async () => {
    for (const role of ['dentist_owner', 'dental_assistant'] as const) {
      renderBar(role);
      await waitFor(() => expect(screen.getByLabelText('Notes / Medical History')).not.toBeNull());
      expect(screen.getByLabelText('Attachments')).not.toBeNull();
      cleanup();
    }
  });
});
