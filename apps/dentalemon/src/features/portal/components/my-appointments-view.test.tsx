/**
 * MyAppointmentsView tests (E4 portal).
 *
 * Covers the pure formatting helpers + the rendered states (loading / data /
 * empty / error). Uses global.fetch mocking (no mock.module) per repo
 * convention. The view shows ONLY patient-appropriate fields — the tests pin
 * that staff-only fields never reach the DOM (affordance honesty).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import {
  MyAppointmentsView,
  formatVisitType,
  formatStatusLabel,
  statusVariant,
  formatAppointmentWhen,
} from './my-appointments-view';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

function renderView() {
  const qc = freshClient();
  render(React.createElement(MyAppointmentsView), { wrapper: makeWrapper(qc) });
  return qc;
}

const APPT_A = {
  id: 'appt-a',
  branchId: 'b1',
  startAt: '2030-01-10T09:00:00.000Z',
  endAt: '2030-01-10T09:30:00.000Z',
  visitType: 'checkup',
  status: 'scheduled',
  confirmedAt: null,
};

describe('MyAppointmentsView helpers', () => {
  test('formatVisitType capitalizes', () => {
    expect(formatVisitType('checkup')).toBe('Checkup');
    expect(formatVisitType('')).toBe('Visit');
  });

  test('formatStatusLabel humanizes snake_case', () => {
    expect(formatStatusLabel('no_show')).toBe('No Show');
    expect(formatStatusLabel('checked_in')).toBe('Checked In');
  });

  test('statusVariant maps terminal-negative to destructive', () => {
    expect(statusVariant('cancelled')).toBe('destructive');
    expect(statusVariant('no_show')).toBe('destructive');
    expect(statusVariant('confirmed')).toBe('default');
    expect(statusVariant('completed')).toBe('secondary');
  });

  test('formatAppointmentWhen handles invalid date', () => {
    expect(formatAppointmentWhen('not-a-date')).toBe('—');
  });
});

describe('MyAppointmentsView rendering', () => {
  test('shows loading skeletons first', () => {
    global.fetch = mock(() => new Promise(() => {})); // never resolves
    renderView();
    expect(screen.getByTestId('portal-appointments-loading')).not.toBeNull();
  });

  test('renders the patient own appointments', async () => {
    global.fetch = mock(() => jsonResponse([APPT_A]));
    renderView();
    await waitFor(() => expect(screen.getByTestId('portal-appointments-list')).not.toBeNull());
    expect(screen.getByText('Checkup')).not.toBeNull();
    expect(screen.getAllByTestId('portal-appointment-card').length).toBe(1);
  });

  test('projection honesty: no staff-only fields are rendered', async () => {
    // Even if the API ever leaked a staff field, the view must not surface it.
    const leaky = { ...APPT_A, dentistMemberId: 'SECRET-STAFF-ID', notes: 'internal staff note' };
    global.fetch = mock(() => jsonResponse([leaky]));
    renderView();
    await waitFor(() => expect(screen.getByTestId('portal-appointments-list')).not.toBeNull());
    expect(screen.queryByText(/SECRET-STAFF-ID/)).toBeNull();
    expect(screen.queryByText(/internal staff note/)).toBeNull();
  });

  test('empty state when no appointments', async () => {
    global.fetch = mock(() => jsonResponse([]));
    renderView();
    await waitFor(() => expect(screen.getByTestId('portal-appointments-empty')).not.toBeNull());
    expect(screen.queryByTestId('portal-appointments-list')).toBeNull();
  });

  test('error state (e.g. 403 not-a-patient) shows a denial message, not empty', async () => {
    global.fetch = mock(() => Promise.resolve(new Response('forbidden', { status: 403 })));
    renderView();
    await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());
    expect(screen.queryByTestId('portal-appointments-empty')).toBeNull();
  });
});
