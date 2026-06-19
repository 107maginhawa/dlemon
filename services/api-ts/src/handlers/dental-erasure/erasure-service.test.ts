/**
 * Erasure workflow service tests (V-DG-002) — DB-backed end-to-end:
 * request → approve (runs real anonymization) / reject, legal-hold block,
 * two-step state guard, and that approval actually anonymizes the subject.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { persons } from '../person/repos/person.schema';
import { patients } from '../patient/repos/patient.schema';
import { dentalAuditLog } from '../dental-audit/repos/audit-log.schema';
import { ERASED_MARKER } from '../person/repos/person-erasure.facade';
import { requestErasure, approveErasure, rejectErasure } from './erasure-service';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;
const PID = 'e2000000-0000-4000-8000-000000000001';
const TENANT = 'd2000000-0000-4000-8000-000000000001';
const REQUESTER = 'a2000000-0000-4000-8000-000000000001';
const REVIEWER = 'a2000000-0000-4000-8000-000000000002';

async function seedSubject(db: NodePgDatabase) {
  await db.insert(persons).values({
    id: PID,
    firstName: 'Jane',
    lastName: 'Doe',
    contactInfo: { email: 'jane@example.com', phone: '+639170000000' },
  });
  await db.insert(patients).values({ person: PID, emergencyContact: { name: 'Kin', phone: '+1' } });
}

const baseInput = {
  subjectPersonId: PID,
  tenantId: TENANT,
  reason: 'GDPR Art.17 subject request',
  requestedBy: REQUESTER,
};

describe('erasure workflow service', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    await seedSubject(db);
  });

  afterEach(() => teardown());

  test('requestErasure creates a requested row without mutating the subject', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    expect(req.status).toBe('requested');
    expect(req.subjectPersonId).toBe(PID);

    const [p] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(p!.firstName).toBe('Jane'); // untouched until approved
  });

  test('approveErasure anonymizes person + patient and marks the request anonymized', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    const { request: approved } = await approveErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER });

    expect(approved.status).toBe('anonymized');
    expect(approved.processedAt).not.toBeNull();
    expect(approved.reviewedBy).toBe(REVIEWER);

    const [p] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(p!.firstName).toBe(ERASED_MARKER);
    expect(p!.contactInfo).toBeNull();
    const [pt] = await db.select().from(patients).where(eq(patients.person, PID));
    expect(pt!.emergencyContact).toBeNull();
  });

  test('legal hold blocks approval: request rejected, subject NOT anonymized', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    const { request: result } = await approveErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER, legalHold: true });

    expect(result.status).toBe('rejected');
    expect(result.legalHoldBlocked).toBe(true);

    const [p] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(p!.firstName).toBe('Jane'); // preserved — held subject not erased
  });

  test('rejectErasure marks the request rejected with a reason; subject untouched', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    const rejected = await rejectErasure(db, noopLogger, req.id, {
      reviewedBy: REVIEWER,
      rejectionReason: 'identity not verified',
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('identity not verified');

    const [p] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(p!.firstName).toBe('Jane');
  });

  test('V-DG-002-AU: the erasure audit trail SURVIVES the anonymization it records (DATA_GOVERNANCE §3 "audit preserved")', async () => {
    // Headline compliance invariant: erasing a subject must NOT delete the audit
    // trail of the erasure. The engine writes to dental_audit_log (no FK to person,
    // anonymize-not-delete), so the row must persist after the subject is gone.
    // Use the REAL audit sink (no spy) so a durable row is actually written.
    const req = await requestErasure(db, noopLogger, baseInput); // writes erasure.requested
    const { request: approved } = await approveErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER }); // writes erasure.anonymized

    // Subject IS anonymized.
    expect(approved.status).toBe('anonymized');
    const [p] = await db.select().from(persons).where(eq(persons.id, PID));
    expect(p!.firstName).toBe(ERASED_MARKER);

    // The audit row recording the anonymization still exists, attributed to the
    // subject person and the reviewer — the trail outlives the erased identity.
    const [erasedEvent] = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.action, 'erasure.anonymized'), eq(dentalAuditLog.targetId, PID)));
    expect(erasedEvent).toBeDefined();
    expect(erasedEvent!.actorId).toBe(REVIEWER);
    expect(erasedEvent!.eventType).toBe('security');
    // And the request-time event is also retained (full append-only trail).
    const [requestedEvent] = await db
      .select()
      .from(dentalAuditLog)
      .where(eq(dentalAuditLog.action, 'erasure.requested'));
    expect(requestedEvent).toBeDefined();
  });

  test('cannot approve/reject a request that is not in requested state', async () => {
    const req = await requestErasure(db, noopLogger, baseInput);
    await approveErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER });

    await expect(approveErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER })).rejects.toThrow();
    await expect(
      rejectErasure(db, noopLogger, req.id, { reviewedBy: REVIEWER, rejectionReason: 'x' }),
    ).rejects.toThrow();
  });
});
