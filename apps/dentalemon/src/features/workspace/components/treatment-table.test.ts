/**
 * TreatmentTable — Phase 3 TDD tests
 *
 * RED state: these FAIL on current code (no header, static Done column, no Grand Total).
 * GREEN state: tests pass after Phase 3 adds header, Mark Done button, Grand Total row.
 *
 * Phase 3 spec:
 *   - Header section with "Treatment Breakdown" text
 *   - "View Completed (N)" button when N > 0 (data-testid="view-completed-btn")
 *   - "Mark Done" button for non-completed treatments (data-testid="mark-done-btn")
 *   - Clicking "Mark Done" calls onMarkDone(treatmentId, visitId)
 *   - Completed rows show checkmark, NOT a "Mark Done" button
 *   - Grand Total row (data-testid="grand-total-row") showing sum of all prices
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, renderHook, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import { TreatmentTable } from './treatment-table';
import { useUpdateTreatment } from '../hooks/use-update-treatment';

const _toastError = mock(() => {});
mock.module('sonner', () => ({ toast: { error: _toastError } }));

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

// ── Fixtures ─────────────────────────────────────────────────────────────

const TREATMENT_PENDING = {
  id: 't-pending',
  visitId: 'v-1',
  toothNumber: 16,
  procedureCode: 'D2391',
  procedureName: 'Composite Filling',
  status: 'diagnosed' as const,
  priceAmount: 2500,
  currency: 'PHP',
  createdAt: '2024-01-10T09:00:00Z',
};

const TREATMENT_COMPLETED = {
  id: 't-completed',
  visitId: 'v-1',
  toothNumber: 24,
  procedureCode: 'D2710',
  procedureName: 'Porcelain Crown',
  status: 'performed' as const, // impl uses 'performed'|'verified' for "done" rows
  priceAmount: 4000,
  currency: 'PHP',
  createdAt: '2024-01-10T09:00:00Z',
};

afterEach(cleanup);

// ── Tests ─────────────────────────────────────────────────────────────────

describe('TreatmentTable — Phase 3', () => {
  describe('Treatment Breakdown header', () => {
    test('renders "Treatment Breakdown" heading', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING],
        }),
        { wrapper: makeWrapper() },
      );
      expect(screen.getByText('Treatment Breakdown')).not.toBeNull();
    });

    test('renders "View Completed (N)" button when completed treatments exist', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_COMPLETED, TREATMENT_PENDING],
        }),
        { wrapper: makeWrapper() },
      );
      expect(screen.getByTestId('view-completed-btn')).not.toBeNull();
      expect(screen.getByTestId('view-completed-btn').textContent).toContain('1');
    });

    test('does not render "View Completed" button when no completed treatments', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING],
        }),
        { wrapper: makeWrapper() },
      );
      expect(screen.queryByTestId('view-completed-btn')).toBeNull();
    });
  });

  describe('Mark Done interactive column', () => {
    test('renders "Mark Done" button for non-completed treatment', () => {
      render(
        React.createElement(TreatmentTable, {
          visitId: 'v-1', // WR-01: interactive controls require an active visit
          treatments: [TREATMENT_PENDING],
        }),
        { wrapper: makeWrapper() },
      );
      expect(screen.getByTestId('mark-done-btn')).not.toBeNull();
    });

    test('does NOT render "Mark Done" button for completed treatment', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_COMPLETED],
        }),
        { wrapper: makeWrapper() },
      );
      expect(screen.queryByTestId('mark-done-btn')).toBeNull();
    });

    test('clicking "Mark Done" issues a treatment-status mutation', async () => {
      // The component advances status via useMarkTreatmentDone (not the legacy
      // onMarkDone prop, which is retained only for API compat). Assert the click
      // fires a request against the treatments endpoint.
      const user = userEvent.setup();
      const urls: string[] = [];
      const originalFetch = global.fetch;
      global.fetch = mock((req: Request | string | URL) => {
        const url = req instanceof Request ? req.url : String(req);
        urls.push(url);
        return jsonResponse({ ...TREATMENT_PENDING, status: 'planned' });
      }) as unknown as typeof fetch;
      try {
        render(
          React.createElement(TreatmentTable, {
            visitId: 'v-1', // WR-01: interactive controls require an active visit
            treatments: [TREATMENT_PENDING],
          }),
          { wrapper: makeWrapper() },
        );

        await user.click(screen.getByTestId('mark-done-btn'));
        await waitFor(() =>
          expect(urls.some((u) => u.includes('/treatments'))).toBe(true),
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('all-completed visit shows the row by default (no toggle needed)', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_COMPLETED],
        }),
        { wrapper: makeWrapper() },
      );
      // No pending work → completed rows are visible without any toggle click,
      // so the table never sits empty beneath a non-zero total. The now-pointless
      // "View Completed" toggle is hidden.
      expect(screen.getByTestId(`treatment-row-${TREATMENT_COMPLETED.id}`)).not.toBeNull();
      expect(screen.queryByTestId('view-completed-btn')).toBeNull();
      expect(document.querySelector('[data-testid="icon-check"]')).not.toBeNull();
      expect(screen.queryByTestId('mark-done-btn')).toBeNull();
    });

    test('mixed visit hides completed by default; toggle reveals them', async () => {
      const user = userEvent.setup();
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_COMPLETED, TREATMENT_PENDING],
        }),
        { wrapper: makeWrapper() },
      );
      // pending visible, completed hidden by default
      expect(screen.getByTestId(`treatment-row-${TREATMENT_PENDING.id}`)).not.toBeNull();
      expect(screen.queryByTestId(`treatment-row-${TREATMENT_COMPLETED.id}`)).toBeNull();
      // toggle present and reveals the completed row
      await user.click(screen.getByTestId('view-completed-btn'));
      expect(screen.getByTestId(`treatment-row-${TREATMENT_COMPLETED.id}`)).not.toBeNull();
    });

    test('does not render Mark Done button when readOnly=true', () => { // [BR-007] [BR-003]
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING],
          readOnly: true,
        }),
        { wrapper: makeWrapper() },
      );
      expect(screen.queryByTestId('mark-done-btn')).toBeNull();
    });
  });

  describe('Grand Total row', () => {
    test('renders grand-total-row element', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING, TREATMENT_COMPLETED],
        }),
        { wrapper: makeWrapper() },
      );
      expect(screen.getByTestId('grand-total-row')).not.toBeNull();
    });

    test('grand total is sum of all treatment prices', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING, TREATMENT_COMPLETED],
        }),
        { wrapper: makeWrapper() },
      );
      // 2500 + 4000 = 6500
      const row = screen.getByTestId('grand-total-row');
      expect(row.textContent).toContain('6,500');
    });

    test('grand total row is not rendered when treatments is empty', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [],
        }),
        { wrapper: makeWrapper() },
      );
      expect(screen.queryByTestId('grand-total-row')).toBeNull();
    });
  });

  // Cross-element coherence invariant — the class-catcher.
  // A money total a human reads must be explained by a visible line item. A non-zero
  // Grand Total with an empty body ("amount but no service") is the bug we are fixing,
  // and this guards the whole class across the data states our forward-building flows
  // never visit (all-completed / locked history in particular).
  describe('invariant: non-zero grand total ⇒ at least one visible line item', () => {
    const CARRIED_OVER = {
      id: 't-carried-inv',
      visitId: 'v-prev',
      toothNumber: 36,
      cdtCode: 'D2710',
      description: 'Crown (PFM) — carried over',
      status: 'diagnosed' as const,
      priceCents: 600000,
      surfaces: null,
      conditionCode: null,
      carriedOver: true,
    };
    const cases: Array<{ name: string; props: React.ComponentProps<typeof TreatmentTable> }> = [
      { name: 'all-pending', props: { treatments: [TREATMENT_PENDING] } },
      { name: 'all-completed', props: { treatments: [TREATMENT_COMPLETED] } },
      { name: 'mixed', props: { treatments: [TREATMENT_PENDING, TREATMENT_COMPLETED] } },
      { name: 'carried-over-only', props: { treatments: [], carriedOverItems: [CARRIED_OVER] } },
    ];
    for (const c of cases) {
      test(`${c.name}: money shown is backed by a visible row`, () => {
        render(React.createElement(TreatmentTable, c.props), { wrapper: makeWrapper() });
        const totalRow = screen.queryByTestId('grand-total-row');
        if (!totalRow) return; // no total → nothing owed, nothing to explain
        const amount = Number((totalRow.textContent ?? '').replace(/[^0-9.]/g, '')) || 0;
        if (amount <= 0) return;
        const treatmentRows = document.querySelectorAll('[data-testid^="treatment-row-"]').length;
        const carriedRows = c.props.carriedOverItems?.length ?? 0;
        // money on screen ⇒ at least one line item visible to explain it
        expect(treatmentRows + carriedRows).toBeGreaterThan(0);
      });
    }
  });

  // [BR-008] Carried-over treatments from previous visits are visually distinguished
  test('[BR-008] renders carried-over treatments in the table', () => {
    const carriedOver = {
      id: 't-carried',
      visitId: 'v-prev',
      toothNumber: 36,
      cdtCode: 'D2710',
      description: 'Crown (PFM) — carried over',
      status: 'diagnosed' as const,
      priceCents: 600000,
      surfaces: null,
      conditionCode: null,
      carriedOver: true,
    };

    render(
      React.createElement(TreatmentTable, {
        treatments: [],
        carriedOverItems: [carriedOver],
      }),
      { wrapper: makeWrapper() },
    );

    // BR-008: carried-over item must appear in the rendered table
    expect(screen.getByText(/Crown \(PFM\)/i)).not.toBeNull();
  });

  // FIX-002 coherence: once carry-over actually runs, the copied rows live in the
  // CURRENT visit (so they arrive in `treatments` with carriedOver=true) AND surface
  // in the plan-derived `carriedOverItems`. The table must render + total each such
  // row ONCE (carried section only) — never double-display it as a this-visit row or
  // double-count it in the Grand Total. (Guards the summary-vs-body bug class for the
  // overlap state the disjoint fixtures above never visit.)
  test('[FIX-002] a carried-over row present in both treatments and carriedOverItems is counted once', () => {
    const carried = {
      id: 't-co-dup',
      visitId: 'v-current',
      toothNumber: 36,
      cdtCode: 'D2710',
      description: 'CarryDup Crown',
      status: 'diagnosed' as const,
      priceCents: 600000,
      surfaces: null,
      conditionCode: null,
      carriedOver: true,
    };
    render(
      React.createElement(TreatmentTable, {
        visitId: 'v-current',
        // same logical row, as the current visit's treatments list returns it
        treatments: [{ ...carried, priceAmount: 6000 }],
        carriedOverItems: [carried],
      }),
      { wrapper: makeWrapper() },
    );
    // rendered exactly once — in the carried section, NOT also as a this-visit row
    expect(screen.getAllByText(/CarryDup Crown/).length).toBe(1);
    expect(screen.queryByTestId('treatment-row-t-co-dup')).toBeNull();
    // grand total counts it once (6,000), never doubled (12,000)
    const total = screen.getByTestId('grand-total-row').textContent ?? '';
    expect(total).toContain('6,000');
    expect(total).not.toContain('12,000');
  });
});

// ── P1-003: useUpdateTreatment onError toast ──────────────────────────────────

describe('useUpdateTreatment onError (P1-003)', () => {
  const origFetch = global.fetch;
  afterEach(() => { global.fetch = origFetch; });

  test('AC-003: calls toast.error when treatment update fails', async () => {
    const callsBefore = _toastError.mock.calls.length;
    global.fetch = mock(() => jsonResponse({ message: 'Server error' }, 500)) as unknown as typeof fetch;

    const { result } = renderHook(
      () => useUpdateTreatment('v-1'),
      { wrapper: makeWrapper() },
    );

    result.current.mutate({ path: { visitId: 'v-1', treatmentId: 't-1' }, body: { status: 'dismissed' } } as any);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(_toastError.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
