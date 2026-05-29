/**
 * getConsultation expand characterization test
 *
 * Locks the field-expansion behavior of GET /emr/consultations/:id so the
 * EX-005/006 decoupling refactor (moving the patient/provider/person join out
 * of emr.repo and into facades) provably preserves the response shape.
 *
 * Real Postgres via openTestTx (auto-rollback) + Hono test app.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { openTestTx } from '@/core/test-tx';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { providers } from '@/handlers/provider/repos/provider.schema';
import { getConsultation } from './getConsultation';
import { ConsultationNoteRepository } from './repos/emr.repo';

const PROVIDER_PERSON_ID = 'ed000000-0000-4000-8000-000000000001';
const PATIENT_PERSON_ID  = 'ed000000-0000-4000-8000-000000000002';
const PROVIDER_ID        = 'ed000000-0000-4000-8000-000000000004';
const PATIENT_ID         = 'ed000000-0000-4000-8000-000000000005';

const PROVIDER_USER = { id: PROVIDER_PERSON_ID, email: 'p@clinic.com', role: 'provider' };

const noop = () => {};
const logger = { debug: noop, info: noop, warn: noop, error: noop };

let db: NodePgDatabase;
let teardown: () => Promise<void>;

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  teardown = tx.rollback;

  await db.insert(persons).values([
    { id: PROVIDER_PERSON_ID, firstName: 'Provider', lastName: 'Test' },
    { id: PATIENT_PERSON_ID,  firstName: 'Patient',  lastName: 'Test' },
  ]).onConflictDoNothing();
  await db.insert(providers).values([
    { id: PROVIDER_ID, person: PROVIDER_PERSON_ID, providerType: 'dentist' },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_ID, person: PATIENT_PERSON_ID },
  ]).onConflictDoNothing();
});
afterEach(() => teardown());

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message }, err.statusCode as any);
    return c.json({ error: String((err as any).message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', logger);
    ctx.set('user', PROVIDER_USER);
    ctx.set('session', { id: 'test-session' });
    await next();
  });
  app.get('/emr/consultations/:consultation', getConsultation as any);
  return app;
}

async function seedConsultation() {
  const repo = new ConsultationNoteRepository(db, logger as any);
  return repo.createDirect({ patient: PATIENT_ID, provider: PROVIDER_ID, chiefComplaint: 'Headache' });
}

describe('getConsultation field expansion', () => {
  test('no expand → flat patient/provider UUID strings', async () => {
    const note = await seedConsultation();
    const res = await buildApp().request(`/emr/consultations/${note.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.patient).toBe(PATIENT_ID);
    expect(body.provider).toBe(PROVIDER_ID);
  });

  test('expand=patient,provider → nested objects (no person)', async () => {
    const note = await seedConsultation();
    const res = await buildApp().request(`/emr/consultations/${note.id}?expand=patient,provider`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.patient).toBe('object');
    expect(body.patient.id).toBe(PATIENT_ID);
    expect(typeof body.provider).toBe('object');
    expect(body.provider.id).toBe(PROVIDER_ID);
    expect(body.provider.providerType).toBe('dentist');
  });

  test('expand=patient,provider,person → nested objects WITH person', async () => {
    const note = await seedConsultation();
    const res = await buildApp().request(`/emr/consultations/${note.id}?expand=patient,provider,person`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.patient.id).toBe(PATIENT_ID);
    expect(body.patient.person).toBeDefined();
    expect(body.patient.person.id).toBe(PATIENT_PERSON_ID);
    expect(body.patient.person.firstName).toBe('Patient');
    expect(body.provider.id).toBe(PROVIDER_ID);
    expect(body.provider.person).toBeDefined();
    expect(body.provider.person.id).toBe(PROVIDER_PERSON_ID);
    expect(body.provider.person.firstName).toBe('Provider');
  });
});
