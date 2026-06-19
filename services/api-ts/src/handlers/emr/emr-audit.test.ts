/**
 * emr-audit.test.ts
 *
 * CONF-EMRC-001 / TR-P0-02 — PHI audit-logging assertions for all 6 EMR ops.
 *
 * Before this file the 6 `logAuditEvent` calls in the EMR handlers were
 * line-coverage-only: no test asserted (a) a durable audit row is written,
 * (b) its tenant_id is the non-PHI EMR_AUDIT_TENANT_SENTINEL (NOT the patient
 * UUID — the V-EMR-005 guarantee), or (c) that update logs field NAMES only
 * (never PHI values). A regression reintroducing the patient UUID into the
 * tenant slot, or dropping an audit row, would otherwise pass green.
 *
 * Pattern mirrors emr-coverage.test.ts: real Postgres via openTestTx
 * (auto-rollback) + Hono buildTestApp. We query `dental_audit_log` (the
 * authoritative audit sink written by logAuditEvent) and assert per op.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { AppError } from '@/core/errors';
import { openTestTx } from '@/core/test-tx';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { providers } from '@/handlers/provider/repos/provider.schema';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';
import {
  CreateConsultationRequestSchema,
  UpdateConsultationRequestSchema,
  ListConsultationsQuery,
  ListEMRPatientsQuery,
} from '@/generated/openapi/validators';
import { createConsultation } from './createConsultation';
import { finalizeConsultation } from './finalizeConsultation';
import { getConsultation } from './getConsultation';
import { listConsultations } from './listConsultations';
import { listEMRPatients } from './listEMRPatients';
import { updateConsultation } from './updateConsultation';
import { ConsultationNoteRepository } from './repos/emr.repo';
import { EMR_AUDIT_TENANT_SENTINEL } from './emr-audit';

// ---------------------------------------------------------------------------
// Shared IDs — use range far from existing seed data
// ---------------------------------------------------------------------------

const PROVIDER_PERSON_ID = 'ea000000-0000-4000-8000-000000000001';
const PATIENT_PERSON_ID  = 'ea000000-0000-4000-8000-000000000002';
const OTHER_PERSON_ID    = 'ea000000-0000-4000-8000-000000000003';
const PROVIDER_ID        = 'ea000000-0000-4000-8000-000000000004';
const PATIENT_ID         = 'ea000000-0000-4000-8000-000000000005';
const OTHER_PROVIDER_ID  = 'ea000000-0000-4000-8000-000000000006';

const PROVIDER_USER = { id: PROVIDER_PERSON_ID, email: 'provider@clinic.com', role: 'provider' };
const PATIENT_USER  = { id: PATIENT_PERSON_ID,  email: 'patient@clinic.com',  role: 'patient' };

const noop = () => {};
const logger = { debug: noop, info: noop, warn: noop, error: noop };

// ---------------------------------------------------------------------------
// DB + teardown lifecycle — openTestTx rolls back automatically
// ---------------------------------------------------------------------------

let db: NodePgDatabase;
let teardown: () => Promise<void>;

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  teardown = tx.rollback;

  await db.insert(persons).values([
    { id: PROVIDER_PERSON_ID, firstName: 'Provider', lastName: 'Test' },
    { id: PATIENT_PERSON_ID,  firstName: 'Patient',  lastName: 'Test' },
    { id: OTHER_PERSON_ID,    firstName: 'Other',    lastName: 'Test' },
  ]).onConflictDoNothing();

  await db.insert(providers).values([
    { id: PROVIDER_ID,       person: PROVIDER_PERSON_ID, providerType: 'dentist' },
    { id: OTHER_PROVIDER_ID, person: OTHER_PERSON_ID,    providerType: 'dentist' },
  ]).onConflictDoNothing();

  await db.insert(patients).values([
    { id: PATIENT_ID, person: PATIENT_PERSON_ID },
  ]).onConflictDoNothing();
});

afterEach(() => teardown());

// ---------------------------------------------------------------------------
// Shared Hono app factory
// ---------------------------------------------------------------------------

type AppOptions = { user?: typeof PROVIDER_USER | typeof PATIENT_USER };

function buildTestApp(options: AppOptions = {}) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: (err as any).code ?? null }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', logger);
    if (options.user) {
      ctx.set('user', options.user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  const ve = (result: any, c: any) => {
    if (!result.success) {
      return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
    }
  };

  app.post('/emr/consultations', zValidator('json', CreateConsultationRequestSchema, ve), createConsultation as any);
  app.get('/emr/consultations', zValidator('query', ListConsultationsQuery, ve), listConsultations as any);
  app.get('/emr/consultations/:consultation', getConsultation as any);
  app.patch('/emr/consultations/:consultation', zValidator('json', UpdateConsultationRequestSchema, ve), updateConsultation as any);
  app.post('/emr/consultations/:consultation/finalize', finalizeConsultation as any);
  app.get('/emr/patients', zValidator('query', ListEMRPatientsQuery, ve), listEMRPatients as any);

  return app;
}

async function seedDraftConsultation(overrides: { context?: string } = {}) {
  const repo = new ConsultationNoteRepository(db, logger as any);
  return await repo.createDirect({
    patient: PATIENT_ID,
    provider: PROVIDER_ID,
    chiefComplaint: 'Test complaint',
    ...overrides,
  });
}

/**
 * Fetch the latest audit row for an action (authoritative dental_audit_log sink).
 * Asserts at least one row exists so callers get a non-undefined row.
 */
