/**
 * PinSelect component tests
 *
 * Tests rendering of member cards, filtering by branch, and selection callback.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { PinSelect } from './pin-select';

afterEach(cleanup);

const members = [
  { id: 'mem-1', displayName: 'Dr. Ramon Cruz', role: 'dentist_owner' as const },
  { id: 'mem-2', displayName: 'Ana Reyes', role: 'staff_full' as const },
  { id: 'mem-3', displayName: 'Ben Santos', role: 'staff_scheduling' as const },
];

describe('PinSelect', () => {
  test('renders a card for each member', () => {
    render(React.createElement(PinSelect, { members, onSelect: () => {} }));
    expect(screen.getByText('Dr. Ramon Cruz')).toBeTruthy();
    expect(screen.getByText('Ana Reyes')).toBeTruthy();
    expect(screen.getByText('Ben Santos')).toBeTruthy();
  });

  test('renders role badge for each member', () => {
    render(React.createElement(PinSelect, { members, onSelect: () => {} }));
    // Should show human-readable role
    expect(screen.getByText(/Dentist.Owner/i)).toBeTruthy();
  });

  test('renders avatar initials from displayName', () => {
    render(React.createElement(PinSelect, { members: [members[0]!], onSelect: () => {} }));
    // "Dr. Ramon Cruz" → initials "RC" or "DR"
    const avatar = screen.getByTestId('member-avatar-mem-1');
    expect(avatar.textContent).toBeTruthy();
  });

  test('calls onSelect with member when card is clicked', () => {
    const onSelect = mock(() => {});
    render(React.createElement(PinSelect, { members, onSelect }));

    fireEvent.click(screen.getByText('Ana Reyes'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toEqual(members[1]);
  });

  test('renders empty state when no members provided', () => {
    render(React.createElement(PinSelect, { members: [], onSelect: () => {} }));
    expect(screen.getByTestId('pin-select-empty')).toBeTruthy();
  });

  test('renders "Choose your profile" heading', () => {
    render(React.createElement(PinSelect, { members, onSelect: () => {} }));
    expect(screen.getByText(/Choose your profile/i)).toBeTruthy();
  });

  test('each member card has accessible role="button"', () => {
    render(React.createElement(PinSelect, { members, onSelect: () => {} }));
    const buttons = screen.getAllByRole('button');
    // At minimum one button per member
    expect(buttons.length).toBeGreaterThanOrEqual(members.length);
  });
});
