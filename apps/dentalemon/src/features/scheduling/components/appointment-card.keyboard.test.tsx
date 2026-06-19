/**
 * AppointmentCard — keyboard activation (a11y).
 *
 * The card is a role="button" div; keyboard users must be able to open it
 * with Enter/Space the same as a click. Regression guard for the missing
 * onKeyDown handler.
 */
import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AppointmentCard, type Appointment } from './appointment-card';

afterEach(cleanup);

const APPT: Appointment = {
  id: 'appt-1',
  patientId: 'patient-abc',
  patientName: 'Maria Santos',
  scheduledAt: '2026-05-24T09:00:00.000Z',
  durationMinutes: 30,
  serviceType: 'Cleaning',
  status: 'scheduled',
};

describe('AppointmentCard keyboard activation', () => {
  test('Enter on the focused card fires onClick', async () => {
    const onClick = mock(() => {});
    render(React.createElement(AppointmentCard, { appointment: APPT, onClick }));
    const card = screen.getByRole('button', { name: /Maria Santos/i });
    card.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('Space on the focused card fires onClick', async () => {
    const onClick = mock(() => {});
    render(React.createElement(AppointmentCard, { appointment: APPT, onClick }));
    const card = screen.getByRole('button', { name: /Maria Santos/i });
    card.focus();
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
