/**
 * EMR ConsultationNoteRepository integration tests
 *
 * Tests against real Postgres via openTestTx with automatic rollback.
 * Requires: postgres://postgres:password@localhost:5432/monobase
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ConsultationNoteRepository } from './emr.repo';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { providers } from '@/handlers/provider/repos/provider.schema';
import { openTestTx } from '@/core/test-tx';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const PERSON_ID          = 'ff000000-0000-4000-8000-000000000001';
const PROVIDER_PERSON_ID = 'ff000000-0000-4000-8000-000000000002';
const PROVIDER_ID        = 'ff000000-0000-4000-8000-000000000004';
const PATIENT_ID         = 'ff000000-0000-4000-8000-000000000003';

let repo: ConsultationNoteRepository;
let db: NodePgDatabase;
let teardown: () => Promise<void>;

const noopLogger = { info() {}, error() {}, debug() {}, warn() {} } as any;

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  teardown = tx.rollback;
  repo = new ConsultationNoteRepository(db, noopLogger);

  // Insert FK dependencies: persons → provider + patient
  await db.insert(persons).values([
    { id: PERSON_ID,          firstName: 'Test' },
    { id: PROVIDER_PERSON_ID, firstName: 'Provider' },
  ]).onConflictDoNothing();

  await db.insert(providers).values([
    { id: PROVIDER_ID, person: PROVIDER_PERSON_ID, providerType: 'dentist' },
  ]).onConflictDoNothing();

  await db.insert(patients).values([
    { id: PATIENT_ID, person: PERSON_ID },
  ]).onConflictDoNothing();
});
afterEach(() => teardown());

describe('ConsultationNoteRepository', () => {
  describe('createDirect', () => {
    test('creates a draft consultation note', async () => {
      const note = await repo.createDirect({
        patient: PATIENT_ID,
        provider: PROVIDER_ID,
        chiefComplaint: 'Headache for 3 days',
      });

      expect(note).not.toBeNull();
      expect(note.id).not.toBeNull();
      expect(note.status).toBe('draft');
      expect(note.chiefComplaint).toBe('Headache for 3 days');
    });

    test('prevents duplicate context values', async () => {
      const ctx = `ctx-unique-${Date.now()}`;
      await repo.createDirect({ patient: PATIENT_ID, provider: PROVIDER_ID, context: ctx });
      await expect(
        repo.createDirect({ patient: PATIENT_ID, provider: PROVIDER_ID, context: ctx })
      ).rejects.toThrow();
    });
  });

  describe('finalizeNote', () => {
    test('transitions draft → finalized', async () => {
      const note = await repo.createDirect({
        patient: PATIENT_ID,
        provider: PROVIDER_ID,
        assessment: 'Stable',
        plan: 'Continue medication',
      });

      const finalized = await repo.finalizeNote(note.id, PROVIDER_ID);
      expect(finalized).not.toBeNull();
      expect(finalized!.status).toBe('finalized');
      expect(finalized!.finalizedBy).toBe(PROVIDER_ID);
    });
  });

  describe('findByPatient', () => {
    test('returns notes for a specific patient', async () => {
      await repo.createDirect({
        patient: PATIENT_ID,
        provider: PROVIDER_ID,
        chiefComplaint: 'Test complaint',
      });

      const notes = await repo.findByPatient(PATIENT_ID);
      expect(notes.length).toBeGreaterThanOrEqual(1);
      expect(notes[0]!.patient).toBe(PATIENT_ID);
    });
  });

  describe('getConsultationStats', () => {
    test('returns statistics with numeric counts', async () => {
      const stats = await repo.getConsultationStats(PATIENT_ID, 'patient');
      expect(stats).not.toBeNull();
      expect(typeof stats.totalConsultations).toBe('number');
      expect(typeof stats.draftConsultations).toBe('number');
      expect(typeof stats.finalizedConsultations).toBe('number');
    });
  });
});
