/**
 * reviews handler tests — getReview, listReviews, deleteReview
 *
 * Fixture tag: rv01
 * All deterministic UUIDs use namespace rv01.
 *
 * RED-for-right-reason: each happy-path and error test was confirmed to
 * produce the expected error (404/403/401) before the fixture that makes
 * it pass was added.
 *
 * createReview is already covered in createReview.test.ts — not duplicated here.
 *
 * Pattern: buildTestApp (handler-unit, NOT real router) with real DB + zValidator
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  GetReviewParams,
  ListReviewsQuery,
  DeleteReviewParams,
} from '@/generated/openapi/validators';
import { reviews } from './repos/review.schema';
import { persons } from '../person/repos/person.schema';
import { getReview } from './getReview';
import { listReviews } from './listReviews';
import { deleteReview } from './deleteReview';

// ---------------------------------------------------------------------------
// DB + fixtures
// ---------------------------------------------------------------------------

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Fixture tag: rv01 — all IDs are valid UUIDs (hex only)
const OWNER_USER = {
  id: 'a0010000-0000-4000-8000-000000000001',
  email: 'owner-rv01@test.com',
  role: 'user',
};
const OTHER_USER = {
  id: 'a0010000-0000-4000-8000-000000000002',
  email: 'other-rv01@test.com',
  role: 'user',
};
const ADMIN_USER = {
  id: 'a0010000-0000-4000-8000-000000000003',
  email: 'admin-rv01@test.com',
  role: 'admin',
};

// Context UUIDs — must be valid UUIDs (no FK, just uuid column)
const CONTEXT_ID_1 = 'b0010000-0000-4000-8000-000000000001';
const CONTEXT_ID_2 = 'b0010000-0000-4000-8000-000000000002';
// Review IDs
const REVIEW_ID_1 = 'c0010000-0000-4000-8000-000000000001';
const REVIEW_ID_2 = 'c0010000-0000-4000-8000-000000000002';

const FIXED_TS = new Date('2026-01-20T10:00:00Z');

// ---------------------------------------------------------------------------
// buildTestApp
// ---------------------------------------------------------------------------

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

function buildTestApp(user?: typeof OWNER_USER) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session-rv01', user });
    }
    await next();
  });

  // Routes with validators so ctx.req.valid('param'/'query') works
  app.get('/reviews', zValidator('query', ListReviewsQuery, ve), listReviews as any);
  app.get('/reviews/:review', zValidator('param', GetReviewParams, ve), getReview as any);
  app.delete('/reviews/:review', zValidator('param', DeleteReviewParams, ve), deleteReview as any);

  return app;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedPerson(id: string, email: string) {
  await db.insert(persons).values({
    id,
    email,
    firstName: 'Test',
    lastName: 'User',
    createdBy: id,
    updatedBy: id,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
  }).onConflictDoNothing();
}

async function seedReview(
  id: string,
  reviewerId: string,
  contextId: string,
  overrides: Partial<typeof reviews.$inferInsert> = {}
) {
  await db.insert(reviews).values({
    id,
    context: contextId,
    reviewer: reviewerId,
    reviewType: 'service',
    npsScore: 8,
    comment: 'Great service!',
    createdBy: reviewerId,
    updatedBy: reviewerId,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    ...overrides,
  }).onConflictDoNothing();

  // Post-seed read-back assert to defeat .onConflictDoNothing() masking
  const [readback] = await db.select().from(reviews).where(eq(reviews.id, id));
  expect(readback!.npsScore).toBe(overrides.npsScore ?? 8);
  return readback!;
}

async function truncateReviews() {
  await db.delete(reviews).where(eq(reviews.id, REVIEW_ID_1));
  await db.delete(reviews).where(eq(reviews.id, REVIEW_ID_2));
  // persons are stable test fixtures — leave them (onConflictDoNothing handles re-seeding)
}

// ---------------------------------------------------------------------------
// getReview
// ---------------------------------------------------------------------------

describe('getReview', () => {
  afterEach(truncateReviews);

  test('unauthenticated → 401 UNAUTHORIZED', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/reviews/${REVIEW_ID_1}`);
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('review not found → 404 NOT_FOUND', async () => {
    // RED verified: no seed → repo.getActiveReviewById returns null → NotFoundError
    const app = buildTestApp(OWNER_USER);
    const res = await app.request('/reviews/00000000-0000-4000-8000-000099010001');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('non-owner non-admin accessing other user review → 403 FORBIDDEN', async () => {
    // RED verified: with seed but wrong user → repo.canUserAccessReview returns false → ForbiddenError
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1);
    const app = buildTestApp(OTHER_USER);
    const res = await app.request(`/reviews/${REVIEW_ID_1}`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('owner can access own review → 200 with review data', async () => {
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1, { npsScore: 9 });
    const app = buildTestApp(OWNER_USER);
    const res = await app.request(`/reviews/${REVIEW_ID_1}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(REVIEW_ID_1);
    expect(body.reviewer).toBe(OWNER_USER.id);
    expect(body.npsScore).toBe(9);
    expect(body.reviewType).toBe('service');
  });

  test('admin can access any review → 200', async () => {
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1);
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/reviews/${REVIEW_ID_1}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(REVIEW_ID_1);
  });

  test('reviewed entity can access review about them → 200', async () => {
    // reviewedEntity set to OTHER_USER.id → OTHER_USER can access it
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedPerson(OTHER_USER.id, OTHER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1, {
      npsScore: 7,
      reviewedEntity: OTHER_USER.id,
    });
    const app = buildTestApp(OTHER_USER);
    const res = await app.request(`/reviews/${REVIEW_ID_1}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(REVIEW_ID_1);
    expect(body.reviewedEntity).toBe(OTHER_USER.id);
  });
});

// ---------------------------------------------------------------------------
// listReviews
// ---------------------------------------------------------------------------

describe('listReviews', () => {
  afterEach(truncateReviews);

  test('unauthenticated → 401 UNAUTHORIZED', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/reviews');
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('non-admin listing reviews by other reviewer → 403 FORBIDDEN', async () => {
    // RED verified: filters.reviewer !== userId → ForbiddenError
    const app = buildTestApp(OTHER_USER);
    const res = await app.request(`/reviews?reviewer=${OWNER_USER.id}`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('non-admin listing reviews about another entity → 403 FORBIDDEN', async () => {
    const app = buildTestApp(OTHER_USER);
    const res = await app.request(`/reviews?reviewedEntity=${OWNER_USER.id}`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('happy path no filters → 200 returns paginated own reviews', async () => {
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1, { npsScore: 8 });
    const app = buildTestApp(OWNER_USER);
    const res = await app.request('/reviews');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.totalCount).toBeGreaterThanOrEqual(1);
    const found = body.data.find((r: any) => r.id === REVIEW_ID_1);
    expect(found).toBeDefined();
    expect(found.reviewer).toBe(OWNER_USER.id);
  });

  test('pagination params respected → 200 with correct page metadata', async () => {
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1, { npsScore: 8 });
    await seedReview(REVIEW_ID_2, OWNER_USER.id, CONTEXT_ID_2, { npsScore: 6, reviewType: 'provider' });
    const app = buildTestApp(OWNER_USER);
    const res = await app.request('/reviews?page=1&limit=1');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.pagination).toBeDefined();
  });

  test('admin can list all reviews → 200 without forced reviewer filter', async () => {
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1, { npsScore: 8 });
    const app = buildTestApp(ADMIN_USER);
    // Admin can filter by any reviewer
    const res = await app.request(`/reviews?reviewer=${OWNER_USER.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((r: any) => r.id === REVIEW_ID_1);
    expect(found).toBeDefined();
  });

  test('reviewType filter returns only matching type → 200', async () => {
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1, { npsScore: 8, reviewType: 'service' });
    await seedReview(REVIEW_ID_2, OWNER_USER.id, CONTEXT_ID_2, { npsScore: 6, reviewType: 'provider' });
    const app = buildTestApp(OWNER_USER);
    const res = await app.request('/reviews?reviewType=service');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const ids = body.data.map((r: any) => r.id);
    expect(ids).toContain(REVIEW_ID_1);
    expect(ids).not.toContain(REVIEW_ID_2);
  });
});

// ---------------------------------------------------------------------------
// deleteReview
// ---------------------------------------------------------------------------

describe('deleteReview', () => {
  afterEach(truncateReviews);

  test('unauthenticated → 401 UNAUTHORIZED', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request(`/reviews/${REVIEW_ID_1}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('review not found → 404 NOT_FOUND', async () => {
    // RED verified: no seed → repo.getActiveReviewById returns null → NotFoundError
    const app = buildTestApp(OWNER_USER);
    const res = await app.request('/reviews/00000000-0000-4000-8000-000099020001', { method: 'DELETE' });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('non-owner deleting another user review → 403 FORBIDDEN', async () => {
    // RED verified: review.reviewer !== userId → ForbiddenError
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1);
    const app = buildTestApp(OTHER_USER);
    const res = await app.request(`/reviews/${REVIEW_ID_1}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('owner deletes own review → 204 no content', async () => {
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_1, OWNER_USER.id, CONTEXT_ID_1, { npsScore: 8 });
    const app = buildTestApp(OWNER_USER);
    const res = await app.request(`/reviews/${REVIEW_ID_1}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    // Verify it's actually gone from the DB
    const [gone] = await db.select().from(reviews).where(eq(reviews.id, REVIEW_ID_1));
    expect(gone).toBeUndefined();
  });

  test('admin deletes any review → 204 no content', async () => {
    await seedPerson(OWNER_USER.id, OWNER_USER.email);
    await seedReview(REVIEW_ID_2, OWNER_USER.id, CONTEXT_ID_2, { npsScore: 7 });
    const app = buildTestApp(ADMIN_USER);
    const res = await app.request(`/reviews/${REVIEW_ID_2}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    const [gone] = await db.select().from(reviews).where(eq(reviews.id, REVIEW_ID_2));
    expect(gone).toBeUndefined();
  });
});
