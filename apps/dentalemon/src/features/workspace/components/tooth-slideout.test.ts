// ToothSlideout — unit tests

import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { ToothSlideout } from './tooth-slideout';

afterEach(cleanup);

function baseProps(overrides: Partial<React.ComponentProps<typeof ToothSlideout>> = {}) {
  return {
    toothNumber: 11,
    open: true,
    onClose: () => {},
    onSave: async () => {},
    ...overrides,
  };
}

describe('ToothSlideout', () => {
  test('renders null when open is false', () => {
    render(React.createElement(ToothSlideout, baseProps({ open: false })));
    expect(screen.queryByTestId('tooth-slideout')).toBeNull();
  });

  test('renders slideout panel when open and toothNumber is set', () => {
    render(React.createElement(ToothSlideout, baseProps()));
    expect(screen.getByTestId('tooth-slideout')).toBeTruthy();
  });

  test('condition step shows all 9 TOOTH_STATES as buttons', () => {
    render(React.createElement(ToothSlideout, baseProps()));
    for (const label of ['Healthy', 'Caries', 'Fractured', 'Filled', 'Crown', 'Missing', 'Implant', 'Extracted', 'Watchlist']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  test('resets to first step when toothNumber prop changes', () => {
    const { rerender } = render(React.createElement(ToothSlideout, baseProps({ toothNumber: 11 })));
    // Select a state so the Next button is enabled, then advance to step 2
    fireEvent.click(screen.getByText('Healthy'));
    fireEvent.click(screen.getByText(/2\. surface/i));
    // Confirm we left the condition step (Tooth State label gone)
    expect(screen.queryByText('Tooth State')).toBeNull();
    // Rerender with different tooth — should reset to condition step
    rerender(React.createElement(ToothSlideout, baseProps({ toothNumber: 21 })));
    // Condition step shows 'Tooth State' label
    expect(screen.getByText('Tooth State')).toBeTruthy();
  });

  test('treatment step contains a price input field', () => {
    const { container } = render(React.createElement(ToothSlideout, baseProps()));
    // Select a state to enable Next
    fireEvent.click(screen.getByText('Healthy'));
    // Navigate to treatment step directly via step button
    fireEvent.click(screen.getByText(/3\. treatment/i));
    // Price input is a number input with id="treatment-price"
    const priceInput = container.querySelector('input[type="number"]');
    expect(priceInput).toBeTruthy();
  });
});
