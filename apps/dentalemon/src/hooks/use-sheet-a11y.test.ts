/**
 * useSheetA11y hook tests — WCAG 2.4.3 focus management
 *
 * Verifies:
 *   1. Escape key calls onClose while the sheet is open.
 *   2. Escape key does NOT call onClose while the sheet is closed.
 *   3. Focus returns to the opener element when the sheet closes.
 *   4. Opener is captured on open (not stale from a previous open).
 */

import { describe, test, expect, mock, afterEach, beforeEach } from 'bun:test';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useSheetA11y } from './use-sheet-a11y';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fire a keydown event on document with the given key. */
function dispatchKey(key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  return event;
}

/** Create a focusable DOM element and attach it to the document. */
function makeFocusableElement(): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = 'Opener';
  document.body.appendChild(el);
  return el;
}

describe('useSheetA11y', () => {
  let openerEl: HTMLButtonElement;

  beforeEach(() => {
    openerEl = makeFocusableElement();
  });

  afterEach(() => {
    openerEl.remove();
  });

  // ── Escape key behaviour ──────────────────────────────────────────────────

  test('calls onClose when Escape is pressed while open', () => {
    const onClose = mock(() => {});

    renderHook(() => useSheetA11y({ open: true, onClose }));

    act(() => { dispatchKey('Escape'); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does NOT call onClose when Escape is pressed while closed', () => {
    const onClose = mock(() => {});

    renderHook(() => useSheetA11y({ open: false, onClose }));

    act(() => { dispatchKey('Escape'); });

    expect(onClose).toHaveBeenCalledTimes(0);
  });

  test('does NOT call onClose when a non-Escape key is pressed while open', () => {
    const onClose = mock(() => {});

    renderHook(() => useSheetA11y({ open: true, onClose }));

    act(() => { dispatchKey('Enter'); });
    act(() => { dispatchKey('Tab'); });
    act(() => { dispatchKey('ArrowDown'); });

    expect(onClose).toHaveBeenCalledTimes(0);
  });

  test('stops listening for Escape after sheet closes', () => {
    const onClose = mock(() => {});

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useSheetA11y({ open, onClose }),
      { initialProps: { open: true } },
    );

    // Close the sheet
    rerender({ open: false });

    act(() => { dispatchKey('Escape'); });

    expect(onClose).toHaveBeenCalledTimes(0);
  });

  // ── Focus restoration ─────────────────────────────────────────────────────

  test('restores focus to the opener element when the sheet closes', async () => {
    openerEl.focus();
    expect(document.activeElement).toBe(openerEl);

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useSheetA11y({ open, onClose: () => {} }),
      { initialProps: { open: true } },
    );

    // Simulate focus moving inside the sheet
    const innerEl = makeFocusableElement();
    innerEl.focus();
    expect(document.activeElement).toBe(innerEl);

    // Close the sheet
    act(() => { rerender({ open: false }); });

    // Allow requestAnimationFrame to fire
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    expect(document.activeElement).toBe(openerEl);
    innerEl.remove();
  });

  test('captures the opener at the time of opening (not a stale capture)', async () => {
    const firstOpener = makeFocusableElement();
    const secondOpener = makeFocusableElement();

    // First open/close cycle
    firstOpener.focus();
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useSheetA11y({ open, onClose: () => {} }),
      { initialProps: { open: true } },
    );

    act(() => { rerender({ open: false }); });
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(firstOpener);

    // Second open/close cycle with a different opener
    secondOpener.focus();
    act(() => { rerender({ open: true }); });
    act(() => { rerender({ open: false }); });
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(secondOpener);

    firstOpener.remove();
    secondOpener.remove();
  });
});
