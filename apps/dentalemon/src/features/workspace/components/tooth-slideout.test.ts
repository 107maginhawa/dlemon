// ToothSlideout — unit tests
//
// Step flow is now: overview → surface (condition+surfaces) → treatment (CDT) → review

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ToothSlideout } from './tooth-slideout';
import { freshClientWithMutations, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';

afterEach(cleanup);

// Stub fetch so useToothHistory does not error in tests
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

function baseProps(overrides: Partial<React.ComponentProps<typeof ToothSlideout>> = {}) {
  return {
    toothNumber: 11,
    patientId: 'patient-test-1',
    open: true,
    onClose: () => {},
    onSave: async () => {},
    ...overrides,
  };
}

describe('ToothSlideout', () => {
  test('renders null when open is false', () => {
    // No history fetch needed when closed
    render(React.createElement(ToothSlideout, baseProps({ open: false })), { wrapper: makeWrapper() });
    expect(screen.queryByTestId('tooth-slideout')).toBeNull();
  });

  test('renders slideout panel when open and toothNumber is set', () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps()), { wrapper: makeWrapper() });
    expect(screen.getByTestId('tooth-slideout')).not.toBeNull();
  });

  test('first step is overview — shows tooth FDI number', () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ toothNumber: 36 })), { wrapper: makeWrapper() });
    // Overview shows the FDI number large
    expect(screen.getByText('36')).not.toBeNull();
  });

  test('overview step (step 1) shows all 9 condition options', async () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps()), { wrapper: makeWrapper() });
    // Condition picker is visible in overview step — labels from TOOTH_STATES
    for (const label of ['Caries', 'Crown', 'Missing', 'Implant', 'Watchlist', 'Healthy']) {
      expect(screen.getByText(label)).not.toBeNull();
    }
  });

  test('resets to overview step when toothNumber prop changes', async () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    const { rerender } = render(React.createElement(ToothSlideout, baseProps({ toothNumber: 11 })), { wrapper: makeWrapper() });
    // Initially shows tooth 11
    expect(screen.getByText('11')).not.toBeNull();
    // Rerender with different tooth — should reset to overview
    rerender(React.createElement(ToothSlideout, baseProps({ toothNumber: 21 })));
    // Overview step shows FDI number "21"
    expect(screen.getByText('21')).not.toBeNull();
    // Tooth 11 label is gone
    expect(screen.queryByText('11')).toBeNull();
  });

  test('step 2 (treatment) shows CDT search input after navigating via Next', async () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(React.createElement(ToothSlideout, baseProps()), { wrapper: makeWrapper() });

    // Surface pills render with data-testid="surface-{name}" (e.g. "surface-buccal")
    const surfaceBtn = screen.getByTestId('surface-buccal');
    expect(surfaceBtn, 'Surface tab button must exist in overview step').not.toBeNull();
    await user.click(surfaceBtn);

    // Select Caries condition — this enables Next
    await user.click(screen.getByText('Caries'));

    // Next button must be present and clickable
    const nextBtn = screen.getByText('Next');
    expect(nextBtn, 'Next button must be present after selecting a condition').not.toBeNull();
    await user.click(nextBtn);

    // CDT browser search input must appear in step 2
    expect(screen.getByPlaceholderText(/search cdt/i)).not.toBeNull();
  });

  test('footer shows Cancel on step 1', async () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps()), { wrapper: makeWrapper() });
    // Step 1 (overview): footer shows Cancel
    expect(screen.getByText('Cancel')).not.toBeNull();
    // Next button exists but is disabled (no condition assigned yet)
    const nextBtn = screen.queryByText('Next');
    expect(nextBtn).not.toBeNull();
  });

  // QA-003: the history table reads surfaces / treatmentStatus / treatmentPriceCents
  // straight off the typed SDK ToothHistoryEntry (no invented FE fields). This
  // asserts those columns render real data so the dead-column escape can't recur.
  test('QA-003: history table renders surfaces, status and price from the API', async () => {
    global.fetch = mock(() => jsonResponse({
      data: [{
        visitId: 'v1', visitDate: '2024-03-01T00:00:00Z', toothNumber: 11,
        state: 'filled', treatmentDescription: 'Resin composite',
        surfaces: ['mesial', 'occlusal'], treatmentStatus: 'performed', treatmentPriceCents: 12500,
      }],
      pagination: { totalCount: 1, limit: 20, offset: 0 },
    })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps()), { wrapper: makeWrapper() });

    // Surface initials: mesial + occlusal → "MO"
    expect(await screen.findByText('MO')).not.toBeNull();
    // Status badge for a performed treatment — locked vocab "Treated" (was "Done")
    expect(screen.getByText('Treated')).not.toBeNull();
    // ₱125.00 appears in the row and the Total footer (12500 cents / 100)
    expect(screen.getAllByText(/₱125\.00/).length).toBeGreaterThanOrEqual(2);
  });

  // Phase-1 card layout: the Treatment Breakdown is a stacked card list (not a
  // 6-column table). Each visit-event is a card that labels the two axes
  // SEPARATELY — a "Condition" field AND a "State" field — per the two-axis model.
  // The old table emits a single "Condition" column header and NO "State" label,
  // so this fails on the table and passes once cards render.
  test('Phase-1: breakdown renders per-visit cards with separately-labeled Condition and State', async () => {
    global.fetch = mock(() => jsonResponse({
      data: [{
        visitId: 'v1', visitDate: '2026-06-27T00:00:00Z', toothNumber: 11,
        state: 'watchlist', treatmentDescription: 'Periodic oral evaluation',
        surfaces: [], treatmentStatus: 'planned', treatmentPriceCents: 80000,
        eventKind: 'treatment',
      }],
      pagination: { totalCount: 1, limit: 20, offset: 0 },
    })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps()), { wrapper: makeWrapper() });

    // One card per visit-event (testid the table never emitted)
    const card = await screen.findByTestId('breakdown-card-v1-0');
    expect(card).not.toBeNull();
    // Two-axis model: BOTH a "Condition" and a "State" labeled field WITHIN the card.
    // The table only had a "Condition" column header and never a "State" label.
    const within = (label: string) =>
      Array.from(card.querySelectorAll('span')).some((el) => el.textContent === label);
    expect(within('State')).toBe(true);
    expect(within('Condition')).toBe(true);
  });

  // P4 + FIX-007: the read-only Add-Amendment affordance must render only when a
  // visitId AND a resolvable originalRecordId are supplied. The amendment validator
  // requires originalRecordId to be a real UUID, so showing the button without one
  // would file a 400 (empty-UUID). Footer renders it on `readOnly && visitId &&
  // originalRecordId`.
  test('FIX-007: shows "Add Amendment" in read-only mode when visitId + originalRecordId are present', () => {
    global.fetch = mock(() => jsonResponse({ data: [], pagination: { totalCount: 0, limit: 20, offset: 0 } })) as unknown as typeof fetch;
    render(
      React.createElement(ToothSlideout, baseProps({ readOnly: true, visitId: 'v1', originalRecordId: 'f1000000-0000-4000-8000-000000000099' })),
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText('Add Amendment')).not.toBeNull();
  });

  test('P4: omits "Add Amendment" in read-only mode when no visitId is present', () => {
    global.fetch = mock(() => jsonResponse({ data: [], pagination: { totalCount: 0, limit: 20, offset: 0 } })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ readOnly: true })), { wrapper: makeWrapper() });
    expect(screen.queryByText('Add Amendment')).toBeNull();
  });

  // FIX-007 coherence: a visitId without a resolvable originalRecordId (e.g. a tooth
  // with no treatment record on this visit) must NOT show "Add Amendment" — there is
  // no record to amend, and an empty originalRecordId 400s. The read-only amendments
  // LIST still renders so existing corrections remain visible (FR1.16 "both visible").
  test('FIX-007: omits "Add Amendment" when readOnly+visitId but no originalRecordId, yet still shows the list', () => {
    global.fetch = mock(() => jsonResponse({ data: [], pagination: { totalCount: 0, limit: 20, offset: 0 } })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ readOnly: true, visitId: 'v1' })), { wrapper: makeWrapper() });
    expect(screen.queryByText('Add Amendment')).toBeNull();
    expect(screen.getByTestId('amendments-list')).not.toBeNull();
  });

  // FIX-007: the read-only review area surfaces the visit's amendments (corrections)
  // alongside the original record — the orphan listAmendments is now consumed.
  test('FIX-007: renders the AmendmentsList in read-only mode when a visitId is present', () => {
    global.fetch = mock(() => jsonResponse({ data: [], pagination: { totalCount: 0, limit: 20, offset: 0 } })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ readOnly: true, visitId: 'v1' })), { wrapper: makeWrapper() });
    expect(screen.getByTestId('amendments-list')).not.toBeNull();
  });

  // The list is read-only review scaffolding — it must NOT appear during active charting.
  test('FIX-007: does not render the AmendmentsList in edit (non-readOnly) mode', () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ visitId: 'v1' })), { wrapper: makeWrapper() });
    expect(screen.queryByTestId('amendments-list')).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P2-D / P2-E — in-panel edit mode (Advance / Decline / Dismiss), gated.
  // ───────────────────────────────────────────────────────────────────────────

  // A single treatment-kind entry with a treatmentId (P2-C) so the panel has a
  // PATCH handle. Used by the edit-mode tests below.
  function treatmentHistoryResponse(overrides: Record<string, unknown> = {}) {
    return jsonResponse({
      data: [{
        visitId: 'v1', visitDate: '2026-06-27T00:00:00Z', toothNumber: 11,
        state: 'caries', treatmentDescription: 'Resin composite restoration',
        surfaces: ['buccal'], treatmentStatus: 'planned', treatmentPriceCents: 80000,
        eventKind: 'treatment', treatmentId: 't-1000',
        ...overrides,
      }],
      pagination: { totalCount: 1, limit: 20, offset: 0 },
    });
  }

  // P2-D: the Edit toggle appears only when the chart is open (!readOnly && visitId)
  // AND there is at least one treatment-kind row to act on. With an open chart and a
  // treatment row, the deliberate "Edit" toggle is present (read is default).
  test('P2-D: shows an Edit toggle when chart is open, a visitId is set, and a treatment row exists', async () => {
    global.fetch = mock(() => treatmentHistoryResponse()) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ visitId: 'v1' })), { wrapper: makeWrapper() });
    // Wait for the breakdown card to load, then the Edit toggle must exist.
    await screen.findByTestId('breakdown-card-v1-0');
    expect(screen.getByTestId('breakdown-edit-toggle')).not.toBeNull();
    // Read is default — no per-card action row until Edit is tapped.
    expect(screen.queryByTestId('card-action-mark-done')).toBeNull();
  });

  // P2-D: with NO treatment rows (only a finding), the Edit toggle is hidden —
  // there is nothing to advance/decline/dismiss.
  test('P2-D: hides the Edit toggle when the only history row is a finding', async () => {
    global.fetch = mock(() => treatmentHistoryResponse({ eventKind: 'finding', treatmentId: undefined, treatmentStatus: undefined })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ visitId: 'v1' })), { wrapper: makeWrapper() });
    await screen.findByTestId('breakdown-card-v1-0');
    expect(screen.queryByTestId('breakdown-edit-toggle')).toBeNull();
  });

  // P2-D: tapping Edit reveals per-card actions on TREATMENT cards only. A planned
  // treatment shows "Mark Done" (the next FSM step), plus Decline and Dismiss.
  test('P2-D: edit mode reveals Advance/Decline/Dismiss on a planned treatment card', async () => {
    global.fetch = mock(() => treatmentHistoryResponse()) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(React.createElement(ToothSlideout, baseProps({ visitId: 'v1' })), { wrapper: makeWrapper() });
    await screen.findByTestId('breakdown-card-v1-0');
    await user.click(screen.getByTestId('breakdown-edit-toggle'));
    // status='planned' → the advance button reads "Mark Done" (single FSM step).
    expect(screen.getByTestId('card-action-mark-done')).not.toBeNull();
    expect(screen.getByText('Mark Done')).not.toBeNull();
    // Decline + Dismiss reuse the proven popover triggers.
    expect(screen.getByTestId('card-action-decline')).not.toBeNull();
    expect(screen.getByTestId('card-action-dismiss')).not.toBeNull();
  });

  // P2-D: a diagnosed treatment advances in TWO FSM steps — the first step is
  // labelled "Mark Planned" (never a single jump to performed, which 422s).
  test('P2-D: a diagnosed treatment shows "Mark Planned" as the first advance step', async () => {
    global.fetch = mock(() => treatmentHistoryResponse({ treatmentStatus: 'diagnosed' })) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(React.createElement(ToothSlideout, baseProps({ visitId: 'v1' })), { wrapper: makeWrapper() });
    await screen.findByTestId('breakdown-card-v1-0');
    await user.click(screen.getByTestId('breakdown-edit-toggle'));
    expect(screen.getByText('Mark Planned')).not.toBeNull();
  });

  // P2-D: a performed treatment exposes no advance/decline action — it reads a
  // static "Treated" affordance instead (Treated is sticky; never reverts).
  test('P2-D: a performed treatment shows no advance/decline action in edit mode', async () => {
    global.fetch = mock(() => treatmentHistoryResponse({ treatmentStatus: 'performed' })) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(React.createElement(ToothSlideout, baseProps({ visitId: 'v1' })), { wrapper: makeWrapper() });
    await screen.findByTestId('breakdown-card-v1-0');
    await user.click(screen.getByTestId('breakdown-edit-toggle'));
    expect(screen.queryByTestId('card-action-mark-done')).toBeNull();
    expect(screen.queryByTestId('card-action-decline')).toBeNull();
    expect(screen.getByText('✓ Treated')).not.toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P2-B — the Overview/Treatment/Review stepper is the ADD-A-NEW-ENTRY wizard.
  // It must show ONLY when recording on an OPEN chart (!readOnly && visitId).
  // When readOnly OR no visitId (reading history / closed chart) the stepper
  // indicator is hidden and only the Overview content renders.
  // ───────────────────────────────────────────────────────────────────────────

  test('P2-B: shows the stepper indicator when chart is open (!readOnly && visitId)', () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ visitId: 'v1' })), { wrapper: makeWrapper() });
    expect(screen.getByTestId('tooth-stepper-indicator')).not.toBeNull();
  });

  test('P2-B: hides the stepper indicator when readOnly (closed chart)', () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ readOnly: true, visitId: 'v1' })), { wrapper: makeWrapper() });
    expect(screen.queryByTestId('tooth-stepper-indicator')).toBeNull();
  });

  test('P2-B: hides the stepper indicator when no visitId is present (reading history)', () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps()), { wrapper: makeWrapper() });
    expect(screen.queryByTestId('tooth-stepper-indicator')).toBeNull();
  });

  // P2-B: even with the stepper hidden, the Overview content (breakdown cards) still
  // renders — hiding the wizard chrome must not hide the read content.
  test('P2-B: still renders Overview breakdown content when the stepper is hidden (readOnly)', async () => {
    global.fetch = mock(() => jsonResponse({
      data: [{
        visitId: 'v1', visitDate: '2026-06-27T00:00:00Z', toothNumber: 11,
        state: 'watchlist', treatmentDescription: 'Periodic oral evaluation',
        surfaces: [], treatmentStatus: 'planned', treatmentPriceCents: 80000,
        eventKind: 'treatment',
      }],
      pagination: { totalCount: 1, limit: 20, offset: 0 },
    })) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ readOnly: true, visitId: 'v1' })), { wrapper: makeWrapper() });
    expect(screen.queryByTestId('tooth-stepper-indicator')).toBeNull();
    expect(await screen.findByTestId('breakdown-card-v1-0')).not.toBeNull();
  });

  // P2-E: a closed chart (readOnly) renders NO Edit toggle and NO per-card actions,
  // and shows a visible "Chart closed — corrections via Amendment" banner so the
  // locked state is legible (not just an absence of buttons).
  test('P2-E: readOnly hides all edit affordances and shows the chart-closed banner', async () => {
    global.fetch = mock(() => treatmentHistoryResponse()) as unknown as typeof fetch;
    render(React.createElement(ToothSlideout, baseProps({ readOnly: true, visitId: 'v1' })), { wrapper: makeWrapper() });
    await screen.findByTestId('breakdown-card-v1-0');
    // No edit toggle, no actions.
    expect(screen.queryByTestId('breakdown-edit-toggle')).toBeNull();
    expect(screen.queryByTestId('card-action-mark-done')).toBeNull();
    expect(screen.queryByTestId('card-action-decline')).toBeNull();
    expect(screen.queryByTestId('card-action-dismiss')).toBeNull();
    // Visible banner routing to the amendment path.
    const banner = screen.getByTestId('chart-closed-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('Chart closed');
  });
});
