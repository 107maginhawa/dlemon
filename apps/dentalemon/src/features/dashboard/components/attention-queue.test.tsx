/**
 * AttentionQueue component tests
 *
 * Renders derived action items (unconfirmed, checked-in, overdue balances,
 * lab due, plans behind). Financial items hidden when showFinancials=false.
 * Empty queue shows a calm "All clear."
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AttentionQueue } from './attention-queue';
import type { AttentionItem } from './morning-briefing.helpers';

afterEach(cleanup);

const ITEMS: AttentionItem[] = [
  { id: 'unconfirmed', label: 'unconfirmed', count: 2, tone: 'info', route: '/calendar' },
  { id: 'checked-in', label: 'checked in', count: 1, tone: 'info', route: '/calendar' },
  { id: 'overdue-balances', label: 'overdue balances', count: 3, tone: 'destructive', route: '/billing' },
];

describe('AttentionQueue', () => {
  test('renders an item per attention entry', () => {
    render(
      React.createElement(AttentionQueue, { items: ITEMS, onSelect: () => {} }),
    );
    expect(screen.getByTestId('attention-queue')).toBeTruthy();
    expect(screen.getByTestId('attention-item-unconfirmed')).toBeTruthy();
    expect(screen.getByTestId('attention-item-checked-in')).toBeTruthy();
    expect(screen.getByTestId('attention-item-overdue-balances')).toBeTruthy();
  });

  test('clicking an item invokes onSelect with its route', () => {
    const onSelect = mock((_route: string) => {});
    render(
      React.createElement(AttentionQueue, { items: ITEMS, onSelect }),
    );
    fireEvent.click(screen.getByTestId('attention-item-overdue-balances'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('/billing');
  });

  test('empty queue shows All clear', () => {
    render(
      React.createElement(AttentionQueue, { items: [], onSelect: () => {} }),
    );
    expect(screen.getByTestId('attention-queue')).toBeTruthy();
    expect(screen.getByText(/all clear/i)).toBeTruthy();
  });
});
