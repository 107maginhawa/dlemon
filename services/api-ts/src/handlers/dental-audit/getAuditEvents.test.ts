/**
 * getAuditEvents handler tests
 *
 * Path: GET /dental/audit-events
 * Auth: dentist_owner only.
 *
 * EM-AUD-002: branchId is a REQUIRED query param per AUDIT_CONTRACTS.md §5
 * (branch_id = YES) and rule AC-AUD-003 ("Returns only events for requesting
 * user's branch"). Without it, AuditLogRepository.list applies no branch/tenant
 * condition and returns rows across ALL tenants — a cross-tenant leak. This suite
 * locks the 400 guard so the endpoint can never run unscoped.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import { getAuditEvents } from './getAuditEvents';
import { AuditLogRepository } from './repos/audit-log.repo';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const OWNER_ID = 'da090001-0000-0000-0000-000000000001';
const ORG_ID = 'da090001-0000-0000-0000-000000000030';
const BRANCH_ID = 'da090001-0000-0000-0000-000000000020';
const TENANT_ID = ORG_ID;

function buildTestApp(user?: { id: string; role?: string }) {
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
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.get('/dental/audit-events', getAuditEvents);
  return app;
}

describe('getAuditEvents handler', () => {
  test('returns 401 when user is not authenticated', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/dental/audit-events');
    expect(res.status).toBe(401);
  });

  test('returns 403 when caller lacks dentist_owner role', async () => {
    const app = buildTestApp({ id: OWNER_ID, role: 'staff_full' });
    const res = await app.request('/dental/audit-events?branchId=da090001-0000-0000-0000-000000000020');
    expect(res.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // EM-AUD-002: branchId is required (prevents cross-tenant leak)
  // --------------------------------------------------------------------------
  test('EM-AUD-002: returns 400 when branchId is omitted', async () => {
    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request('/dental/audit-events');
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  // --------------------------------------------------------------------------
  // V-AUD-002: date range validation (from must be <= to)
  // --------------------------------------------------------------------------
  test('V-AUD-002: returns 422 INVALID_DATE_RANGE when from > to', async () => {
    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(
      `/dental/audit-events?branchId=${BRANCH_ID}&from=2026-05-30T00:00:00Z&to=2026-05-01T00:00:00Z`,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_DATE_RANGE');
  });

  test('V-AUD-002: returns 400 when from is not a parseable date', async () => {
    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(
      `/dental/audit-events?branchId=${BRANCH_ID}&from=not-a-date`,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ----------------------------------------------------------------------------
// V-AUD-003: response is mapped to the contract DTO and drops snapshot columns
// ----------------------------------------------------------------------------

async function seedOwnerBranch() {
  await new OrganizationRepository(db).createOne({
    id: ORG_ID, name: 'Audit DTO Clinic', tier: 'clinic',
    ownerPersonId: OWNER_ID, countryCode: 'PH', active: true,
  });
  await new BranchRepository(db).createOne({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main Branch',
    timezone: 'Asia/Manila', active: true,
  });
  await new MembershipRepository(db).createOne({
    branchId: BRANCH_ID, personId: OWNER_ID, displayName: 'Owner',
    role: 'dentist_owner', status: 'active', pinFailedAttempts: 0,
  });
}

describe('V-AUD-003: contract DTO mapping', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_audit_log, dental_membership, dental_branch, dental_organization CASCADE`);
  });

  test('maps rows to the contract DTO and omits before/after snapshots', async () => {
    await seedOwnerBranch();
    await new AuditLogRepository(db).insert({
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      actorId: OWNER_ID,
      eventType: 'data-modification',
      action: 'invoice.voided',
      targetType: 'dental_invoice',
      targetId: 'da090001-0000-0000-0000-000000000099',
      beforeSnapshot: { status: 'issued', patientName: 'SHOULD NOT LEAK' },
      afterSnapshot: { status: 'voided' },
    });

    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(`/dental/audit-events?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(1);

    const ev = body.data[0];
    // Contract DTO field names (not raw DB camelCase like targetType/timestamp present together)
    expect(ev.resourceType).toBe('dental_invoice');
    expect(ev.resourceId).toBe('da090001-0000-0000-0000-000000000099');
    expect(ev.eventType).toBe('data-modification');
    expect(ev.action).toBe('invoice.voided');
    expect(typeof ev.timestamp).toBe('string');

    // Latent-PHI snapshot fields must NOT be present in the response.
    expect(ev).not.toHaveProperty('beforeSnapshot');
    expect(ev).not.toHaveProperty('afterSnapshot');
    expect(JSON.stringify(body)).not.toContain('SHOULD NOT LEAK');
  });

  test('V-AUD-NEW-B: records an ACCESSED self-audit event when the audit log is viewed', async () => {
    await seedOwnerBranch();
    // Seed one unrelated data-modification event so the viewer returns something.
    await new AuditLogRepository(db).insert({
      tenantId: TENANT_ID, branchId: BRANCH_ID, actorId: OWNER_ID,
      eventType: 'data-modification', action: 'invoice.voided', targetType: 'dental_invoice',
    });

    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(
      `/dental/audit-events?branchId=${BRANCH_ID}&eventType=data-modification`,
    );
    expect(res.status).toBe(200);

    // A self-audit ACCESSED event must have been written for the viewing action.
    const { entries } = await new AuditLogRepository(db).list(
      { branchId: BRANCH_ID, targetType: 'dental_audit_log', actorId: OWNER_ID },
      { limit: 10, offset: 0 },
    );
    expect(entries.length).toBe(1);
    const access = entries[0]!;
    expect(access.action).toBe('audit_log.accessed');
    expect(access.eventType).toBe('security');
    expect(access.actorId).toBe(OWNER_ID);
    expect(access.branchId).toBe(BRANCH_ID);
    // Metadata captures filter scope / counts only — never PHI.
    const md = access.metadata as Record<string, unknown>;
    expect(md['eventType']).toBe('data-modification');
    expect(typeof md['resultCount']).toBe('number');
    // No before/after snapshots on a read event.
    expect(access.beforeSnapshot).toBeNull();
    expect(access.afterSnapshot).toBeNull();
  });

  test('V-AUD-004: filters by event_type (eventType query param)', async () => {
    await seedOwnerBranch();
    const repo = new AuditLogRepository(db);
    await repo.insert({
      tenantId: TENANT_ID, branchId: BRANCH_ID, actorId: OWNER_ID,
      eventType: 'security', action: 'access.denied', targetType: 'dental_patient',
    });
    await repo.insert({
      tenantId: TENANT_ID, branchId: BRANCH_ID, actorId: OWNER_ID,
      eventType: 'data-modification', action: 'invoice.voided', targetType: 'dental_invoice',
    });

    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(`/dental/audit-events?branchId=${BRANCH_ID}&eventType=security`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].eventType).toBe('security');
    expect(body.meta.total).toBe(1);
  });
});
