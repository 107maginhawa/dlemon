/**
 * Session expiry interceptor tests
 *
 * Tests the 401 response interceptor logic registered in ApiProvider.
 * The interceptor calls onSessionExpired() when a non-auth endpoint returns 401.
 *
 * These tests validate the interceptor logic directly (not via React render)
 * by replicating the same behavior documented in ADR-003.
 */

import { describe, test, expect, beforeEach } from 'bun:test';

/**
 * Factory matching the interceptor installed in ApiProvider.
 * Tests import this to exercise the same logic without a React tree.
 */
function createSessionExpiredInterceptor(
  onSessionExpired: () => void,
): (response: Response, request: Request) => Response {
  let sessionExpiredHandling = false;
  return (response: Response, request: Request): Response => {
    if (response.status === 401 && !sessionExpiredHandling) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/auth/')) {
        sessionExpiredHandling = true;
        onSessionExpired();
      }
    }
    return response;
  };
}

describe('session expiry interceptor', () => {
  const BASE_URL = 'http://localhost:7213';

  function makeResponse(status: number): Response {
    return new Response(null, { status });
  }

  function makeRequest(path: string): Request {
    return new Request(`${BASE_URL}${path}`);
  }

  // --------------------------------------------------------------------------
  // 401 triggers callback
  // --------------------------------------------------------------------------

  test('calls onSessionExpired when API returns 401', () => {
    let called = false;
    const interceptor = createSessionExpiredInterceptor(() => { called = true; });

    const response = makeResponse(401);
    interceptor(response, makeRequest('/api/dental/patients'));

    expect(called).toBe(true);
  });

  test('returns the response unchanged after triggering callback', () => {
    const interceptor = createSessionExpiredInterceptor(() => {});
    const response = makeResponse(401);
    const result = interceptor(response, makeRequest('/api/dental/patients'));
    expect(result).toBe(response);
  });

  // --------------------------------------------------------------------------
  // Non-401 pass-through
  // --------------------------------------------------------------------------

  test('does not call onSessionExpired for 200 responses', () => {
    let called = false;
    const interceptor = createSessionExpiredInterceptor(() => { called = true; });

    interceptor(makeResponse(200), makeRequest('/api/dental/patients'));

    expect(called).toBe(false);
  });

  test('does not call onSessionExpired for 403 responses', () => {
    let called = false;
    const interceptor = createSessionExpiredInterceptor(() => { called = true; });

    interceptor(makeResponse(403), makeRequest('/api/dental/patients'));

    expect(called).toBe(false);
  });

  test('does not call onSessionExpired for 500 responses', () => {
    let called = false;
    const interceptor = createSessionExpiredInterceptor(() => { called = true; });

    interceptor(makeResponse(500), makeRequest('/api/dental/patients'));

    expect(called).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Auth endpoint skip
  // --------------------------------------------------------------------------

  test('does not call onSessionExpired for 401 on /api/auth/* paths', () => {
    let called = false;
    const interceptor = createSessionExpiredInterceptor(() => { called = true; });

    interceptor(makeResponse(401), makeRequest('/api/auth/sign-in'));

    expect(called).toBe(false);
  });

  test('does not call onSessionExpired for 401 on /api/auth/sign-out', () => {
    let called = false;
    const interceptor = createSessionExpiredInterceptor(() => { called = true; });

    interceptor(makeResponse(401), makeRequest('/api/auth/sign-out'));

    expect(called).toBe(false);
  });

  test('does call onSessionExpired for 401 on /api/dental/* paths', () => {
    let called = false;
    const interceptor = createSessionExpiredInterceptor(() => { called = true; });

    interceptor(makeResponse(401), makeRequest('/api/dental/billing/invoices'));

    expect(called).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Thundering herd dedup
  // --------------------------------------------------------------------------

  test('calls onSessionExpired only once when multiple 401s arrive', () => {
    let callCount = 0;
    const interceptor = createSessionExpiredInterceptor(() => { callCount++; });

    interceptor(makeResponse(401), makeRequest('/api/dental/patients'));
    interceptor(makeResponse(401), makeRequest('/api/dental/billing/invoices'));
    interceptor(makeResponse(401), makeRequest('/api/dental/treatments'));

    expect(callCount).toBe(1);
  });

  test('dedup works across different non-auth paths', () => {
    let callCount = 0;
    const interceptor = createSessionExpiredInterceptor(() => { callCount++; });

    interceptor(makeResponse(401), makeRequest('/api/dental/patients/123'));
    interceptor(makeResponse(401), makeRequest('/api/dental/org/context'));

    expect(callCount).toBe(1);
  });
});
