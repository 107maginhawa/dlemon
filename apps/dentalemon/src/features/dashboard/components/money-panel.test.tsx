/**
 * MoneyPanel tests — momentum (MTD collected) + what's-slipping (overdue w/ names).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MoneyPanel } from './money-panel';
import type { MoneyPanelOverdue } from './money-panel';

afterEach(cleanup);

const overdue: MoneyPanelOverdue[] = [
  { id: 'i1', patientId: 'p1', patientName: 'Sofia Cruz', balanceCents: 520000 },
  { id: 'i2', patientId: 'p2', patientName: 'Elena Garcia', balanceCents: 120000 },
  { id: 'i3', patientId: 'p3', patientName: 'Carlos Mendoza', balanceCents: 80000 },
  { id: 'i4', patientId: 'p4', patientName: 'Miguel Torres', balanceCents: 30000 },
];

describe('MoneyPanel', () => {
  test('shows month-to-date collected', () => {
    render(<MoneyPanel monthCollectedCents={1234500} overdue={[]} onViewBilling={() => {}} />);
    expect(screen.getByTestId('money-collected').textContent).toContain('12,345');
  });

  test('shows ₱— when collected is unknown', () => {
    render(<MoneyPanel monthCollectedCents={null} overdue={[]} onViewBilling={() => {}} />);
    expect(screen.getByTestId('money-collected').textContent).toContain('₱—');
  });

  test('empty overdue shows a calm all-clear, not a dead box', () => {
    render(<MoneyPanel monthCollectedCents={0} overdue={[]} onViewBilling={() => {}} />);
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
    expect(screen.queryByTestId('money-overdue-summary')).toBeNull();
  });

  test('overdue: totals all balances, lists top 3 by amount, and a "+more"', () => {
    render(<MoneyPanel monthCollectedCents={0} overdue={overdue} onViewBilling={() => {}} />);
    // total = 7,500.00
    expect(screen.getByTestId('money-overdue-summary').textContent).toContain('7,500');
    expect(screen.getByTestId('money-overdue-summary').textContent).toContain('4 patients');
    // top 3 by amount present, the smallest folded into "+1 more"
    expect(screen.getByText('Sofia Cruz')).toBeTruthy();
    expect(screen.getByText('Elena Garcia')).toBeTruthy();
    expect(screen.getByText('Carlos Mendoza')).toBeTruthy();
    expect(screen.queryByText('Miguel Torres')).toBeNull();
    expect(screen.getByText(/\+1 more/)).toBeTruthy();
  });

  test('selecting an overdue patient fires onSelectOverdue', () => {
    const onSelect = mock(() => {});
    render(
      <MoneyPanel monthCollectedCents={0} overdue={overdue} onViewBilling={() => {}} onSelectOverdue={onSelect} />,
    );
    fireEvent.click(screen.getByTestId('money-overdue-i1'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
