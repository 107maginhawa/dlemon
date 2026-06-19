/**
 * SDK client unit tests
 *
 * Tests client initialization, base URL config, createClientConfig,
 * SdkError, and error interceptor.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  setSdkBaseUrl,
  getSdkBaseUrl,
  createClientConfig,
  SdkError,
  errorInterceptor,
} from './client';

describe('SDK base URL', () => {
  beforeEach(() => {
    setSdkBaseUrl('http://localhost:7213');
  });

  test('default base URL is http://localhost:7213', () => {
    expect(getSdkBaseUrl()).toBe('http://localhost:7213');
  });

  test('setSdkBaseUrl updates the URL', () => {
    setSdkBaseUrl('https://api.example.com');
    expect(getSdkBaseUrl()).toBe('https://api.example.com');
  });

  test('setSdkBaseUrl can be called multiple times', () => {
    setSdkBaseUrl('http://one.com');
    setSdkBaseUrl('http://two.com');
    expect(getSdkBaseUrl()).toBe('http://two.com');
  });
});

describe('createClientConfig', () => {
  beforeEach(() => {
    setSdkBaseUrl('http://localhost:7213');
  });

  test('injects baseUrl into config', () => {
    const result = createClientConfig({ myOption: true }) as any;
    expect(result.baseUrl).toBe('http://localhost:7213');
    expect(result.myOption).toBe(true);
  });

  test('injects custom fetch into config', () => {
    const result = createClientConfig({}) as any;
    expect(typeof result.fetch).toBe('function');
  });

  // Regression: ISSUE-025 — image/attachment/PMD uploads send size: BigInt(file.size).
  // The generated default serializer stringifies every bigint, but the server validates
  // int64 request fields as z.number().int() and 400s on a string ("expected number,
  // received string") — so every UI upload failed silently. Safe int64 values must
  // serialize as JSON numbers.
  // Found by /qa on 2026-06-20
  // Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
  test('injects a bigint-safe body serializer (int64 → JSON number, not string)', () => {
    const result = createClientConfig({}) as any;
    const serialize = result.bodySerializer as (b: unknown) => string;
    expect(typeof serialize).toBe('function');

    // Safe int64 (file size) → bare number, NOT a quoted string.
    expect(serialize({ size: BigInt(2048) })).toBe('{"size":2048}');
    expect(serialize({ size: BigInt(0) })).toBe('{"size":0}');

    // Mixed payload: non-bigint fields untouched.
    expect(serialize({ filename: 'x.png', size: BigInt(1024) })).toBe(
      '{"filename":"x.png","size":1024}',
    );

    // >2^53 falls back to string to preserve precision (unreachable for real files).
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
    expect(serialize({ size: huge })).toBe(`{"size":"${huge.toString()}"}`);
  });

  test('preserves original config properties', () => {
    const result = createClientConfig({ headers: { 'X-Test': 'yes' }, timeout: 5000 }) as any;
    expect(result.headers).toEqual({ 'X-Test': 'yes' });
    expect(result.timeout).toBe(5000);
  });
});

describe('SdkError', () => {
  test('creates error with status and url', () => {
    const err = new SdkError({ status: 404, url: '/api/test', method: 'GET' });
    expect(err.status).toBe(404);
    expect(err.url).toBe('/api/test');
    expect(err.method).toBe('GET');
    expect(err.name).toBe('SdkError');
    expect(err instanceof Error).toBe(true);
  });

  test('uses custom message when provided', () => {
    const err = new SdkError({ status: 500, message: 'Server error' });
    expect(err.message).toBe('Server error');
  });

  test('generates default message when not provided', () => {
    const err = new SdkError({ status: 403, url: '/forbidden', method: 'POST' });
    expect(err.message).toContain('403');
    expect(err.message).toContain('/forbidden');
  });

  test('stores body for inspection', () => {
    const body = { error: 'not found', code: 'NOT_FOUND' };
    const err = new SdkError({ status: 404, body });
    expect(err.body).toEqual(body);
  });
});

describe('errorInterceptor', () => {
  test('wraps plain error into SdkError', () => {
    const response = new Response('', { status: 422 });
    const result = errorInterceptor(
      { message: 'Validation failed' },
      response,
      new Request('http://localhost/api/test', { method: 'POST' })
    );
    expect(result instanceof SdkError).toBe(true);
    const err = result as SdkError;
    expect(err.status).toBe(422);
    expect(err.message).toBe('Validation failed');
  });

  test('returns SdkError as-is', () => {
    const original = new SdkError({ status: 500 });
    const result = errorInterceptor(original, undefined, undefined);
    expect(result).toBe(original);
  });

  test('passes through abort errors unchanged', () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    const result = errorInterceptor(abortErr, undefined, undefined);
    expect(result).toBe(abortErr);
  });

  test('wraps string error into SdkError', () => {
    const result = errorInterceptor(
      'Something went wrong',
      new Response('', { status: 400 }),
      undefined
    );
    expect(result instanceof SdkError).toBe(true);
    expect((result as SdkError).message).toBe('Something went wrong');
  });
});
