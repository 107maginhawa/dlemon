/**
 * verify-app.test.ts — TDD for the verify-app verdict logic.
 *
 * Run from repo root:  bun test ./scripts/verify-app.test.ts
 *
 * The class this closes: a green `verify:app` on a box with NO booted stack
 * proves zero functional/e2e, because the stack-dependent Tier-1 steps
 * (`contract-core`, `journey-harness`) are reported SKIP and SKIP is treated as
 * PASS. `--require-stack` (strict mode) turns a would-be SKIP into a blocking
 * FAIL so a skipped functional proof is never green.
 *
 * Non-vacuity is the whole point of these tests:
 *   - strict mode + stack down  → RED  (the proof was REQUIRED but could not run)
 *   - default mode + stack down → GREEN (skip-tolerant: CI without a stack passes)
 */

import { describe, expect, test } from 'bun:test';
import { resolveStackGate, computeOverall } from './verify-app';

const API_URL = 'http://localhost:7213';
const stackStep = { needsStack: true } as const;
const plainStep = { needsStack: false } as const;

describe('resolveStackGate — SKIP-vs-FAIL for a stack-dependent step', () => {
  test('default mode + stack DOWN → SKIP (skip-tolerant)', () => {
    const r = resolveStackGate(stackStep, false, false, API_URL);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('SKIP');
  });

  test('STRICT mode + stack DOWN → FAIL (the functional proof was REQUIRED)', () => {
    const r = resolveStackGate(stackStep, false, true, API_URL);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('FAIL');
    expect(r!.detail).toContain(API_URL);
  });

  test('stack UP → null (step runs normally) regardless of strict mode', () => {
    expect(resolveStackGate(stackStep, true, false, API_URL)).toBeNull();
    expect(resolveStackGate(stackStep, true, true, API_URL)).toBeNull();
  });

  test('a non-stack step → null (runs normally) regardless of stack/strict', () => {
    expect(resolveStackGate(plainStep, false, false, API_URL)).toBeNull();
    expect(resolveStackGate(plainStep, false, true, API_URL)).toBeNull();
  });
});

describe('computeOverall — verdict + exit decision', () => {
  const pass = { status: 'PASS' as const, step: { blocking: true } };
  const skip = { status: 'SKIP' as const, step: { blocking: true } };
  const blockingFail = { status: 'FAIL' as const, step: { blocking: true } };
  const nonBlockingFail = { status: 'FAIL' as const, step: { blocking: false } };

  test('all PASS → PASS, no fail', () => {
    expect(computeOverall([pass, pass])).toEqual({ overall: 'PASS', fail: false });
  });

  test('NON-VACUITY: strict mode + a SKIP present → FAIL (never green when stack required)', () => {
    expect(computeOverall([pass, skip], true)).toEqual({ overall: 'FAIL', fail: true });
  });

  test('default mode + a SKIP present → PASS (skip-tolerant preserved)', () => {
    expect(computeOverall([pass, skip], false)).toEqual({ overall: 'PASS', fail: false });
  });

  test('a blocking FAIL → FAIL in both modes', () => {
    expect(computeOverall([pass, blockingFail], false)).toEqual({ overall: 'FAIL', fail: true });
    expect(computeOverall([pass, blockingFail], true)).toEqual({ overall: 'FAIL', fail: true });
  });

  test('a NON-blocking FAIL alone → PASS (matches today: only blocking fails count)', () => {
    expect(computeOverall([pass, nonBlockingFail], false)).toEqual({ overall: 'PASS', fail: false });
  });
});
