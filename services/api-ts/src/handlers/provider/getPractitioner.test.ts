/**
 * getPractitioner handler unit tests
 *
 * Tests the getPractitioner handler in isolation with mocked repository.
 */

import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { getPractitioner } from './getPractitioner';
import { UnauthorizedError, NotFoundError } from '@/core/errors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePractitioner(overrides: Record<string, any> = {}) {
  return {
    id: 'pr-00000000-0000-0000-0000-000000000001',
    providerId: 'pv-00000000-0000-0000-0000-000000000001',
    active: true,
    name: [{ family: 'Smith', given: ['Jane'] }],
    telecom: null,
    address: null,
    gender: null,
    birthDate: null,
    photo: null,
    qualification: [],
    credential: [],
    specialties: [],
    languages: null,
    deactivatedAt: null,
    tenantId: 'default',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function buildApp(options: {
  session?: object | null;
  practitioner?: object | null;
}) {
  const app = new Hono();

  app.use('/practitioners/:id', async (c, next) => {
    // Inject mock session
    if (options.session !== undefined) {
      (c as any).set('session', options.session);
    }

    // Inject mock database that returns the practitioner
    const mockDb = {
      select: mock(() => {
        const p = options.practitioner;
        const limit = mock(() => Promise.resolve(p ? [p] : []));
        const where = mock(() => ({ limit }));
        const from = mock(() => ({ where }));
        return { from };
      }),
      insert: mock(() => ({})),
      update: mock(() => ({})),
    };
    (c as any).set('database', mockDb);
    (c as any).set('logger', null);

    // Mock valid() for param
    const originalValid = c.req.valid.bind(c.req);
    (c.req as any).valid = (target: string) => {
      if (target === 'param') return { id: c.req.param('id') };
      return originalValid(target as any);
    };

    await next();
  });

  app.get('/practitioners/:id', (c) => getPractitioner(c as any));

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
    if (err instanceof UnauthorizedError) return c.json({ error: err.message }, 401);
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getPractitioner', () => {
  test('returns 200 with practitioner when found', async () => {
    const practitioner = makePractitioner();
    const app = buildApp({ session: { user: { id: 'user-1' } }, practitioner });

    const res = await app.request('/practitioners/pr-00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe(practitioner.id);
  });

  test('returns 401 when no session', async () => {
    const app = buildApp({ session: null, practitioner: makePractitioner() });

    const res = await app.request('/practitioners/pr-00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
  });

  test('returns 404 when practitioner not found', async () => {
    const app = buildApp({ session: { user: { id: 'user-1' } }, practitioner: null });

    const res = await app.request('/practitioners/non-existent-id');
    expect(res.status).toBe(404);
  });

  // ── Credential field-visibility (adversarial) ───────────────────────────────
  //
  // The Practitioner record carries SENSITIVE credentials (NPI / DEA / state
  // license numbers) and qualification identifiers. The ONLY read paths for it
  // are gated to admin|clinician|support|practitioner:owner (route middleware) —
  // there is NO public or patient-facing route that returns a practitioner
  // (the public directory surface is the credential-FREE `Provider` model).
  // These tests pin that (a) credentials/qualifications ARE returned to an
  // authorized session (so clinical/credentialing staff can see them) and
  // (b) the handler returns the FULL record without redacting them — i.e. the
  // confidentiality of license numbers depends entirely on the route role gate,
  // never on a handler-level projection. If a credential-bearing PUBLIC/patient
  // read of a practitioner is ever added, this projection MUST change.
  test('returns full credential + qualification to an authorized session (privileged projection)', async () => {
    const practitioner = makePractitioner({
      credential: [
        { type: 'npi', number: '1234567890', status: 'active' },
        { type: 'dea', number: 'BX9999999', state: 'CA', status: 'active' },
      ],
      qualification: [
        { code: { text: 'DDS' }, identifier: [{ system: 'urn:license', value: 'LIC-CA-001' }] },
      ],
    });
    const app = buildApp({ session: { user: { id: 'admin-1' } }, practitioner });

    const res = await app.request('/practitioners/pr-00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      credential: Array<{ type: string; number: string; state?: string }>;
      qualification: Array<{ identifier?: Array<{ value: string }> }>;
    };
    // Credentials are present and NOT redacted — confidentiality is the route gate's job.
    expect(body.credential).toHaveLength(2);
    expect(body.credential[0]?.number).toBe('1234567890');
    expect(body.credential[1]?.number).toBe('BX9999999');
    expect(body.credential[1]?.state).toBe('CA');
    // Qualification license identifiers also pass through verbatim.
    expect(body.qualification[0]?.identifier?.[0]?.value).toBe('LIC-CA-001');
  });

  // The credential-bearing read REQUIRES a session — there is no unauthenticated
  // (public) path to a practitioner record. (The route gate adds the role check
  // on top; the handler enforces the auth floor.)
  test('rejects an unauthenticated request even when the practitioner exists (no public read of credentials)', async () => {
    const practitioner = makePractitioner({
      credential: [{ type: 'npi', number: '1234567890', status: 'active' }],
    });
    const app = buildApp({ session: null, practitioner });

    const res = await app.request('/practitioners/pr-00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
  });
});
