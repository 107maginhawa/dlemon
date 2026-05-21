/**
 * Error Envelope Conformance Test
 *
 * Validates that every error type produced by createErrorHandler (errors.ts)
 * conforms to the documented envelope shape in docs/api/ERROR_ENVELOPE.md.
 *
 * Pattern: minimal Hono app + createErrorHandler, no DB, no real config.
 *
 * Coverage:
 *   - Base envelope fields present on every error response
 *   - HTTP status codes map to correct error classes
 *   - Specialised extension fields (NotFoundError, ValidationError,
 *     BusinessLogicError, AuthenticationError, AuthorizationError,
 *     ConflictError, RateLimitError, TimeoutError, ExternalServiceError)
 *   - ZodError produces VALIDATION_ERROR envelope with fieldErrors
 *   - Unhandled Error produces INTERNAL_SERVER_ERROR envelope
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  createErrorHandler,
  AppError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  BusinessLogicError,
  ConflictError,
  RateLimitError,
  AuthenticationError,
  AuthorizationError,
  HipaaComplianceError,
  TimeoutError,
  ExternalServiceError,
  NotFoundError,
} from '../core/errors';
import type { Config } from '../core/config';

// ─── Minimal mock config ──────────────────────────────────────────────────────
// Only the fields actually read by createErrorHandler / applySecurity:
//   config.logging.level  → controls debug mode
// All other fields are cast via `as unknown as Config`.

const mockConfig = {
  logging: { level: 'info' as const, pretty: false },
  server: {
    host: 'localhost',
    port: 7213,
    internalServiceToken: 'test',
    internalServiceExpandEnabled: false,
    emrTenantEnabled: false,
  },
} as unknown as Config;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = new Hono();

  // Each route throws a specific error so the handler can catch it.
  app.get('/throw/unauthorized', () => { throw new UnauthorizedError('Not logged in'); });
  app.get('/throw/forbidden', () => { throw new ForbiddenError('Access denied'); });
  app.get('/throw/validation', () => { throw new ValidationError('Bad input'); });
  app.get('/throw/business-logic', () => { throw new BusinessLogicError('Slot already booked', 'SLOT_CONFLICT'); });
  app.get('/throw/conflict', () => { throw new ConflictError('Duplicate record'); });
  app.get('/throw/not-found', () => {
    throw new NotFoundError('Patient not found', {
      resourceType: 'Patient',
      resource: 'abc123',
      suggestions: ['Try patient bcd234'],
    });
  });
  app.get('/throw/rate-limit', () => { throw new RateLimitError('Too many requests', { retryAfter: 30 }); });
  app.get('/throw/authentication', () => {
    throw new AuthenticationError('Token expired', 'Bearer', ['Bearer', 'ApiKey']);
  });
  app.get('/throw/authorization', () => {
    throw new AuthorizationError('Need write access', 'patient:write', ['patient:read'], '/patients/x');
  });
  app.get('/throw/hipaa', () => {
    throw new HipaaComplianceError('PHI access violation', '164.312(a)(1)', 'access-control', 'evt-1', ['Revoke session']);
  });
  app.get('/throw/timeout', () => {
    throw new TimeoutError('DB query timed out', 5000, 'fetchRecord', true);
  });
  app.get('/throw/external-service', () => {
    throw new ExternalServiceError('Stripe down', 'stripe', 'createCharge', 'stripe_err', 'Rate limited', true, 60);
  });
  app.get('/throw/zod', () => {
    const schema = z.object({ email: z.string().email(), age: z.number().min(0) });
    schema.parse({ email: 'not-an-email', age: -1 }); // throws ZodError; line below never reached
    return new Response(null, { status: 200 });
  });
  app.get('/throw/unhandled', () => { throw new Error('Unexpected boom'); });
  app.get('/throw/app-error-generic', () => {
    throw new AppError('Something broke', 'MY_CUSTOM_CODE', 418);
  });

  app.onError(createErrorHandler(mockConfig));
  return app;
}

// UUID v4 regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// ISO 8601 regex (lenient)
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** Assert every required base envelope field is present and well-typed. */
function assertBaseEnvelope(body: Record<string, unknown>, expectedStatus: number) {
  expect(typeof body['message']).toBe('string');
  expect(body['message']).toBeTruthy();

  expect(typeof body['code']).toBe('string');
  expect(body['code']).toBeTruthy();

  expect(typeof body['requestId']).toBe('string');
  expect(UUID_RE.test(body['requestId'] as string)).toBe(true);

  expect(typeof body['timestamp']).toBe('string');
  expect(ISO_RE.test(body['timestamp'] as string)).toBe(true);

  expect(body['statusCode']).toBe(expectedStatus);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let app: Hono;

beforeAll(() => {
  app = buildApp();
});

describe('error envelope — base fields', () => {
  test('UnauthorizedError (401) has all base fields', async () => {
    const res = await app.request('/throw/unauthorized');
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 401);
    expect(body['code']).toBe('UNAUTHORIZED');
  });

  test('ForbiddenError (403) has all base fields', async () => {
    const res = await app.request('/throw/forbidden');
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 403);
    expect(body['code']).toBe('FORBIDDEN');
  });

  test('ValidationError (400) has all base fields', async () => {
    const res = await app.request('/throw/validation');
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 400);
    expect(body['code']).toBe('VALIDATION_ERROR');
  });

  test('ConflictError (409) has all base fields', async () => {
    const res = await app.request('/throw/conflict');
    expect(res.status).toBe(409);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 409);
    expect(body['code']).toBe('CONFLICT');
  });

  test('generic AppError uses caller-supplied code and status', async () => {
    const res = await app.request('/throw/app-error-generic');
    expect(res.status).toBe(418);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 418);
    expect(body['code']).toBe('MY_CUSTOM_CODE');
  });

  test('unhandled Error produces 500 INTERNAL_SERVER_ERROR', async () => {
    const res = await app.request('/throw/unhandled');
    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 500);
    expect(body['code']).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('error envelope — NotFoundError (404)', () => {
  test('status is 404 and code is NOT_FOUND', async () => {
    const res = await app.request('/throw/not-found');
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 404);
    expect(body['code']).toBe('NOT_FOUND');
  });

  test('extension fields: resourceType, resource, suggestions', async () => {
    const res = await app.request('/throw/not-found');
    const body = await res.json() as Record<string, unknown>;
    expect(body['resourceType']).toBe('Patient');
    expect(body['resource']).toBe('abc123');
    expect(Array.isArray(body['suggestions'])).toBe(true);
    expect((body['suggestions'] as string[])[0]).toBe('Try patient bcd234');
  });
});

