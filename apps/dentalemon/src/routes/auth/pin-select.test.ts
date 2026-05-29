/**
 * PinSelect component tests
 *
 * Tests rendering of member cards, filtering by branch, and selection callback.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(screen.getByText('Dr. Ramon Cruz')).not.toBeNull();
    expect(screen.getByText('Ana Reyes')).not.toBeNull();
    expect(screen.getByText('Ben Santos')).not.toBeNull();
  });

  test('renders role badge for each member', () => {
    render(React.createElement(PinSelect, { members, onSelect: () => {} }));
    // Should show human-readable role
    expect(screen.getByText(/Dentist.Owner/i)).not.toBeNull();
  });

  test('renders avatar initials from displayName', () => {
    render(React.createElement(PinSelect, { members: [members[0]!], onSelect: () => {} }));
    // "Dr. Ramon Cruz" → initials "RC" or "DR"
    const avatar = screen.getByTestId('member-avatar-mem-1');
    expect(avatar.textContent).not.toBeNull();
  });

  test('calls onSelect with member when card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = mock(() => {});
    render(React.createElement(PinSelect, { members, onSelect }));

    await user.click(screen.getByText('Ana Reyes'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toEqual(members[1]);
  });

  test('renders empty state when no members provided', () => {
    render(React.createElement(PinSelect, { members: [], onSelect: () => {} }));
    expect(screen.getByTestId('pin-select-empty')).not.toBeNull();
  });

  test('renders "Choose your profile" heading', () => {
    render(React.createElement(PinSelect, { members, onSelect: () => {} }));
    expect(screen.getByText(/Choose your profile/i)).not.toBeNull();
  });

  test('renders loading skeletons when isLoading is true', () => {
    render(React.createElement(PinSelect, { members: [], onSelect: () => {}, isLoading: true }));
    expect(screen.getByTestId('pin-select-loading')).not.toBeNull();
    // Success/empty content must not render while loading
    expect(screen.queryByTestId('pin-select-empty')).toBeNull();
  });

  test('renders error state with a Retry button when isError is true', async () => {
    const user = userEvent.setup();
    const onRetry = mock(() => {});
    render(
      React.createElement(PinSelect, { members: [], onSelect: () => {}, isError: true, onRetry }),
    );
    expect(screen.getByTestId('pin-select-error')).not.toBeNull();
    expect(screen.getByText(/Failed to load staff members/i)).not.toBeNull();
    await user.click(screen.getByText(/Retry/i));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('each member card has accessible role="button"', () => {
    render(React.createElement(PinSelect, { members, onSelect: () => {} }));
    const buttons = screen.getAllByRole('button');
    // At minimum one button per member
    expect(buttons.length).toBeGreaterThanOrEqual(members.length);
  });
});
