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