describe('error envelope — BusinessLogicError (422)', () => {
  test('status is 422 and code is caller-supplied', async () => {
    const res = await app.request('/throw/business-logic');
    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 422);
    expect(body['code']).toBe('SLOT_CONFLICT');
  });

  test('message is preserved', async () => {
    const res = await app.request('/throw/business-logic');
    const body = await res.json() as Record<string, unknown>;
    expect(body['message']).toBe('Slot already booked');
  });
});

describe('error envelope — ZodError produces VALIDATION_ERROR with fieldErrors', () => {
  test('status is 400 and code is VALIDATION_ERROR', async () => {
    const res = await app.request('/throw/zod');
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 400);
    expect(body['code']).toBe('VALIDATION_ERROR');
  });

  test('fieldErrors array is present with field + code + message', async () => {
    const res = await app.request('/throw/zod');
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['fieldErrors'])).toBe(true);
    const fieldErrors = body['fieldErrors'] as Array<Record<string, unknown>>;
    expect(fieldErrors.length).toBeGreaterThan(0);
    for (const fe of fieldErrors) {
      expect(typeof fe['field']).toBe('string');
      expect(typeof fe['code']).toBe('string');
      expect(typeof fe['message']).toBe('string');
    }
  });

  test('email field error is present', async () => {
    const res = await app.request('/throw/zod');
    const body = await res.json() as Record<string, unknown>;
    const fieldErrors = body['fieldErrors'] as Array<Record<string, unknown>>;
    const emailErr = fieldErrors.find(fe => fe['field'] === 'email');
    expect(emailErr).toBeDefined();
  });
});

describe('error envelope — AuthenticationError (401)', () => {
  test('status 401, code AUTHENTICATION_ERROR', async () => {
    const res = await app.request('/throw/authentication');
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 401);
    expect(body['code']).toBe('AUTHENTICATION_ERROR');
  });

  test('extension: scheme and supportedSchemes', async () => {
    const res = await app.request('/throw/authentication');
    const body = await res.json() as Record<string, unknown>;
    expect(body['scheme']).toBe('Bearer');
    expect(Array.isArray(body['supportedSchemes'])).toBe(true);
    expect(body['supportedSchemes']).toContain('Bearer');
    expect(body['supportedSchemes']).toContain('ApiKey');
  });
});

