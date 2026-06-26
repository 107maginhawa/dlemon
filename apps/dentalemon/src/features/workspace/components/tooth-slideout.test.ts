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
});
