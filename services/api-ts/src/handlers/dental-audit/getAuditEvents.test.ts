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
import { AuditRepository } from '@/handlers/audit/repos/audit.repo';
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

  // --------------------------------------------------------------------------
  // EM-AUD-002 / AC-AUD-003 (cross-tenant read denial): a legitimately onboarded
  // dentist_owner of ORG_A must NOT be able to read the audit trail of ORG_B by
  // passing ORG_B's branchId. The 403-role test above seeds no membership (denies
  // for "no membership at all"); this proves the resource-scoped branch invariant
  // with a *real* owner of a *different* org — the only test that exercises the
  // cross-tenant leak path (the leak the EM-AUD-002 branchId guard exists to stop).
  // Per dental-imaging/pmd carry-forward: cross-branch isolation must be tested with
  // a full-role member of a *different* org, not just a no-membership outsider.
  // --------------------------------------------------------------------------
  test('AC-AUD-003: ORG_A owner passing ORG_B branchId → 403 (cross-tenant audit read denied)', async () => {
    const ORG_B = 'da090001-0000-0000-0000-0000000000b0';
    const BRANCH_B = 'da090001-0000-0000-0000-0000000000c0';
    const OWNER_B = 'da090001-0000-0000-0000-0000000000d0';

    // ORG_A owner (the caller) + their own branch/membership.
    await seedOwnerBranch();

    // A wholly independent ORG_B with its own owner, branch, membership, and a
    // sensitive audit row. The ORG_A caller has NO membership in BRANCH_B.
    await new OrganizationRepository(db).createOne({
      id: ORG_B, name: 'Rival Clinic', tier: 'clinic',
      ownerPersonId: OWNER_B, countryCode: 'PH', active: true,
    });
    await new BranchRepository(db).createOne({
      id: BRANCH_B, organizationId: ORG_B, name: 'Rival Branch',
      timezone: 'Asia/Manila', active: true,
    });
    await new MembershipRepository(db).createOne({
      branchId: BRANCH_B, personId: OWNER_B, displayName: 'Rival Owner',
      role: 'dentist_owner', status: 'active', pinFailedAttempts: 0,
    });
    await new AuditLogRepository(db).insert({
      tenantId: ORG_B, branchId: BRANCH_B, actorId: OWNER_B,
      eventType: 'data-modification', action: 'invoice.voided',
      targetType: 'dental_invoice',
      targetId: 'da090001-0000-0000-0000-0000000000e0',
    });

    // ORG_A owner attempts to read ORG_B's audit trail by passing BRANCH_B.
    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(`/dental/audit-events?branchId=${BRANCH_B}`);
    expect(res.status).toBe(403);
    // Body must NOT echo ORG_B's audit data.
    expect(JSON.stringify(await res.json())).not.toContain('invoice.voided');
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

// ----------------------------------------------------------------------------
// V-AUD-SINK-001 (#18 / decision-log Q2): SINGLE PANE. Base-module PHI-access
// reads (data-access events that land in the base `audit_log_entry` sink #3) are
// surfaced into the dental viewer, scoped to the viewed branch's own active
// members (actor-scope — base rows carry no branch/tenant column). Resolves the
// MODULE_SPEC §10c "CANNOT see base PHI reads" boundary now that Q2 is decided.
// The physical 3→1 sink merge stays deferred to V2 (this is a read-time union).
// ----------------------------------------------------------------------------

const NON_MEMBER_ID = 'da090001-0000-0000-0000-0000000000f0';
const PATIENT_ID = 'da090001-0000-0000-0000-0000000000a1';

async function seedBasePhiRead(opts: {
  user: string;
  resourceType?: string;
  resource?: string;
  details?: Record<string, unknown>;
}) {
  // Mirrors how listMedicalHistory et al. record a PHI read into the BASE audit
  // sink (`audit.logEvent`), the events the dental viewer historically could not see.
  await new AuditRepository(db, {
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  } as any).logEvent(
    {
      eventType: 'data-access',
      category: 'clinical',
      action: 'read',
      outcome: 'success',
      user: opts.user,
      userType: 'client',
      resourceType: opts.resourceType ?? 'medical-history',
      resource: opts.resource ?? PATIENT_ID,
      description: 'Medical history listed for patient',
      details: opts.details ?? { resultCount: 3 },
    },
    opts.user,
  );
}

describe('V-AUD-SINK-001: base-module PHI reads surface in the dental viewer (single pane)', () => {
  afterEach(async () => {
    await db.execute(
      sql`TRUNCATE TABLE dental_audit_log, dental_membership, dental_branch, dental_organization, audit_log_entry CASCADE`,
    );
  });

  test('a base PHI read by a branch member is merged into the viewer alongside dental events', async () => {
    await seedOwnerBranch();
    // One dental sink-#1 event ...
    await new AuditLogRepository(db).insert({
      tenantId: TENANT_ID, branchId: BRANCH_ID, actorId: OWNER_ID,
      eventType: 'data-modification', action: 'invoice.voided', targetType: 'dental_invoice',
    });
    // ... and one base sink-#3 PHI read by the same (member) owner.
    await seedBasePhiRead({ user: OWNER_ID, resourceType: 'medical-history', resource: PATIENT_ID });

    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(`/dental/audit-events?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    // Single pane: both the dental modification AND the base PHI read are present.
    const baseRead = body.data.find((e: any) => e.resourceType === 'medical-history');
    expect(baseRead).toBeDefined();
    expect(baseRead.action).toBe('read');
    expect(baseRead.eventType).toBe('data-access');
    expect(baseRead.actorId).toBe(OWNER_ID);
    expect(baseRead.resourceId).toBe(PATIENT_ID);
    // Provenance marker so the owner can tell platform reads from dental events.
    expect(baseRead.metadata).toEqual({ source: 'base' });
    expect(body.meta.total).toBe(2);
  });

  test('a base PHI read by a NON-member (other clinic) does NOT leak into the viewer', async () => {
    await seedOwnerBranch();
    // POSITIVE CONTROL: a member's read MUST be visible — proves the absence below
    // is real scoping, not an accidentally-empty result.
    await seedBasePhiRead({ user: OWNER_ID, resourceType: 'medical-history', resource: PATIENT_ID });
    // A data-access read performed by someone with no active membership in BRANCH_ID.
    await seedBasePhiRead({ user: NON_MEMBER_ID, resourceType: 'medical-history' });

    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(`/dental/audit-events?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // The member's read is present ...
    expect(body.data.some((e: any) => e.actorId === OWNER_ID)).toBe(true);
    // ... but no row is attributable to the non-member; cross-tenant scope holds.
    expect(body.data.some((e: any) => e.actorId === NON_MEMBER_ID)).toBe(false);
  });

  test('base PHI-read details are dropped — latent PHI never reaches the viewer', async () => {
    await seedOwnerBranch();
    await seedBasePhiRead({
      user: OWNER_ID,
      resourceType: 'medical-history',
      details: { resultCount: 3, patientName: 'SHOULD NOT LEAK' },
    });

    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(`/dental/audit-events?branchId=${BRANCH_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(JSON.stringify(body)).not.toContain('SHOULD NOT LEAK');
    const baseRead = body.data.find((e: any) => e.resourceType === 'medical-history');
    // The base `details` JSONB must not survive onto the DTO under any key.
    expect(baseRead).not.toHaveProperty('details');
    expect(baseRead.metadata).toEqual({ source: 'base' });
  });

  test('a freeform dental action filter does not crash the base-sink enum query (EM-AUD regression)', async () => {
    // base `audit_log_entry.action` is a Postgres ENUM; the viewer action filter is
    // freeform. A dental action like `patient.registered` must not reach the enum
    // comparison (would 500) — the base sink simply contributes nothing.
    await seedOwnerBranch();
    await new AuditLogRepository(db).insert({
      tenantId: TENANT_ID, branchId: BRANCH_ID, actorId: OWNER_ID,
      eventType: 'data-modification', action: 'patient.registered', targetType: 'dental_patient',
    });
    await seedBasePhiRead({ user: OWNER_ID, resourceType: 'medical-history' });

    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(
      `/dental/audit-events?branchId=${BRANCH_ID}&action=patient.registered`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].action).toBe('patient.registered');
  });

  test('eventType=data-modification excludes base data-access reads (filter is honored across sinks)', async () => {
    await seedOwnerBranch();
    await new AuditLogRepository(db).insert({
      tenantId: TENANT_ID, branchId: BRANCH_ID, actorId: OWNER_ID,
      eventType: 'data-modification', action: 'invoice.voided', targetType: 'dental_invoice',
    });
    await seedBasePhiRead({ user: OWNER_ID, resourceType: 'medical-history' });

    const app = buildTestApp({ id: OWNER_ID, role: 'dentist_owner' });
    const res = await app.request(
      `/dental/audit-events?branchId=${BRANCH_ID}&eventType=data-modification`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].eventType).toBe('data-modification');
    expect(body.meta.total).toBe(1);
  });
});
