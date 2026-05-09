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
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

// lucide-react: stub Check icon only
mock.module('lucide-react', () => ({
  Check: ({ className }: { className?: string }) =>
    React.createElement('span', { 'data-testid': 'check-icon', className }),
}));

const { TreatmentTable } = await import('./treatment-table');

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
  status: 'completed' as const,
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
      );
      expect(screen.getByText('Treatment Breakdown')).toBeTruthy();
    });

    test('renders "View Completed (N)" button when completed treatments exist', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_COMPLETED, TREATMENT_PENDING],
        }),
      );
      expect(screen.getByTestId('view-completed-btn')).toBeTruthy();
      expect(screen.getByTestId('view-completed-btn').textContent).toContain('1');
    });

    test('does not render "View Completed" button when no completed treatments', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING],
        }),
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
      );
      expect(screen.getByTestId('mark-done-btn')).toBeTruthy();
    });

    test('does NOT render "Mark Done" button for completed treatment', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_COMPLETED],
        }),
      );
      expect(screen.queryByTestId('mark-done-btn')).toBeNull();
    });

    test('calls onMarkDone with treatmentId and visitId when clicked', () => {
      const calls: Array<[string, string]> = [];
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING],
          onMarkDone: (tid: string, vid: string) => calls.push([tid, vid]),
        }),
      );

      fireEvent.click(screen.getByTestId('mark-done-btn'));
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual([TREATMENT_PENDING.id, TREATMENT_PENDING.visitId]);
    });

    test('completed row shows check icon instead of Mark Done button', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_COMPLETED],
        }),
      );
      expect(screen.getByTestId('check-icon')).toBeTruthy();
      expect(screen.queryByTestId('mark-done-btn')).toBeNull();
    });

    test('does not render Mark Done button when readOnly=true', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING],
          readOnly: true,
        }),
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
      );
      expect(screen.getByTestId('grand-total-row')).toBeTruthy();
    });

    test('grand total is sum of all treatment prices', () => {
      render(
        React.createElement(TreatmentTable, {
          treatments: [TREATMENT_PENDING, TREATMENT_COMPLETED],
        }),
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
      );
      expect(screen.queryByTestId('grand-total-row')).toBeNull();
    });
  });
});
