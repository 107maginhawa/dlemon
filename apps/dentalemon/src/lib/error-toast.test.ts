/**
 * error-toast tests — getErrorMessage / extractApiError
 *
 * The canonical thrown error in this app is an `SdkError` (installed interceptor,
 * see packages/sdk-ts/src/client.ts + react/provider.tsx): an Error subclass with
 * `.message` (human string) and `.body` (the FLAT backend envelope `{code,message,
 * statusCode}` per TypeSpec `ErrorDetail`). These tests assert against a REAL
 * SdkError (via `makeSdkError`) so the helper is verified against the shape it
 * actually receives — the previous suite mocked a nested `{ error: {...} }` shape
 * the backend never sends, which is how the create-visit "try again" bug shipped.
 */
import { describe, test, expect } from 'bun:test';
import { extractApiError, getErrorMessage } from './error-toast';
import { makeSdkError } from '@/test-utils';

const FALLBACK = 'Failed to do the thing. Please try again.';

describe('extractApiError — canonical SdkError shape', () => {
  test('reads code + message from SdkError.body (the real thrown shape)', () => {
    const err = makeSdkError(409, { code: 'ACTIVE_VISIT_EXISTS', message: 'Active visit already exists for this patient. Complete or discard it first.' });
    expect(extractApiError(err)).toEqual({
      code: 'ACTIVE_VISIT_EXISTS',
      message: 'Active visit already exists for this patient. Complete or discard it first.',
    });
  });

  test('reads code + message from a raw flat body (interceptor-absent path)', () => {
    expect(extractApiError({ code: 'INVOICE_ALREADY_ISSUED', message: 'This invoice has already been issued.', statusCode: 422 }))
      .toEqual({ code: 'INVOICE_ALREADY_ISSUED', message: 'This invoice has already been issued.' });
  });

  test('tolerates a string SdkError.body (non-JSON response) without throwing', () => {
    const err = makeSdkError(502, {});
    // simulate the string-body edge (wrapError sets body = textError when JSON parse fails)
    (err as { body: unknown }).body = 'Bad Gateway';
    expect(extractApiError(err)).toEqual({});
  });

  test('legacy tolerance: still reads a nested { error: { code, message } } envelope', () => {
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
  test('surfaces the real backend message from an SdkError for an unmapped code', () => {
    const err = makeSdkError(409, { code: 'ACTIVE_VISIT_EXISTS', message: 'Active visit already exists for this patient. Complete or discard it first.' });
    expect(getErrorMessage(err, FALLBACK)).toBe('Active visit already exists for this patient. Complete or discard it first.');
  });

  test('mapped code takes precedence over the raw message (friendlier copy)', () => {
    const err = makeSdkError(422, { code: 'VISIT_LOCKED', message: 'visit is locked' });
    expect(getErrorMessage(err, FALLBACK)).toBe('Visit is locked. Reopen the visit to make changes.');
  });

  test('maps FORBIDDEN to friendly copy (from SdkError)', () => {
    expect(getErrorMessage(makeSdkError(403, { code: 'FORBIDDEN', message: 'forbidden' }), FALLBACK))
      .toBe("You don't have permission to do that.");
  });

  test('synthetic SdkError message (no body message) falls back to the contextual string', () => {
    // When the body carries no message, wrapError synthesizes "SDK request failed: …".
    // That technical string must NOT be shown — the caller's fallback wins.
    const err = new SdkErrorLike();
    expect(getErrorMessage(err, FALLBACK)).toBe(FALLBACK);
  });

  test('legacy nested envelope message still surfaces', () => {
    const err = { error: { code: 'INVOICE_ALREADY_ISSUED', message: 'This invoice has already been issued.' } };
    expect(getErrorMessage(err, FALLBACK)).toBe('This invoice has already been issued.');
  });

  test('last-resort scan finds a known code in a wrapped/stringified error', () => {
    const err = new Error('Request failed: {"error":{"code":"VISIT_LOCKED"}}');
    expect(getErrorMessage(err, FALLBACK)).toBe('Visit is locked. Reopen the visit to make changes.');
  });

  test('plain technical Error falls back to the contextual message', () => {
    expect(getErrorMessage(new Error('Failed to fetch'), FALLBACK)).toBe(FALLBACK);
  });

  test('empty / whitespace envelope message falls back', () => {
    expect(getErrorMessage(makeSdkError(400, { code: 'X', message: '   ' }), FALLBACK)).toBe(FALLBACK);
  });

  test('null / undefined fall back', () => {
    expect(getErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(getErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });
});

// A stand-in for an SdkError whose body has no message → .message is the synthetic
// "SDK request failed: …" string the interceptor generates.
class SdkErrorLike extends Error {
  status = 409;
  body = { code: 'SOME_CODE', statusCode: 409 };
  constructor() {
    super('SDK request failed: POST /dental/visits → 409');
    this.name = 'SdkError';
  }
}
