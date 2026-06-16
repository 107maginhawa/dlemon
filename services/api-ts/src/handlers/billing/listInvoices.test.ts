/**
 * listInvoices.test.ts — P1-1 security pin.
 *
 * GET /billing/invoices forced no ownership filter, and the generic `invoice`
 * table has no tenant column / no RLS — so any authenticated user could page
 * every invoice system-wide, or enumerate a provider's book via
 * `?merchant=<victim>`. This test mounts the REAL handler with a stubbed
 * InvoiceRepository and asserts the non-admin scoping: a foreign merchant/customer
 * filter is rejected (403), an unscoped list is scoped to the caller, and an
 * admin is unrestricted.
 *
 * Run: DATABASE_URL=…monobase_test bun run scripts/test-with-db.ts \
 *   src/handlers/billing/listInvoices.test.ts   (from services/api-ts)
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { ListInvoicesQuery } from '@/generated/openapi/validators';

let capturedFilters: Record<string, unknown> | null = null;
mock.module('./repos/billing.repo', () => ({
  InvoiceRepository: class {
    findManyWithPagination = async (filters: Record<string, unknown>) => {
      capturedFilters = filters;
      return { data: [], totalCount: 0 };
    };
  },
}));

const { listInvoices } = await import('./listInvoices');

const SELF = 'aa000000-0000-4000-8000-000000000001';
const OTHER = 'bb000000-0000-4000-8000-000000000002';

function buildApp(user: { id: string; role?: string }) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message }, err.statusCode as 403);
    return c.json({ error: String(err) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as unknown as { set: (k: string, v: unknown) => void };
    ctx.set('database', {});
    ctx.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    ctx.set('session', { user: { id: user.id, email: 'u@test.com', role: user.role ?? 'user' } });
    await next();
  });
  app.get('/billing/invoices', zValidator('query', ListInvoicesQuery), listInvoices as never);
  return app;
}

describe('P1-1: listInvoices ownership scoping', () => {
  beforeEach(() => {
    capturedFilters = null;
  });

  test('a non-admin passing a FOREIGN ?merchant is rejected (403)', async () => {
    const res = await buildApp({ id: SELF }).request(`/billing/invoices?merchant=${OTHER}`);
    expect(res.status).toBe(403);
  });

  test('a non-admin passing a FOREIGN ?customer is rejected (403)', async () => {
    const res = await buildApp({ id: SELF }).request(`/billing/invoices?customer=${OTHER}`);
    expect(res.status).toBe(403);
  });

  test('a non-admin with NO filter is scoped to their own merchant book (no system-wide list)', async () => {
    const res = await buildApp({ id: SELF }).request('/billing/invoices');
    expect(res.status).toBe(200);
    expect(capturedFilters?.['merchant']).toBe(SELF);
  });

  test('a non-admin passing their OWN ?merchant succeeds', async () => {
    const res = await buildApp({ id: SELF }).request(`/billing/invoices?merchant=${SELF}`);
    expect(res.status).toBe(200);
    expect(capturedFilters?.['merchant']).toBe(SELF);
  });

  test('an admin is NOT auto-scoped (may list across the system)', async () => {
    const res = await buildApp({ id: SELF, role: 'admin' }).request('/billing/invoices');
    expect(res.status).toBe(200);
    expect(capturedFilters?.['merchant']).toBeUndefined();
  });
});
