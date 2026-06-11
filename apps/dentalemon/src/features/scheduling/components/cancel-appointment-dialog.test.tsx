/**
 * CancelAppointmentDialog tests (FIX-001 / FR3.4)
 *
 * The cancel-reason dialog: enforces a 5–500 char reason (parity with the backend
 * DELETE cancel policy), surfaces errors, and emits the reason on confirm.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CancelAppointmentDialog } from './cancel-appointment-dialog';

afterEach(cleanup);

describe('CancelAppointmentDialog', () => {
  test('renders a reason field and confirm action when open', () => {
    render(
      React.createElement(CancelAppointmentDialog, {
        open: true,
        onClose: () => {},
        onConfirm: async () => {},
      }),
    );
    expect(screen.getByLabelText(/reason/i)).not.toBeNull();
    expect(screen.getByRole('button', { name: /cancel appointment/i })).not.toBeNull();
  });

  test('does not render when open is false', () => {
    render(
      React.createElement(CancelAppointmentDialog, {
        open: false,
        onClose: () => {},
        onConfirm: async () => {},
      }),
    );
    expect(screen.queryByLabelText(/reason/i)).toBeNull();
  });

  test('does not call onConfirm when reason is too short (<5 chars)', async () => {
    const user = userEvent.setup();
    const onConfirm = mock(async () => {});
    render(
      React.createElement(CancelAppointmentDialog, { open: true, onClose: () => {}, onConfirm }),
    );
    await user.type(screen.getByLabelText(/reason/i), 'no');
    await user.click(screen.getByRole('button', { name: /cancel appointment/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('calls onConfirm with the reason when valid', async () => {
    const user = userEvent.setup();
    const onConfirm = mock(async () => {});
    render(
      React.createElement(CancelAppointmentDialog, { open: true, onClose: () => {}, onConfirm }),
    );
    await user.type(screen.getByLabelText(/reason/i), 'Patient called to reschedule');
    await user.click(screen.getByRole('button', { name: /cancel appointment/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]![0]).toBe('Patient called to reschedule');
  });

  test('surfaces a server error', () => {
    render(
      React.createElement(CancelAppointmentDialog, {
        open: true,
        error: 'Could not cancel the appointment',
        onClose: () => {},
        onConfirm: async () => {},
      }),
    );
    expect(screen.getByText(/could not cancel/i)).not.toBeNull();
  });

  test('calls onClose when "Keep appointment" is clicked', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(
      React.createElement(CancelAppointmentDialog, { open: true, onClose, onConfirm: async () => {} }),
    );
    await user.click(screen.getByRole('button', { name: /keep appointment/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
