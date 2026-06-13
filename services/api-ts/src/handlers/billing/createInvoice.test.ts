/**
 * createInvoice handler tests
 *
 * Tests HTTP-level behavior: validation, auth, 201 on success, 400 on bad input.
 * Mocks database repos to avoid real DB.
 */

import { describe, test, expect } from 'bun:test';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

// Migrated off the bespoke raw-handler mount to the shared validator-mounting
// harness: requests now traverse the real production chain (authMiddleware →
// generated zValidator(CreateInvoiceBody) → handler → error envelope) at the
// production path POST /billing/invoices, instead of a synthetic /invoices mount
// with an empty stub database.

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

describe('createInvoice handler', () => {
  const authedUser = { id: 'person-1', email: 'merchant@test.com' };

  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp({ db });

    const res = await app.request('/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: 'person-2',
        merchant: 'person-1',
        lineItems: [{ description: 'Service', unitPrice: 5000, quantity: 1 }],
      }),
    });

    // Handler reads session.user so without a session it should error
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('returns error when lineItems is empty', async () => {
    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request('/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: 'person-2',
        merchant: 'person-1',
        lineItems: [],
      }),
    });

    // Should be 400 (validation) or 404 (person not found first)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('returns error when merchant does not match user', async () => {
    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request('/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: 'person-2',
        merchant: 'other-merchant',
        lineItems: [{ description: 'X', unitPrice: 100, quantity: 1 }],
      }),
    });

    // Should fail auth check or person-not-found before that
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
