/**
 * useSheetA11y — WCAG 2.4.3 focus management for sheet/slideout overlays.
 *
 * Behaviour contract:
 *   1. When `open` transitions false→true, capture `document.activeElement`
 *      as the "opener" so focus can be returned after close.
 *   2. While open, listen for `Escape` on the document and call `onClose`.
 *   3. When `open` transitions true→false, return focus to the captured opener.
 *   4. While open, TRAP Tab focus within `containerRef` (WCAG 2.4.3 / 2.1.2) so
 *      keyboard focus can't walk out of a hand-rolled overlay to the page behind
 *      it. Backward-compatible: the trap only engages once a caller attaches
 *      `containerRef` to its panel root; callers that ignore the return are
 *      unchanged (the trap is inert with no ref).
 *
 * Usage:
 *   const { containerRef } = useSheetA11y({ open, onClose });
 *   // Attach containerRef to the outermost element of the sheet/slideout:
 *   //   <div ref={containerRef} role="dialog" aria-modal="true" …>
 *   // The hook does NOT auto-focus the container — sheets with their own
 *   // autofocus (e.g. first input) should handle that separately.
 */

import { useEffect, useRef } from 'react';

export interface UseSheetA11yOptions {
  open: boolean;
  onClose: () => void;
}

export function useSheetA11y({ open, onClose }: UseSheetA11yOptions) {
  // Element that triggered the sheet — we return focus here on close.
  const openerRef = useRef<Element | null>(null);
  // The sheet's panel root — attach to enable the focus trap (see effect below).
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Capture the opener when the sheet opens, restore focus when it closes.
  useEffect(() => {
    if (open) {
      // Capture the active element at the moment the sheet opens.
      openerRef.current = document.activeElement;
    } else {
      // Restore focus to the opener when the sheet closes.
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener && opener instanceof HTMLElement) {
        // Defer one tick so the sheet's exit animation/unmount doesn't steal focus back.
        requestAnimationFrame(() => {
          opener.focus({ preventScroll: true });
        });
      }
    }
  }, [open]);

  // Close on Escape while the sheet is open.
  // NOTE: do NOT use this hook on a Radix Dialog/Sheet — Radix has its own
  // capture-phase Escape handler and the stopPropagation() below would
  // suppress it. This hook is only for hand-rolled overlays.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [open, onClose]);

  // Trap Tab focus within the panel while open (only when a caller attaches
  // containerRef). Keeps keyboard focus from escaping a hand-rolled overlay to
  // the page behind it. No-ops in layout-less test environments (offsetParent
  // is null), so it never interferes with unit tests.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return { containerRef };
}
