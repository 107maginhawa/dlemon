/**
 * createOnboarding handler tests — self-service clinic onboarding.
 *
 * Path: POST /dental/onboarding
 *
 * Covers (splendid-roaming-kitten plan, Phase 1 TDD):
 *  - 401 unauthenticated
 *  - 201 success: caller becomes org owner; org status 'provisional'; default branch
 *        + caller's dentist_owner membership all created atomically; 3-ID response shape
 *  - 409 ORG_LIMIT_REACHED when the owner already has an active self-service org
 *  - 403 EMAIL_NOT_VERIFIED in production when the caller's email is unverified
 *        (its OWN check — independent of the sign-in requireEmailVerification flag)
 *  - 201 in production when the email IS verified
 *  - 403 TIER_NOT_SELF_SERVICE for group/enterprise tiers
 *  - 429 when the per-IP rate limit is exhausted
 *  - transactional safety: a failure mid-provision leaves NO partial org/branch/member
 */

import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { createOnboarding, onboardingLimiter } from './createOnboarding';
import { CreateOnboardingBody } from '@/generated/openapi/validators';
import { dentalOrganizations } from './repos/organization.schema';
import { dentalBranches } from './repos/branch.schema';
import { dentalMemberships } from './repos/membership.schema';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test',
});

// UUID namespace: eb-prefix — no collision with other test files
const OWNER_ID = 'eb000000-0000-1000-8000-000000000001';
const OWNER2_ID = 'eb000000-0000-1000-8000-000000000002';

interface TestUser {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}

const verifiedOwner: TestUser = {
  id: OWNER_ID,
  email: 'owner@clinic.test',
  name: 'Dr. Test Owner',
  emailVerified: true,
};

const validationErrorHandler = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed' }, 400);
};

function buildTestApp(user?: TestUser, database: any = db) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', database);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post(
    '/dental/onboarding',
    zValidator('json', CreateOnboardingBody, validationErrorHandler),
    createOnboarding as any,
  );

  return app;
}

