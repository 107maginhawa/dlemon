/**
 * G7-S5 — PIN digit-only validator enforcement
 *
 * Closes the gap where SetPin / VerifyPin / ResetMemberPin accepted any
 * 4-8 character string at the generated-validator layer, while the runtime
 * handlers enforce digit-only PINs. This test drives a digit-only @pattern
 * into the TypeSpec models so the API boundary rejects non-digit PINs.
 *
 * The app is wired with the REAL generated validators
 * (DentalMembershipManagement_*Body / ResetMemberPinBody) and the REAL
 * production validationErrorHandler (services/api-ts/src/middleware/validation.ts),
 * so this exercises the actual API-boundary rejection path — not a stub.
 *
 * Patterns (must match runtime handler enforcement, never loosen):
 *   - SetPinRequest.pin       → ^\d{4,8}$  (setPin handler hashes any 4-8 PIN)
 *   - VerifyPinRequest.pin    → ^\d{4,8}$  (verifyPin handler compares any 4-8 PIN)
 *   - ResetMemberPinRequest.newPin → ^\d{6}$ (resetMemberPin handler: z.string().regex(/^\d{6}$/))
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { validationErrorHandler } from '@/middleware/validation';
import {
  DentalMembershipManagement_setPinBody,
  DentalMembershipManagement_setPinParams,
  DentalMembershipManagement_verifyPinBody,
  DentalMembershipManagement_verifyPinParams,
  ResetMemberPinBody,
} from '@/generated/openapi/validators';

const ORG_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000001';
const MEMBER_ID = 'c0000000-0000-1000-8000-000000000001';

// A handler that should NEVER be reached when validation rejects the body.
function unreachableHandler(c: any) {
  return c.json({ reached: true }, 200);
}

function baseApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  return app;
}

function makeSetPinApp() {
  const app = baseApp();
  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin',
    zValidator('param', DentalMembershipManagement_setPinParams, validationErrorHandler),
    zValidator('json', DentalMembershipManagement_setPinBody, validationErrorHandler),
    unreachableHandler,
  );
  return app;
}

function makeVerifyPinApp() {
  const app = baseApp();
  app.post(
    '/dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin',
    zValidator('param', DentalMembershipManagement_verifyPinParams, validationErrorHandler),
    zValidator('json', DentalMembershipManagement_verifyPinBody, validationErrorHandler),
    unreachableHandler,
  );
  return app;
}

function makeResetMemberPinApp() {
  const app = baseApp();
  app.post(
    '/dental/org/members/:memberId/reset-pin',
    zValidator('json', ResetMemberPinBody, validationErrorHandler),
    unreachableHandler,
  );
  return app;
}

const setPinUrl = `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${MEMBER_ID}/set-pin`;
const verifyPinUrl = `/dental/organizations/${ORG_ID}/branches/${BRANCH_ID}/members/${MEMBER_ID}/verify-pin`;
const resetPinUrl = `/dental/org/members/${MEMBER_ID}/reset-pin`;

function post(url: string, body: unknown) {
  return { url, init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } };
}

describe('G7-S5 — PIN digit-only validator enforcement', () => {
  // -------------------------------------------------------------------------
  // SetPin
  // -------------------------------------------------------------------------
  test('SetPin rejects non-digit PIN at the validator boundary', async () => {
    const app = makeSetPinApp();
    const { url, init } = post(setPinUrl, { pin: 'abcd12' });
    const res = await app.request(url, init);
    // Validator must reject (4xx) and never reach the handler.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const json = (await res.json()) as any;
    expect(json.reached).toBeUndefined();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  test('SetPin rejects mixed alphanumeric PIN ("12ab")', async () => {
    const app = makeSetPinApp();
    const { url, init } = post(setPinUrl, { pin: '12ab' });
    const res = await app.request(url, init);
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.reached).toBeUndefined();
  });

  test('SetPin accepts a valid digit PIN (4-8 digits)', async () => {
    const app = makeSetPinApp();
    const { url, init } = post(setPinUrl, { pin: '9999' });
    const res = await app.request(url, init);
    // Passes validation → reaches the stub handler.
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.reached).toBe(true);
  });

  // -------------------------------------------------------------------------
  // VerifyPin
  // -------------------------------------------------------------------------
  test('VerifyPin rejects non-digit PIN at the validator boundary', async () => {
    const app = makeVerifyPinApp();
    const { url, init } = post(verifyPinUrl, { pin: 'abcd12' });
    const res = await app.request(url, init);
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.reached).toBeUndefined();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  test('VerifyPin accepts a valid digit PIN', async () => {
    const app = makeVerifyPinApp();
    const { url, init } = post(verifyPinUrl, { pin: '123456' });
    const res = await app.request(url, init);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.reached).toBe(true);
  });

  // -------------------------------------------------------------------------
  // ResetMemberPin (strict 6-digit, matching handler regex /^\d{6}$/)
  // -------------------------------------------------------------------------
  test('ResetMemberPin rejects non-digit newPin at the validator boundary', async () => {
    const app = makeResetMemberPinApp();
    const { url, init } = post(resetPinUrl, { newPin: '12345a' });
    const res = await app.request(url, init);
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.reached).toBeUndefined();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  test('ResetMemberPin rejects a 4-digit newPin (handler requires exactly 6)', async () => {
    const app = makeResetMemberPinApp();
    const { url, init } = post(resetPinUrl, { newPin: '1234' });
    const res = await app.request(url, init);
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.reached).toBeUndefined();
  });

  test('ResetMemberPin accepts a valid 6-digit newPin', async () => {
    const app = makeResetMemberPinApp();
    const { url, init } = post(resetPinUrl, { newPin: '123456' });
    const res = await app.request(url, init);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.reached).toBe(true);
  });
});
