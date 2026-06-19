/**
 * AnnotationInputDialog component tests
 *
 * Styled replacement for the native window.prompt() used by the label / tooth
 * annotation tools. Covers: open/closed, label free-text confirm, tooth
 * validation (valid / out-of-range / non-numeric keeps dialog open + inline
 * error), and cancel.
 *
 * Relies on the global test-setup stub of @radix-ui/react-dialog (the
 * @monobase/ui Dialog primitive) which renders role="dialog" when open.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AnnotationInputDialog } from './annotation-input-dialog';

afterEach(cleanup);

const DEFAULT_PROPS = {
  open: true,
  kind: 'label' as const,
  onConfirm: mock((_raw: string) => {}),
  onCancel: mock(() => {}),
};

beforeEach(() => {
  DEFAULT_PROPS.onConfirm = mock((_raw: string) => {});
  DEFAULT_PROPS.onCancel = mock(() => {});
});

function renderDialog(overrides: Record<string, unknown> = {}) {
  const props = { ...DEFAULT_PROPS, ...overrides };
  return render(React.createElement(AnnotationInputDialog, props));
}

describe('AnnotationInputDialog', () => {
  test('shows dialog when open=true', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.getByRole('heading', { name: /label text/i })).not.toBeNull();
  });

  test('does not render when open=false', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('shows tooth title/description for kind=tooth', () => {
    renderDialog({ kind: 'tooth' });
    expect(screen.getByRole('heading', { name: /tooth number/i })).not.toBeNull();
  });

  // ── Label (free text) ───────────────────────────────────────────────────

  test('label: confirms with the raw text and clears input', async () => {
    const user = userEvent.setup();
    const onConfirm = mock((_raw: string) => {});
    renderDialog({ onConfirm });

    const input = screen.getByPlaceholderText(/caries/i);
    await user.type(input, 'Distal caries');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]![0]).toBe('Distal caries');
    expect((input as HTMLInputElement).value).toBe('');
  });

  // ── Tooth (1–32 validation) ───────────────────────────────────────────────

  test('tooth: valid number confirms with the raw value', async () => {
    const user = userEvent.setup();
    const onConfirm = mock((_raw: string) => {});
    renderDialog({ kind: 'tooth', onConfirm });

    const input = screen.getByPlaceholderText(/e\.g\. 14/i);
    await user.type(input, '14');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]![0]).toBe('14');
  });

  test('tooth: out-of-range (>32) shows inline error and keeps dialog open', async () => {
    const user = userEvent.setup();
    const onConfirm = mock((_raw: string) => {});
    renderDialog({ kind: 'tooth', onConfirm });

    const input = screen.getByPlaceholderText(/e\.g\. 14/i);
    await user.type(input, '99');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).not.toBeNull();
    // Dialog stays open
    expect(screen.getByRole('dialog')).not.toBeNull();
  });

  test('tooth: zero is out of range — no confirm, inline error', async () => {
    const user = userEvent.setup();
    const onConfirm = mock((_raw: string) => {});
    renderDialog({ kind: 'tooth', onConfirm });

    const input = screen.getByPlaceholderText(/e\.g\. 14/i);
    await user.type(input, '0');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).not.toBeNull();
  });

  test('tooth: non-integer (decimal) is rejected', async () => {
    const user = userEvent.setup();
    const onConfirm = mock((_raw: string) => {});
    renderDialog({ kind: 'tooth', onConfirm });

    const input = screen.getByPlaceholderText(/e\.g\. 14/i);
    await user.type(input, '12.5');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).not.toBeNull();
  });

  // ── Cancel ────────────────────────────────────────────────────────────────

  test('cancel button calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = mock(() => {});
    renderDialog({ onCancel });

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