function onboard(
  app: Hono,
  body: Record<string, unknown>,
  ip = '198.51.100.1',
) {
  return app.request('/dental/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

const validBody = {
  organizationName: 'Bright Smile Dental',
  tier: 'clinic',
  countryCode: 'PH',
};

describe('createOnboarding handler', () => {
  beforeEach(() => {
    onboardingLimiter.reset();
  });

  afterEach(async () => {
    onboardingLimiter.reset();
    await db.execute(
      sql`TRUNCATE TABLE dental_membership, dental_branch, dental_organization CASCADE`,
    );
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  test('returns 401 when unauthenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await onboard(app, validBody);
    expect(res.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Success — atomic provisioning
  // --------------------------------------------------------------------------

  test('returns 201 and provisions org + branch + owner membership atomically', async () => {
    const app = buildTestApp(verifiedOwner);
    const res = await onboard(app, {
      organizationName: 'Bright Smile Dental',
      tier: 'clinic',
      countryCode: 'PH',
      branchName: 'Main Branch',
      timezone: 'Asia/Manila',
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.organizationId).toBeTruthy();
    expect(body.branchId).toBeTruthy();
    expect(body.membershipId).toBeTruthy();

    // Org: caller is owner, status provisional
    const [org] = await db
      .select()
      .from(dentalOrganizations)
      .where(eq(dentalOrganizations.id, body.organizationId));
    expect(org).toBeTruthy();
    expect(org!.ownerPersonId).toBe(OWNER_ID);
    expect(org!.status).toBe('provisional');
    expect(org!.active).toBe(true);
    expect(org!.name).toBe('Bright Smile Dental');

    // Branch belongs to the org
    const [branch] = await db
      .select()
      .from(dentalBranches)
      .where(eq(dentalBranches.id, body.branchId));
    expect(branch).toBeTruthy();
    expect(branch!.organizationId).toBe(body.organizationId);
    expect(branch!.name).toBe('Main Branch');
    expect(branch!.timezone).toBe('Asia/Manila');

    // Membership: caller is the dentist_owner in the branch
    const [membership] = await db
      .select()
      .from(dentalMemberships)
      .where(eq(dentalMemberships.id, body.membershipId));
    expect(membership).toBeTruthy();
    expect(membership!.branchId).toBe(body.branchId);
    expect(membership!.personId).toBe(OWNER_ID);
    expect(membership!.role).toBe('dentist_owner');
    expect(membership!.status).toBe('active');
  });

  test('defaults branchName to org name and timezone to Asia/Manila', async () => {
    const app = buildTestApp(verifiedOwner);
    const res = await onboard(app, validBody);
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    const [branch] = await db
      .select()
      .from(dentalBranches)
      .where(eq(dentalBranches.id, body.branchId));
    expect(branch!.name).toBe('Bright Smile Dental');
    expect(branch!.timezone).toBe('Asia/Manila');
  });

  // --------------------------------------------------------------------------
  // One active org per owner
  // --------------------------------------------------------------------------

  test('returns 409 ORG_LIMIT_REACHED when owner already has an active org', async () => {
    const app = buildTestApp(verifiedOwner);
    const first = await onboard(app, validBody);
    expect(first.status).toBe(201);

    const second = await onboard(app, {
      organizationName: 'Second Clinic',
      tier: 'solo',
      countryCode: 'PH',
    });
    expect(second.status).toBe(409);
    const body = (await second.json()) as any;
    expect(body.code).toBe('ORG_LIMIT_REACHED');
  });

  // --------------------------------------------------------------------------
  // Verified-email guardrail (production only, own check)
  // --------------------------------------------------------------------------

  test('returns 403 EMAIL_NOT_VERIFIED in production when email is unverified', async () => {
    const prev = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const app = buildTestApp({ ...verifiedOwner, emailVerified: false });
      const res = await onboard(app, validBody);
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    } finally {
      process.env['NODE_ENV'] = prev;
    }
  });

  test('returns 201 in production when email IS verified', async () => {
    const prev = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const app = buildTestApp({ ...verifiedOwner, emailVerified: true });
      const res = await onboard(app, validBody);
      expect(res.status).toBe(201);
    } finally {
      process.env['NODE_ENV'] = prev;
    }
  });

  // --------------------------------------------------------------------------
  // Self-service tier guardrail
  // --------------------------------------------------------------------------

  test('returns 403 TIER_NOT_SELF_SERVICE for group/enterprise tiers', async () => {
    const app = buildTestApp(verifiedOwner);
    const res = await onboard(app, {
      organizationName: 'Big Group',
      tier: 'enterprise',
      countryCode: 'PH',
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.code).toBe('TIER_NOT_SELF_SERVICE');
  });

  // --------------------------------------------------------------------------
  // Rate limit
  // --------------------------------------------------------------------------

  test('returns 429 once the per-IP rate limit is exhausted', async () => {
    const ip = '203.0.113.42';
    // Exhaust the limiter for this IP key (limit-agnostic) using the handler's key shape.
    let r;
    do {
      r = onboardingLimiter.check(`onboard:${ip}`);
    } while (r.allowed);

    const app = buildTestApp(verifiedOwner);
    const res = await onboard(app, validBody, ip);
    expect(res.status).toBe(429);
  });

  // --------------------------------------------------------------------------
  // Transactional safety
  // --------------------------------------------------------------------------

  test('rolls back fully when membership creation fails mid-provision', async () => {
    // Poison the membership insert inside the transaction; org + branch must NOT persist.
    const poisonedDb = new Proxy(db, {
      get(target, prop) {
        if (prop === 'transaction') {
          return (fn: any) =>
            (target as any).transaction((tx: any) => {
              const txProxy = new Proxy(tx, {
                get(t, p) {
                  if (p === 'insert') {
                    return (table: any) => {
                      if (table === dentalMemberships) {
                        throw new Error('injected membership failure');
                      }
                      return t.insert(table);
                    };
                  }
                  const val = (t as any)[p];
                  return typeof val === 'function' ? val.bind(t) : val;
                },
              });
              return fn(txProxy);
            });
        }
        const val = (target as any)[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      },
    });

    const app = buildTestApp(verifiedOwner, poisonedDb);
    const res = await onboard(app, validBody);
    expect(res.status).toBe(500);

    // No partial rows survived.
    const orgs = await db
      .select()
      .from(dentalOrganizations)
      .where(eq(dentalOrganizations.ownerPersonId, OWNER_ID));
    expect(orgs).toHaveLength(0);
    const branches = await db.select().from(dentalBranches);
    expect(branches).toHaveLength(0);
    const members = await db.select().from(dentalMemberships);
    expect(members).toHaveLength(0);
  });
});
