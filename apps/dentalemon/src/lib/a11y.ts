/**
 * Accessibility helpers.
 */
import type { KeyboardEvent } from 'react';

/**
 * Keyboard-activate a non-native control. For elements with `role="button"`
 * (e.g. clickable divs), wire `onKeyDown={activateOnKey(handler)}` so that
 * Enter and Space fire the same action as a click — matching native button
 * semantics. Space is prevented to avoid scrolling the page.
 */
export function activateOnKey(handler: () => void) {
  return (e: KeyboardEvent) => {
    // Ignore auto-repeat from a held key — native buttons fire once per press.
    if (e.repeat) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}
