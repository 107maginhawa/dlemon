/**
 * CalibrationDialog component tests
 *
 * Covers: open/closed, valid confirm, invalid inputs, cancel, disabled state.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CalibrationDialog } from './calibration-dialog';

afterEach(cleanup);

const DEFAULT_PROPS = {
  open: true,
  pixelDistance: 200.5,
  onConfirm: mock(() => {}),
  onCancel: mock(() => {}),
};

beforeEach(() => {
  DEFAULT_PROPS.onConfirm = mock(() => {});
  DEFAULT_PROPS.onCancel = mock(() => {});
});

function renderDialog(overrides: Record<string, unknown> = {}) {
  const props = { ...DEFAULT_PROPS, ...overrides };
  return render(React.createElement(CalibrationDialog, props));
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('CalibrationDialog', () => {
  test('shows dialog when open=true', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.getByText(/calibrate measurement/i)).not.toBeNull();
  });

  test('does not render when open=false', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('valid positive mm input confirms and clears', async () => {
    const user = userEvent.setup();
    const onConfirm = mock(() => {});
    renderDialog({ onConfirm });

    const input = screen.getByPlaceholderText(/e\.g\./i);
    await user.type(input, '10.5');

    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]![0]).toBe(10.5);
    // Input should be cleared after confirm
    expect((input as HTMLInputElement).value).toBe('');
  });

  test('invalid input (NaN) does NOT call onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = mock(() => {});
    renderDialog({ onConfirm });

    const input = screen.getByPlaceholderText(/e\.g\./i);
    await user.type(input, 'abc');

    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmBtn);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('zero input does NOT call onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = mock(() => {});
    renderDialog({ onConfirm });

    const input = screen.getByPlaceholderText(/e\.g\./i);
    await user.type(input, '0');

    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmBtn);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('negative input does NOT call onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = mock(() => {});
    renderDialog({ onConfirm });

    const input = screen.getByPlaceholderText(/e\.g\./i);
    await user.type(input, '-5');

    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmBtn);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('cancel button calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = mock(() => {});
    renderDialog({ onCancel });

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('confirm button disabled when input empty', () => {
    renderDialog();
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);
  });
});
