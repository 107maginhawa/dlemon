/**
 * ListErrorState component tests
 *
 * Shared error UI for list/table surfaces. Distinct from EmptyState:
 * renders a concise error message + a Retry button wired to onRetry.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ListErrorState } from './list-error-state';

afterEach(cleanup);

describe('ListErrorState', () => {
  test('renders the provided message', () => {
    render(React.createElement(ListErrorState, { message: 'Boom', onRetry: () => {} }));
    expect(screen.getByText('Boom')).not.toBeNull();
  });

  test('renders a fallback message when none provided', () => {
    render(React.createElement(ListErrorState, { onRetry: () => {} }));
    expect(screen.getByTestId('list-error-state')).not.toBeNull();
    expect(screen.getByRole('alert')).not.toBeNull();
  });

  test('renders a Retry button that calls onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = mock(() => {});
    render(React.createElement(ListErrorState, { message: 'Failed', onRetry }));
    const btn = screen.getByTestId('list-error-retry');
    expect(btn).not.toBeNull();
    await user.click(btn);
    expect(onRetry).toHaveBeenCalled();
  });
});
