/**
 * TreatmentTable — P0-D selected-tooth scoping + count coherence.
 *
 * Selecting a tooth scopes the bottom panel to that tooth. The chip count a user
 * reads must equal the number of rendered rows (the "summary ≠ body" bug class).
 * Written RED before the scoping is implemented.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase, assertCountMatchesItems } from '@/test-utils';

mock.module('sonner', () => ({ toast: { error: mock(() => {}), success: mock(() => {}) } }));

import { TreatmentTable } from './treatment-table';

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

const t = (id: string, toothNumber: number) => ({
  id, visitId: 'v-1', toothNumber,
  procedureCode: 'D2391', procedureName: 'Composite Filling',
  status: 'diagnosed' as const, priceAmount: 2500, currency: 'PHP',
  createdAt: '2024-01-10T09:00:00Z',
});

const TREATMENTS = [t('t-16a', 16), t('t-16b', 16), t('t-24', 24), t('t-36', 36)];

afterEach(cleanup);

function renderTable(props: Record<string, unknown>) {
  return render(
    React.createElement(TreatmentTable, { visitId: 'v-1', treatments: TREATMENTS, ...props }),
    { wrapper: makeWrapper() },
  );
}

describe('TreatmentTable — selected-tooth scoping (P0-D)', () => {
  test('with no selected tooth, all teeth render (unchanged)', () => {
    renderTable({});
    expect(screen.queryByTestId('tooth-filter-chip')).toBeNull();
    expect(screen.getAllByTestId(/^treatment-row-/).length).toBe(4);
  });

  test('selecting a tooth scopes the body to that tooth', () => {
    renderTable({ selectedTooth: 16 });
    const rows = screen.getAllByTestId(/^treatment-row-/);
    expect(rows.length).toBe(2); // only the two tooth-16 treatments
    expect(rows.every(r => r.textContent?.includes('16'))).toBe(true);
  });

  test('the chip count equals the rendered rows (coherence)', () => {
    renderTable({ selectedTooth: 16 });
    const rows = screen.getAllByTestId(/^treatment-row-/);
    const count = Number(screen.getByTestId('tooth-filter-count').textContent?.replace(/[^0-9]/g, ''));
    assertCountMatchesItems({ count, itemCount: rows.length, label: 'tooth filter count' });
  });

  test('Clear fires onClearToothFilter', async () => {
    const onClear = mock(() => {});
    renderTable({ selectedTooth: 16, onClearToothFilter: onClear });
    await userEvent.click(screen.getByTestId('tooth-filter-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('a tooth with no treatments shows a scoped empty state, not the generic one', () => {
    renderTable({ selectedTooth: 99, onClearToothFilter: mock(() => {}) });
    expect(screen.getByTestId('tooth-filter-empty').textContent).toContain('99');
    expect(screen.getByTestId('tooth-filter-clear')).toBeTruthy();
  });
});
