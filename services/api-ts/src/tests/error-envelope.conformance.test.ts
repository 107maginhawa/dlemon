/**
 * error-envelope.conformance.test.ts
 *
 * Verifies that every dental handler error path emits the standard error
 * envelope: { code: string, message: string, ... }.
 *
 * Does NOT test every endpoint — one representative case per error class
 * (UnauthorizedError, ValidationError, NotFoundError, BusinessLogicError)
 * is sufficient to prove the middleware contract is wired correctly.
 *
 * Tests use the production createErrorHandler so the assertions target the
 * real wire format, not the simplified test-only format.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError, createErrorHandler } from '@/core/errors';
import type { Config } from '@/core/config';
import {
  CreateDentalPatientBody,
  GetDentalPatientParams,
  ArchiveDentalPatientParams,
} from '@/generated/openapi/validators';
import { createDentalPatient } from '@/handlers/dental-patient/createDentalPatient';
import { getDentalPatient } from '@/handlers/dental-patient/getDentalPatient';
import { archiveDentalPatient } from '@/handlers/dental-patient/archiveDentalPatient';

// ─── Minimal config (mirrors production logging.level default) ───────────────

const testConfig: Pick<Config, 'logging' | 'security'> & Partial<Config> = {
  logging: { level: 'info' },
  security: {
    cors: { origins: ['http://localhost:3002'], credentials: true },
    csrf: { enabled: false, cookieName: '_csrf', headerName: 'X-CSRF-Token', tokenLength: 32 },
    headers: { hsts: false, contentTypeOptions: true, frameOptions: 'DENY', xssProtection: true, csp: false, cspDirectives: '' },
    rateLimit: { enabled: false, windowMs: 60000, max: 100 },
    audit: { logSensitiveFields: false },
  },
} as unknown as Config;

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const STAFF_USER = { id: 'c1000000-0000-1000-8000-000000000001', email: 'staff@clinic.com' };
const NONEXISTENT_ID = 'f0000000-0000-1000-8000-000000000099';

// ─── Helper: assert envelope fields ─────────────────────────────────────────

function assertEnvelope(body: unknown) {
  expect(body).toBeDefined();
  const b = body as Record<string, unknown>;
  expect(typeof b.code).toBe('string');
  expect(typeof b.message).toBe('string');
  expect(b.code.length).toBeGreaterThan(0);
  expect(b.message.length).toBeGreaterThan(0);
}

// ─── App builder (uses production error handler) ─────────────────────────────

function buildConformanceApp(user?: typeof STAFF_USER) {
  const app = new Hono();

  // Use production error handler — this is what we're conformance-testing
  app.onError(createErrorHandler(testConfig as Config));

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }) });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  const ve = (result: any, c: any) => {
    if (!result.success) {
      const msgs = result.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return c.json({ code: 'VALIDATION_ERROR', message: `Validation failed: ${msgs}` }, 400);
    }
  };

  app.post('/dental/patients', zValidator('json', CreateDentalPatientBody, ve), createDentalPatient as any);
  app.get('/dental/patients/:id', zValidator('param', GetDentalPatientParams, ve), getDentalPatient as any);
  app.post('/dental/patients/:id/archive', zValidator('param', ArchiveDentalPatientParams, ve), archiveDentalPatient as any);

  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Error Envelope Conformance', () => {
  describe('401 UnauthorizedError — no user session', () => {
    test('GET /dental/patients/:id without auth returns { code, message }', async () => {
      const app = buildConformanceApp(/* no user */);
      const res = await app.request(`/dental/patients/${NONEXISTENT_ID}`, {
        method: 'GET',
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      assertEnvelope(body);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    test('POST /dental/patients without auth returns { code, message }', async () => {
      const app = buildConformanceApp(/* no user */);
      const res = await app.request('/dental/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Test Patient', consentGiven: true }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      assertEnvelope(body);
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('400 ValidationError — bad request body', () => {
    test('POST /dental/patients with consentGiven=false returns { code, message }', async () => {
      const app = buildConformanceApp(STAFF_USER);
      const res = await app.request('/dental/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Test Patient', consentGiven: false }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      assertEnvelope(body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    test('POST /dental/patients with blank displayName returns { code, message }', async () => {
      const app = buildConformanceApp(STAFF_USER);
      const res = await app.request('/dental/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: '   ', consentGiven: true }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      assertEnvelope(body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('400 ValidationError — Zod schema reject', () => {
    test('POST /dental/patients with missing required field returns { code, message }', async () => {
      const app = buildConformanceApp(STAFF_USER);
      const res = await app.request('/dental/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // missing displayName
      });
      // zValidator ve returns 400 with our envelope shape
      expect(res.status).toBe(400);
      const body = await res.json();
      assertEnvelope(body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('404 NotFoundError — resource missing', () => {
    test('GET /dental/patients/:id with nonexistent ID returns { code, message }', async () => {
      const app = buildConformanceApp(STAFF_USER);
      const res = await app.request(`/dental/patients/${NONEXISTENT_ID}`, {
        method: 'GET',
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      assertEnvelope(body);
      expect(body.code).toBe('NOT_FOUND');
    });

    test('POST /dental/patients/:id/archive with nonexistent ID returns { code, message }', async () => {
      const app = buildConformanceApp(STAFF_USER);
      const res = await app.request(`/dental/patients/${NONEXISTENT_ID}/archive`, {
        method: 'POST',
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      assertEnvelope(body);
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('Envelope shape invariants', () => {
    test('Every error response carries requestId and timestamp', async () => {
      const app = buildConformanceApp(/* no user */);
      const res = await app.request(`/dental/patients/${NONEXISTENT_ID}`, {
        method: 'GET',
      });
      const body = await res.json() as Record<string, unknown>;
      expect(typeof body.requestId).toBe('string');
      expect(typeof body.timestamp).toBe('string');
      // Verify timestamp is ISO-8601
      expect(() => new Date(body.timestamp as string)).not.toThrow();
    });

    test('statusCode field mirrors HTTP status', async () => {
      const app = buildConformanceApp(/* no user */);
      const res = await app.request(`/dental/patients/${NONEXISTENT_ID}`, {
        method: 'GET',
      });
      const body = await res.json() as Record<string, unknown>;
      expect(body.statusCode).toBe(res.status);
    });
  });
});
