/**
 * Harness self-test — proves `buildTestApp` mounts the generated validators and
 * therefore catches the contract drift that raw-handler mounts miss.
 *
 * The headline case is a SIDE-BY-SIDE: the same malformed body is posted to the
 * same handler (`createConsentForm`, the suggested consent-template class) two
 * ways —
 *   (a) through `buildTestApp`           → the generated zValidator rejects it
 *                                           with a clean 400 VALIDATION_ERROR;
 *   (b) raw-mounted with no validator    → the handler reads `ctx.req.valid()`,
 *                                           gets undefined, and throws (500).
 * Case (b) is exactly how a body that violates the contract ships green in a
 * raw-mount test. The harness closes that gap.
 *
 * Run: cd services/api-ts && \
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/monobase_test \
 *   bun scripts/test-with-db.ts src/tests/helpers/test-app.harness.test.ts
 */

import { describe, test, expect } from 'bun:test';
import { Hono, type Handler } from 'hono';
import { createDatabase } from '@/core/database';
import { buildTestApp, DEFAULT_TEST_USER, SILENT_LOGGER } from './test-app';
import { createConsentForm } from '@/handlers/dental-clinical/consent/createConsentForm';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5432/monobase_test',
});

// A syntactically valid path (visitId is a real UUID so the PARAM validator
// passes) pointing at a visit that does not exist — every case below is
// decided at the auth/validation boundary, before any row is needed, except
// the positive control which intentionally reaches the (404) handler.
const VISIT_ID = 'c0000000-0000-4000-8000-0000000000aa';
const CONSENTS_PATH = `/dental/visits/${VISIT_ID}/consents`;

function postJson(app: Hono<any>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('buildTestApp harness — validator mounting has teeth', () => {
  test('unauthenticated request → 401 (auth middleware is wired)', async () => {
    const app = buildTestApp({ db }); // no user
    const res = await postJson(app, CONSENTS_PATH, {});
    expect(res.status).toBe(401);
  });

  test('malformed body through the harness → 400 VALIDATION_ERROR (generated validator runs)', async () => {
    const app = buildTestApp({ db, user: DEFAULT_TEST_USER });
    // Missing every required field (patientId, templateId, templateName).
    const res = await postJson(app, CONSENTS_PATH, {});
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  test('THE BLINDSPOT: the same malformed body raw-mounted is NOT rejected as a contract violation', async () => {
    // Reproduce the raw-handler mount the cross-cutting audit flagged: handler
    // mounted with db+user injected but NO generated zValidator in front of it.
    const rawApp = new Hono();
    rawApp.onError((err, c) => c.json({ error: String((err as Error).message), code: 'RAW_500' }, 500));
    rawApp.use('*', async (c, next) => {
      const ctx = c as unknown as { set: (k: string, v: unknown) => void };
      ctx.set('database', db);
      ctx.set('logger', SILENT_LOGGER);
      ctx.set('user', DEFAULT_TEST_USER);
      await next();
    });
    rawApp.post('/dental/visits/:visitId/consents', createConsentForm as unknown as Handler);

    const res = await postJson(rawApp, CONSENTS_PATH, {});

    // The contract violation is invisible to the raw mount: with no validator in
    // front, the malformed body sails past the validation boundary and surfaces
    // as an unrelated downstream error (a 500 here) rather than the clean 400
    // VALIDATION_ERROR production returns. Either way the *contract violation as
    // such* is never reported — exactly the green-on-arrival drift the harness
    // eliminates. (Contrast: the harness test above returns 400 VALIDATION_ERROR
    // from the generated zValidator, decided as middleware before any DB access.)
    expect(res.status).not.toBe(400);
    const json = (await res.json()) as { code?: string };
    expect(json.code).not.toBe('VALIDATION_ERROR');
  });

  test('well-formed body passes the validator and reaches the handler (positive control — not blanket-400)', async () => {
    const app = buildTestApp({ db, user: DEFAULT_TEST_USER });
    const res = await postJson(app, CONSENTS_PATH, {
      visitId: VISIT_ID,
      patientId: 'a0000000-0000-4000-8000-0000000000ab',
      templateId: 'general-consent',
      templateName: 'General Consent',
    });
    // The valid shape passes the generated validator and reaches the handler,
    // which looks up the (non-existent) visit and returns 404 NOT_FOUND. Asserting
    // the SPECIFIC handler-level 404 (not merely "not a 400") proves the whole
    // production chain ran — auth → zValidator → handler → DB — and that a broken
    // harness returning a blanket 500 would fail this control.
    expect(res.status).toBe(404);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe('NOT_FOUND');
  });
});
