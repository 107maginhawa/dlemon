/**
 * pre-completion-gate — G-09: the completion CTA must reflect the SERVER's rules.
 *
 * The server hard-blocks visit completion (422, no override) on unsigned consent
 * (VISIT_CONSENT_REQUIRED) and open treatments (VISIT_HAS_OPEN_TREATMENTS). SOAP-note
 * content and open lab orders are NOT enforced server-side, so they are genuine soft
 * warnings the owner can override. Offering "Complete anyway" for a hard-blocked check
 * is a false affordance — the click always 422s.
 */

import { describe, test, expect } from 'bun:test';
import { deriveCompletionGate } from './pre-completion-gate';

describe('deriveCompletionGate', () => {
  test('all checks pass → ready', () => {
    expect(deriveCompletionGate([
      { pass: true, blocking: true }, { pass: true, blocking: true },
      { pass: true }, { pass: true },
    ])).toBe('ready');
  });

  test('a failing BLOCKING check (consent/treatments) → blocked (no override)', () => {
    expect(deriveCompletionGate([
      { pass: false, blocking: true }, // consent unsigned
      { pass: true, blocking: true }, { pass: true }, { pass: true },
    ])).toBe('blocked');
  });

  test('only soft checks fail (notes/lab orders) → override', () => {
    expect(deriveCompletionGate([
      { pass: true, blocking: true }, { pass: true, blocking: true },
      { pass: false }, // SOAP notes empty
      { pass: false }, // open lab order
    ])).toBe('override');
  });

  test('a blocking failure dominates a soft failure → blocked', () => {
    expect(deriveCompletionGate([
      { pass: false, blocking: true }, { pass: true, blocking: true },
      { pass: false }, { pass: true },
    ])).toBe('blocked');
  });

  test('no checks loaded yet → blocked (cannot complete)', () => {
    expect(deriveCompletionGate([])).toBe('blocked');
  });
});
