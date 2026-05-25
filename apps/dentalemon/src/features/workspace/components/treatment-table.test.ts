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

    test('calls onMarkDone with treatmentId and visitId when clicked', async () => {
      const user = userEvent.setup();
      const calls: Array<[string, string]> = [];
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING],
          onMarkDone: (tid: string, vid: string) => calls.push([tid, vid]),
        }),
        { wrapper: makeWrapper() },
      );

      await user.click(screen.getByTestId('mark-done-btn'));
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual([TREATMENT_PENDING.id, TREATMENT_PENDING.visitId]);
    });

    test('completed row shows check icon instead of Mark Done button', async () => {
      const user = userEvent.setup();
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_COMPLETED],
        }),
        { wrapper: makeWrapper() },
      );
      // Performed/verified rows are hidden by default — click "View Completed" to show them
      await user.click(screen.getByTestId('view-completed-btn'));
      expect(document.querySelector('[data-testid="icon-check"]')).not.toBeNull();
      expect(screen.queryByTestId('mark-done-btn')).toBeNull();
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