async function latestAuditRow(action: string) {
  const rows = await db
    .select()
    .from(dentalAuditLog)
    .where(eq(dentalAuditLog.action, action));
  // Tests run inside a fresh rolled-back tx, so at most a handful of rows exist;
  // return the most recently created.
  const row = rows.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )[0];
  if (!row) throw new Error(`No dental_audit_log row found for action "${action}"`);
  return row;
}

// ---------------------------------------------------------------------------
// createConsultation → emr.consultation.create
// ---------------------------------------------------------------------------

describe('EMR PHI audit logging — createConsultation', () => {
  test('writes audit row with sentinel tenant (not patient UUID)', async () => {
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient: PATIENT_ID,
        provider: PROVIDER_ID,
        chiefComplaint: 'Tooth pain',
      }),
    });
    expect(res.status).toBe(201);
    const created = await res.json() as any;

    const row = await latestAuditRow('emr.consultation.create');
    expect(row).toBeDefined();
    expect(row.action).toBe('emr.consultation.create');
    expect(row.actorId).toBe(PROVIDER_PERSON_ID);
    expect(row.targetType).toBe('consultation');
    expect(row.targetId).toBe(created.id);

    // V-EMR-005: tenant slot is the non-PHI sentinel, NEVER the patient UUID.
    expect(row.tenantId).toBe(EMR_AUDIT_TENANT_SENTINEL);
    expect(row.tenantId).not.toBe(PATIENT_ID);
  });
});

// ---------------------------------------------------------------------------
// getConsultation → emr.consultation.read
// ---------------------------------------------------------------------------

describe('EMR PHI audit logging — getConsultation', () => {
  test('writes read audit row with sentinel tenant', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}`);
    expect(res.status).toBe(200);

    const row = await latestAuditRow('emr.consultation.read');
    expect(row).toBeDefined();
    expect(row.action).toBe('emr.consultation.read');
    expect(row.targetId).toBe(consultation.id);
    expect(row.tenantId).toBe(EMR_AUDIT_TENANT_SENTINEL);
    expect(row.tenantId).not.toBe(PATIENT_ID);
  });
});

// ---------------------------------------------------------------------------
// updateConsultation → emr.consultation.update (field NAMES only)
// ---------------------------------------------------------------------------

describe('EMR PHI audit logging — updateConsultation', () => {
  test('writes update audit row logging field NAMES only, never PHI values', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });

    const SECRET_PHI = 'Severe tooth abscess — patient John Doe';
    const res = await app.request(`/emr/consultations/${consultation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chiefComplaint: SECRET_PHI, assessment: 'Cavity confirmed' }),
    });
    expect(res.status).toBe(200);

    const row = await latestAuditRow('emr.consultation.update');
    expect(row).toBeDefined();
    expect(row.targetId).toBe(consultation.id);
    expect(row.tenantId).toBe(EMR_AUDIT_TENANT_SENTINEL);
    expect(row.tenantId).not.toBe(PATIENT_ID);

    // V-EMR-003: metadata records the changed field NAMES, never their values.
    const meta = row.metadata as Record<string, unknown>;
    expect(meta['updatedFields']).toEqual(['chiefComplaint', 'assessment']);
    // The PHI value must not appear anywhere in the serialized audit row.
    expect(JSON.stringify(row)).not.toContain(SECRET_PHI);
  });
});

// ---------------------------------------------------------------------------
// finalizeConsultation → emr.consultation.finalize
// ---------------------------------------------------------------------------