describe('error envelope — AuthorizationError (403)', () => {
  test('status 403, code AUTHORIZATION_ERROR', async () => {
    const res = await app.request('/throw/authorization');
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 403);
    expect(body['code']).toBe('AUTHORIZATION_ERROR');
  });

  test('extension: requiredPermission, userPermissions, resource', async () => {
    const res = await app.request('/throw/authorization');
    const body = await res.json() as Record<string, unknown>;
    expect(body['requiredPermission']).toBe('patient:write');
    expect(Array.isArray(body['userPermissions'])).toBe(true);
    expect((body['userPermissions'] as string[])[0]).toBe('patient:read');
    expect(body['resource']).toBe('/patients/x');
  });
});

describe('error envelope — RateLimitError (429)', () => {
  test('status 429, code RATE_LIMIT', async () => {
    const res = await app.request('/throw/rate-limit');
    expect(res.status).toBe(429);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 429);
    expect(body['code']).toBe('RATE_LIMIT');
  });

  test('Retry-After header is set', async () => {
    const res = await app.request('/throw/rate-limit');
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  test('extension: limitType, limit, usage, resetTime, windowSize', async () => {
    const res = await app.request('/throw/rate-limit');
    const body = await res.json() as Record<string, unknown>;
    expect(body['limitType']).toBe('requests');
    expect(typeof body['limit']).toBe('number');
    expect(typeof body['usage']).toBe('number');
    expect(typeof body['resetTime']).toBe('number');
    expect(typeof body['windowSize']).toBe('number');
  });
});

describe('error envelope — TimeoutError (408)', () => {
  test('status 408, code TIMEOUT_ERROR', async () => {
    const res = await app.request('/throw/timeout');
    expect(res.status).toBe(408);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 408);
    expect(body['code']).toBe('TIMEOUT_ERROR');
  });

  test('extension: timeoutMs, operation, retryable', async () => {
    const res = await app.request('/throw/timeout');
    const body = await res.json() as Record<string, unknown>;
    expect(body['timeoutMs']).toBe(5000);
    expect(body['operation']).toBe('fetchRecord');
    expect(body['retryable']).toBe(true);
  });
});

describe('error envelope — ExternalServiceError (503)', () => {
  test('status 503, code EXTERNAL_SERVICE_ERROR', async () => {
    const res = await app.request('/throw/external-service');
    expect(res.status).toBe(503);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 503);
    expect(body['code']).toBe('EXTERNAL_SERVICE_ERROR');
  });

  test('extension: service, operation, externalCode, retryable, retryAfter', async () => {
    const res = await app.request('/throw/external-service');
    const body = await res.json() as Record<string, unknown>;
    expect(body['service']).toBe('stripe');
    expect(body['operation']).toBe('createCharge');
    expect(body['externalCode']).toBe('stripe_err');
    expect(body['retryable']).toBe(true);
    expect(body['retryAfter']).toBe(60);
  });

  test('Retry-After header set when retryAfter provided', async () => {
    const res = await app.request('/throw/external-service');
    expect(res.headers.get('Retry-After')).toBe('60');
  });
});

describe('error envelope — HipaaComplianceError (400)', () => {
  test('status 400, code HIPAA_COMPLIANCE_ERROR', async () => {
    const res = await app.request('/throw/hipaa');
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    assertBaseEnvelope(body, 400);
    expect(body['code']).toBe('HIPAA_COMPLIANCE_ERROR');
  });

  test('extension: hipaaRule, violationType, auditLog, remediationRequired', async () => {
    const res = await app.request('/throw/hipaa');
    const body = await res.json() as Record<string, unknown>;
    expect(body['hipaaRule']).toBe('164.312(a)(1)');
    expect(body['violationType']).toBe('access-control');
    expect(body['auditLog']).toBe('evt-1');
    expect(Array.isArray(body['remediationRequired'])).toBe(true);
  });
});

describe('error envelope — dev-only fields', () => {
  test('path and method present in non-production (NODE_ENV=test)', async () => {
    // Tests run with NODE_ENV != 'production' so path/method must be present
    const res = await app.request('/throw/not-found');
    const body = await res.json() as Record<string, unknown>;
    expect(body['path']).toBe('/throw/not-found');
    expect(body['method']).toBe('GET');
  });
});
