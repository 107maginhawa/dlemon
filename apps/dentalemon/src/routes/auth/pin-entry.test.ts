/**
 * PinEntry component tests
 *
 * Tests the PIN entry keypad: digit input, 6-dot display, submit on completion,
 * error on wrong PIN, lockout display.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PinEntry } from './pin-entry.$memberId';

afterEach(cleanup);

const member = { id: 'mem-1', displayName: 'Dr. Ramon Cruz', role: 'dentist_owner' as const };

describe('PinEntry', () => {
  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  test('renders member name and role', () => {
    render(React.createElement(PinEntry, { member, onSubmit: async () => {}, onBack: () => {} }));
    expect(screen.getByText('Dr. Ramon Cruz')).not.toBeNull();
  });

  test('renders 6 PIN dot indicators', () => {
    render(React.createElement(PinEntry, { member, onSubmit: async () => {}, onBack: () => {} }));
    const dots = screen.getAllByTestId(/pin-dot/);
    expect(dots.length).toBe(6);
  });

  test('renders a keypad with digits 0-9', () => {
    render(React.createElement(PinEntry, { member, onSubmit: async () => {}, onBack: () => {} }));
    for (let i = 0; i <= 9; i++) {
      expect(screen.getByLabelText(String(i))).not.toBeNull();
    }
  });

  test('renders back navigation button', () => {
    render(React.createElement(PinEntry, { member, onSubmit: async () => {}, onBack: () => {} }));
    expect(screen.getByTestId('pin-back-btn')).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // PIN input interaction
  // --------------------------------------------------------------------------

  test('pressing a digit fills a dot', async () => {
    const user = userEvent.setup();
    render(React.createElement(PinEntry, { member, onSubmit: async () => {}, onBack: () => {} }));
    await user.click(screen.getByLabelText('1'));
    const filledDots = screen.getAllByTestId(/pin-dot/).filter(d => d.getAttribute('data-filled') === 'true');
    expect(filledDots.length).toBe(1);
  });

  test('calls onSubmit with the 6-digit PIN when complete', async () => {
    const user = userEvent.setup();
    const onSubmit = mock(async () => ({ success: true, failedAttempts: 0 }));
    render(React.createElement(PinEntry, { member, onSubmit, onBack: () => {} }));

    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      await user.click(screen.getByLabelText(digit));
    }

    // Wait for async submit
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onSubmit).toHaveBeenCalledWith('123456');
  });

  test('backspace removes last digit', async () => {
    const user = userEvent.setup();
    render(React.createElement(PinEntry, { member, onSubmit: async () => {}, onBack: () => {} }));
    await user.click(screen.getByLabelText('5'));
    await user.click(screen.getByLabelText('5'));
    await user.click(screen.getByTestId('pin-backspace-btn'));

    const filledDots = screen.getAllByTestId(/pin-dot/).filter(d => d.getAttribute('data-filled') === 'true');
    expect(filledDots.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Error and lockout states
  // --------------------------------------------------------------------------

  test('shows error message when errorMessage prop is provided', () => {
    render(React.createElement(PinEntry, {
      member,
      onSubmit: async () => {},
      onBack: () => {},
      errorMessage: 'Incorrect PIN. 2 attempts remaining.',
    }));
    expect(screen.getByText(/Incorrect PIN/i)).not.toBeNull();
  });

  test('shows lockout message and hides keypad when lockedUntil is set', () => {
    const lockedUntil = new Date(Date.now() + 30_000); // 30s in future
    render(React.createElement(PinEntry, {
      member,
      onSubmit: async () => {},
      onBack: () => {},
      lockedUntil,
    }));
    expect(screen.getByTestId('pin-lockout-message')).not.toBeNull();
    expect(screen.queryByLabelText('1')).toBeNull(); // keypad hidden
  });

  test('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = mock(() => {});
    render(React.createElement(PinEntry, { member, onSubmit: async () => {}, onBack }));
    await user.click(screen.getByTestId('pin-back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