describe('EMR PHI audit logging — finalizeConsultation', () => {
  test('writes finalize audit row with sentinel tenant + status transition', async () => {
    const consultation = await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request(`/emr/consultations/${consultation.id}/finalize`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);

    const row = await latestAuditRow('emr.consultation.finalize');
    expect(row).toBeDefined();
    expect(row.targetId).toBe(consultation.id);
    expect(row.tenantId).toBe(EMR_AUDIT_TENANT_SENTINEL);
    expect(row.tenantId).not.toBe(PATIENT_ID);
    const meta = row.metadata as Record<string, unknown>;
    expect(meta['previousStatus']).toBe('draft');
    expect(meta['newStatus']).toBe('finalized');
  });
});

// ---------------------------------------------------------------------------
// listConsultations → emr.consultation.list (bulk PHI read)
// ---------------------------------------------------------------------------

describe('EMR PHI audit logging — listConsultations', () => {
  test('writes bulk-read audit row with sentinel tenant + counts only', async () => {
    await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations');
    expect(res.status).toBe(200);

    const row = await latestAuditRow('emr.consultation.list');
    expect(row).toBeDefined();
    expect(row.targetType).toBe('consultation');
    expect(row.tenantId).toBe(EMR_AUDIT_TENANT_SENTINEL);
    expect(row.tenantId).not.toBe(PATIENT_ID);
    const meta = row.metadata as Record<string, unknown>;
    expect(typeof meta['resultCount']).toBe('number');
    expect(typeof meta['totalCount']).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// listEMRPatients → emr.patients.list (bulk PHI read)
// ---------------------------------------------------------------------------

describe('EMR PHI audit logging — listEMRPatients', () => {
  test('writes patient-roster audit row with sentinel tenant + counts only', async () => {
    await seedDraftConsultation();
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/patients');
    expect(res.status).toBe(200);

    const row = await latestAuditRow('emr.patients.list');
    expect(row).toBeDefined();
    expect(row.targetType).toBe('patient');
    expect(row.tenantId).toBe(EMR_AUDIT_TENANT_SENTINEL);
    expect(row.tenantId).not.toBe(PATIENT_ID);
    const meta = row.metadata as Record<string, unknown>;
    expect(meta['providerFilter']).toBe(PROVIDER_ID);
    expect(typeof meta['resultCount']).toBe('number');
  });

  test('empty-result path also writes patient-roster audit row', async () => {
    // No consultations seeded → uniquePatientIds empty → early-return audit branch.
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/patients');
    expect(res.status).toBe(200);

    const row = await latestAuditRow('emr.patients.list');
    expect(row).toBeDefined();
    expect(row.tenantId).toBe(EMR_AUDIT_TENANT_SENTINEL);
    const meta = row.metadata as Record<string, unknown>;
    expect(meta['resultCount']).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// V-EMR-005 — failure path: a refused write must not leak the patient UUID into
// the audit log either. The positive tests above prove the sentinel is used on
// success; this pins the NEGATIVE path (403) — proving the patient UUID never
// reaches the append-only audit log's tenant slot via ANY code path, including
// a rejected authorization (V-EMR-AUTH wrong-provider create).
// ---------------------------------------------------------------------------

describe('V-EMR-005 — audit tenant slot never the patient UUID (failure path)', () => {
  test('wrong-provider create → 403, and NO audit row carries the patient UUID', async () => {
    // PROVIDER_USER is linked to PROVIDER_ID but the body claims OTHER_PROVIDER_ID
    // → ForbiddenError (V-EMR-AUTH). The handler throws BEFORE logAuditEvent.
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient: PATIENT_ID,
        provider: OTHER_PROVIDER_ID,
        chiefComplaint: 'Tooth pain',
      }),
    });
    expect(res.status).toBe(403);

    // V-EMR-005: scan EVERY audit row written in this tx — the patient UUID must
    // NEVER appear in the tenantId slot (the PHI-leak this sentinel exists to
    // prevent). A regression that fell back to the patient UUID would surface here.
    const allRows = await db.select().from(dentalAuditLog);
    for (const row of allRows) {
      expect(row.tenantId).not.toBe(PATIENT_ID);
    }
  });

  test('successful create still uses the sentinel, never the patient UUID', async () => {
    // Pin the positive twin alongside the failure path so both branches assert
    // the same V-EMR-005 invariant in one referencing file.
    const app = buildTestApp({ user: PROVIDER_USER });
    const res = await app.request('/emr/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient: PATIENT_ID, provider: PROVIDER_ID }),
    });
    expect(res.status).toBe(201);
    const row = await latestAuditRow('emr.consultation.create');
    expect(row.tenantId).toBe(EMR_AUDIT_TENANT_SENTINEL);
    expect(row.tenantId).not.toBe(PATIENT_ID);
  });
});
