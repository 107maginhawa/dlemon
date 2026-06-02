/**
 * Test #5 — PerioSiteCell.
 *
 * The editable depth/GM cell:
 *   - typing a digit commits the depth and requests auto-advance
 *   - depth clamps to 0–20 (21 → 20)
 *   - non-numeric input is rejected
 *   - over-threshold depth renders with text-destructive (red-line)
 *   - read-only mode renders a non-editable value
 *   - aria-label describes tooth + site
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PerioSiteCell } from './perio-site-cell';

afterEach(cleanup);

function renderCell(props: Partial<React.ComponentProps<typeof PerioSiteCell>> = {}) {
  const onCommit = mock(() => {});
  const onAdvance = mock(() => {});
  render(
    <PerioSiteCell
      tooth={16}
      site="BM"
      kind="depth"
      value={props.value ?? null}
      threshold={5}
      readOnly={props.readOnly ?? false}
      onCommit={onCommit}
      onAdvance={onAdvance}
      {...props}
    />,
  );
  return { onCommit, onAdvance };
}

describe('PerioSiteCell', () => {
  test('has an aria-label describing tooth + site', () => {
    renderCell();
    expect(screen.getByLabelText(/Tooth 16 mesiobuccal depth/i)).not.toBeNull();
  });

  test('typing a digit commits the depth value', async () => {
    const user = userEvent.setup();
    const { onCommit } = renderCell();
    const input = screen.getByLabelText(/Tooth 16 mesiobuccal depth/i);
    await user.type(input, '4');
    expect(onCommit).toHaveBeenCalledWith(4);
  });

  test('clamps an out-of-range depth (21 → 20)', async () => {
    const user = userEvent.setup();
    const { onCommit } = renderCell();
    const input = screen.getByLabelText(/depth/i);
    await user.type(input, '21');
    // last commit is the clamped value
    const calls = onCommit.mock.calls as unknown as number[][];
    expect(calls[calls.length - 1][0]).toBe(20);
  });

  test('rejects non-numeric characters', async () => {
    const user = userEvent.setup();
    const { onCommit } = renderCell();
    const input = screen.getByLabelText(/depth/i) as HTMLInputElement;
    await user.type(input, 'a');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  test('over-threshold depth renders text-destructive', () => {
    renderCell({ value: 6, threshold: 5 });
    const input = screen.getByLabelText(/depth/i);
    expect(input.className).toContain('text-destructive');
  });

  test('under-threshold depth does NOT render text-destructive', () => {
    renderCell({ value: 3, threshold: 5 });
    const input = screen.getByLabelText(/depth/i);
    expect(input.className).not.toContain('text-destructive');
  });

  test('read-only cell is not editable', () => {
    renderCell({ value: 4, readOnly: true });
    const input = screen.getByLabelText(/depth/i) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });
});
