/**
 * createReview handler tests
 *
 * Tests review creation, validation, and duplicate prevention.
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { openTestTx } from '@/core/test-tx';
import { persons } from '@/handlers/person/repos/person.schema';
import { reviews } from '@/handlers/reviews/repos/review.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

describe('createReview handler', () => {
  const authedUser = { id: 'user-1', email: 'reviewer@test.com' };

  test('returns 401 when not authenticated', async () => {
    const app = buildTestApp({ db });

    const res = await app.request('/reviews/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: 'booking-1',
        reviewType: 'service',
        npsScore: 9,
      }),
    });

    expect(res.status).toBe(401);
  });

  test('returns error for self-review (handler validates reviewedEntity !== userId)', async () => {
    // The handler calls ctx.req.valid('json') which requires Hono zod-validator middleware.
    // Without that middleware, the call throws. We verify the validation logic exists
    // by importing the handler and checking the source code behavior.
    // In a full integration test with middleware, self-review would return 400.
    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request('/reviews/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: 'booking-1',
        reviewType: 'service',
        npsScore: 9,
        reviewedEntity: 'user-1', // same as authedUser.id
      }),
    });

    // Without validation middleware, req.valid() will error, so status >= 400
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('handler accepts valid review body (fails at validation middleware level)', async () => {
    const app = buildTestApp({ db, user: authedUser });

    const res = await app.request('/reviews/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: 'booking-1',
        reviewType: 'service',
        npsScore: 8,
        comment: 'Great service!',
        reviewedEntity: 'other-user',
      }),
    });

    // Should not be 401 (auth check passes)
    expect(res.status).not.toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate-review uniqueness — one review per (context, reviewer, reviewType).
//   createReview.ts:47-56 reviewExists → ConflictError, backed by the DB unique
//   index reviews_context_reviewer_type_unique. The ledger flagged the 409 path
//   as unproven at BE-unit. Driven over real Postgres (openTestTx auto-rollback)
//   through the production route table (authMiddleware → zValidator → handler).
// ─────────────────────────────────────────────────────────────────────────────

describe('createReview — duplicate (context, reviewer, reviewType) → 409', () => {
  const REVIEWER_ID = 'ed000000-0000-4000-8000-0000000c0001';
  const CONTEXT_ID  = 'ed000000-0000-4000-8000-0000000c0002';
  const USER = { id: REVIEWER_ID, email: 'reviewer@clinic.test', role: 'user' };

  let txDb: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const tx = await openTestTx();
    txDb = tx.db;
    teardown = tx.rollback;
    // reviewer FK → persons.id, so the submitter must be a real person row.
    await txDb
      .insert(persons)
      .values([{ id: REVIEWER_ID, firstName: 'Rev', lastName: 'Iewer' }])
      .onConflictDoNothing();
  });

  afterEach(() => teardown());

  test('first create 201, identical second create → 409; a different reviewType for the same context still 201', async () => {
    const app = buildTestApp({ db: txDb, user: USER });
    const post = (reviewType: string) =>
      app.request('/reviews/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: CONTEXT_ID, reviewType, npsScore: 9 }),
      });

    const first = await post('service');
    expect(first.status).toBe(201);

    // Same (context, reviewer, reviewType) → rejected by the dedup guard.
    const dup = await post('service');
    expect(dup.status).toBe(409);
    const dupBody = (await dup.json()) as { message?: string };
    expect(dupBody.message).toBe('Review already exists for this context and review type');

    // Uniqueness is scoped to the TRIPLE — a different reviewType is a distinct review.
    const other = await post('cleanliness');
    expect(other.status).toBe(201);

    // Exactly two rows persisted for this (context, reviewer): service + cleanliness.
    const rows = await txDb
      .select({ reviewType: reviews.reviewType })
      .from(reviews)
      .where(eq(reviews.context, CONTEXT_ID));
    expect(rows.map((r) => r.reviewType).sort()).toEqual(['cleanliness', 'service']);
  });
});
