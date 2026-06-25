/**
 * ScheduleTimeline component tests
 *
 * Today's chair timeline: sorted rows (time · patient · service · status),
 * a now-line divider, and a humane empty state with CTAs.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ScheduleTimeline } from './schedule-timeline';

afterEach(cleanup);

const APPTS = [
  { id: 'a', patientId: 'p1', patientName: 'Maria Santos', scheduledAt: '2026-06-25T09:00:00Z', status: 'completed', serviceType: 'Cleaning', balanceCents: 0 },
  { id: 'b', patientId: 'p2', patientName: 'Juan Reyes', scheduledAt: '2026-06-25T11:00:00Z', status: 'scheduled', serviceType: 'RCT', balanceCents: 500000 },
];

describe('ScheduleTimeline', () => {
  test('renders a row per appointment, sorted by time', () => {
    render(
      React.createElement(ScheduleTimeline, {
        appointments: APPTS,
        now: new Date('2026-06-25T10:00:00Z'),
        showFinancials: true,
        onAdd: () => {},
        onViewWeek: () => {},
      }),
    );
    expect(screen.getByTestId('schedule-timeline')).toBeTruthy();
    expect(screen.getByText('Maria Santos')).toBeTruthy();
    expect(screen.getByText('Juan Reyes')).toBeTruthy();
    expect(screen.getByText('Cleaning')).toBeTruthy();
    expect(screen.getByText('RCT')).toBeTruthy();
  });

  test('renders the now-line divider at the right position (mid-day)', () => {
    render(
      React.createElement(ScheduleTimeline, {
        appointments: APPTS,
        now: new Date('2026-06-25T10:00:00Z'),
        showFinancials: true,
        onAdd: () => {},
        onViewWeek: () => {},
      }),
    );
    expect(screen.getByTestId('now-line')).toBeTruthy();
  });

  test('no now-line when now is after all appointments', () => {
    render(
      React.createElement(ScheduleTimeline, {
        appointments: APPTS,
        now: new Date('2026-06-25T15:00:00Z'),
        showFinancials: true,
        onAdd: () => {},
        onViewWeek: () => {},
      }),
    );
    expect(screen.queryByTestId('now-line')).toBeNull();
  });

  test('shows a balance flag when financial and balance > 0', () => {
    render(
      React.createElement(ScheduleTimeline, {
        appointments: APPTS,
        now: new Date('2026-06-25T10:00:00Z'),
        showFinancials: true,
        onAdd: () => {},
        onViewWeek: () => {},
      }),
    );
    expect(screen.getByTestId('appt-balance-flag-b')).toBeTruthy();
  });

  test('hides the balance flag when not financial (no financial data path)', () => {
    render(
      React.createElement(ScheduleTimeline, {
        appointments: APPTS,
        now: new Date('2026-06-25T10:00:00Z'),
        showFinancials: false,
        onAdd: () => {},
        onViewWeek: () => {},
      }),
    );
    expect(screen.queryByTestId('appt-balance-flag-b')).toBeNull();
  });

  test('empty state renders copy + Add appointment + View week CTAs', () => {
    const onAdd = mock(() => {});
    const onViewWeek = mock(() => {});
    render(
      React.createElement(ScheduleTimeline, {
        appointments: [],
        now: new Date('2026-06-25T10:00:00Z'),
        showFinancials: true,
        onAdd,
        onViewWeek,
      }),
    );
    expect(screen.getByText(/no appointments today/i)).toBeTruthy();
    const addBtn = screen.getByTestId('timeline-empty-add');
    const weekBtn = screen.getByTestId('timeline-empty-view-week');
    fireEvent.click(addBtn);
    fireEvent.click(weekBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onViewWeek).toHaveBeenCalledTimes(1);
  });
});
