/**
 * Tests for the production attack-surface guard (task #37).
 * Verifies base-template endpoints unreachable from the dentalemon product are
 * 404'd in production only, left live in dev/test, and matched by exact method
 * + param-aware path — without touching dental product routes.
 */
import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import type { Variables } from '@/types/app';
import { mountProdDisabledRoutes, PROD_DISABLED_ROUTES } from './disabled-routes';
import { AppError } from './errors';

function makeApp(isProduction: boolean) {
  const app = new Hono<{ Variables: Variables }>();
  mountProdDisabledRoutes(app, isProduction);
  // Stand-in for the generated routes registered after the guard.
  app.all('*', (c) => c.json({ ok: true }));
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ code: err.code }, err.statusCode as 404);
    throw err;
  });
  return app;
}

describe('mountProdDisabledRoutes', () => {
  it('is a no-op outside production (routes stay live in dev/test)', async () => {
    const app = makeApp(false);
    const res = await app.request('/comms/ice-servers');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('404s a denylisted route in production with the canonical NOT_FOUND envelope', async () => {
    const app = makeApp(true);
    const res = await app.request('/comms/ice-servers');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe('NOT_FOUND');
  });

  it('matches :param segments (POST /booking/bookings/:booking/cancel)', async () => {
    const app = makeApp(true);
    const res = await app.request('/booking/bookings/bk_abc123/cancel', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('does NOT block dental product routes in production', async () => {
    const app = makeApp(true);
    const res = await app.request('/dental/patients');
    expect(res.status).toBe(200);
  });

  it('is method-specific: a verb not on the denylist for a listed path passes', async () => {
    // PUT /patients/:id is not in the denylist (only GET/PATCH/DELETE/POST are).
    const app = makeApp(true);
    const res = await app.request('/patients/p_1', { method: 'PUT' });
    expect(res.status).toBe(200);
  });

  it('is anchored: a longer path that merely starts with a denylisted one passes', async () => {
    const app = makeApp(true);
    const res = await app.request('/comms/ice-servers/extra');
    expect(res.status).toBe(200);
  });

  it('keeps storage and base billing/Stripe OUT of the denylist', () => {
    const blob = PROD_DISABLED_ROUTES.join('\n');
    expect(blob).not.toMatch(/\/storage\//);
    expect(blob).not.toMatch(/\/billing\//);
  });

  it('denylist is the audited 68 entries (guard against accidental edits)', () => {
    expect(PROD_DISABLED_ROUTES.length).toBe(68);
  });
});
