/**
 * error-toast tests — getErrorMessage / extractApiError
 *
 * Verifies the helper surfaces the backend envelope message (and code-mapped
 * copy) across the error shapes the hey-api SDK produces, falling back to the
 * caller's contextual string for technical/empty errors.
 */
import { describe, test, expect } from 'bun:test';
import { extractApiError, getErrorMessage } from './error-toast';

const FALLBACK = 'Failed to do the thing. Please try again.';

describe('extractApiError', () => {
  test('reads code + message from the standard envelope', () => {
    expect(extractApiError({ error: { code: 'FOO', message: 'bar' } })).toEqual({ code: 'FOO', message: 'bar' });
  });

  test('returns empty for non-envelope / non-object', () => {
    expect(extractApiError(new Error('boom'))).toEqual({});
    expect(extractApiError(null)).toEqual({});
    expect(extractApiError('nope')).toEqual({});
    expect(extractApiError({ nested: 1 })).toEqual({});
  });
});

describe('getErrorMessage', () => {
  test('surfaces the backend envelope message for an unmapped code', () => {
    const err = { error: { code: 'INVOICE_ALREADY_ISSUED', message: 'This invoice has already been issued.' } };
    expect(getErrorMessage(err, FALLBACK)).toBe('This invoice has already been issued.');
  });

  test('mapped code takes precedence over the raw message (friendlier copy)', () => {
    const err = { error: { code: 'VISIT_LOCKED', message: 'visit is locked' } };
    expect(getErrorMessage(err, FALLBACK)).toBe('Visit is locked. Reopen the visit to make changes.');
  });

  test('maps FORBIDDEN to friendly copy', () => {
    expect(getErrorMessage({ error: { code: 'FORBIDDEN', message: 'forbidden' } }, FALLBACK))
      .toBe("You don't have permission to do that.");
  });

  test('last-resort scan finds a known code in a wrapped/stringified error', () => {
    const err = new Error('Request failed: {"error":{"code":"VISIT_LOCKED"}}');
    expect(getErrorMessage(err, FALLBACK)).toBe('Visit is locked. Reopen the visit to make changes.');
  });

  test('plain technical Error falls back to the contextual message', () => {
    expect(getErrorMessage(new Error('Failed to fetch'), FALLBACK)).toBe(FALLBACK);
  });

  test('empty / whitespace envelope message falls back', () => {
    expect(getErrorMessage({ error: { code: 'X', message: '   ' } }, FALLBACK)).toBe(FALLBACK);
  });

  test('null / undefined fall back', () => {
    expect(getErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(getErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });
});
