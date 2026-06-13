/**
 * Enforced-mode retention proof (V-DG-001, FIX-003).
 *
 * The engine's destructive `dryRun: false` path has only ever run against
 * INJECTED FAKE targets (retention-engine.test.ts) — and the real facades have
 * only ever been exercised in ISOLATION (retention-appointment / -legalhold call
 * `target.findEligible` / `target.archive` directly). Nobody has run the FULL
 * production seam end-to-end:
 *
 *   job → RetentionPolicyRepository.findEnabled() (real policy rows)
 *       → evaluateRetention(db, …, { dryRun: false })   (real RETENTION_TARGETS)
 *       → real facade archive (sets deletedAt)
 *       → real logAuditEvent (writes dental_audit_log)
 *
 * This is the test that must exist BEFORE anyone flips
 * RETENTION_ENFORCEMENT_ENABLED — the first enforced run must not be the first
 * real run. It proves, against the real DB through the default registry + the
 * default audit writer (no injection):
 *
 *   1. an eligible attachment is really soft-archived (`deletedAt` set);
 *   2. a legally-held attachment is left untouched (`deletedAt` stays null);
 *   3. a `retention.enforced` audit row is actually written;
 *   4. the audit trail itself is untouched (a pre-existing audit row survives).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq, and } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import { dentalAttachments } from '@/handlers/dental-clinical/repos/attachment.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalAuditLog } from '@/handlers/dental-audit/repos/audit-log.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { placeLegalHold } from '@/handlers/dental-legalhold/legal-hold-service';
import { RetentionPolicyRepository } from './repos/retention-policy.repo';
import { dentalRetentionPolicies } from './repos/retention-policy.schema';
import { evaluateRetention, RETENTION_SYSTEM_ACTOR } from './retention-engine';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

// Deterministic clock + ages: both attachments are well past the cutoff.
const NOW = new Date('2025-06-01T00:00:00.000Z');
const AGED = new Date('2010-01-01T00:00:00.000Z'); // 15y old → past a 10y cutoff
const RETENTION_DAYS = 3650; // ~10 years; cutoff ≈ 2015-06 → AGED is eligible

const VISIT_P2 = 'd1000000-0000-4000-8000-0000000000a2'; // PATIENT_2's own visit
const ATT_ELIGIBLE = 'a7000000-0000-4000-8000-0000000000e1'; // PATIENT_1, not held
const ATT_HELD = 'a7000000-0000-4000-8000-0000000000e2'; // PATIENT_2, legal hold
const POLICY_ID = 'f0000000-0000-4000-8000-0000000000a1';

async function insertAttachment(db: NodePgDatabase, id: string, visitId: string, patientId: string): Promise<void> {
  await db.insert(dentalAttachments).values({
    id,
    visitId,
    patientId,
    imageType: 'xray',
    fileName: 'x.jpg',
    filePath: '/u/x.jpg',
    fileSizeBytes: 1024,
    mimeType: 'image/jpeg',
    createdAt: AGED,
  });
}

describe('enforced-mode retention run (end-to-end, real facades — FIX-003)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;

    // Two patients, one visit (PATIENT_1). PATIENT_2 gets its own visit so its
    // attachment resolves through the same attachment→visit→branch join.
    await seedClinicalChain(db, { visits: 1, patients: 2 });
    await db.insert(dentalVisits).values({
      id: VISIT_P2,
      patientId: CHAIN_IDS.PATIENT_2,
      branchId: CHAIN_IDS.BRANCH_1,
      dentistMemberId: CHAIN_IDS.MEMBERSHIP_1,
    });

    // Aged attachments straddling the legal-hold boundary.
    await insertAttachment(db, ATT_ELIGIBLE, CHAIN_IDS.VISIT_1, CHAIN_IDS.PATIENT_1);
    await insertAttachment(db, ATT_HELD, VISIT_P2, CHAIN_IDS.PATIENT_2);

    // Legal hold on PATIENT_2's Person — its attachment must never be actioned.
    const [pt2] = await db
      .select({ person: patients.person })
      .from(patients)
      .where(eq(patients.id, CHAIN_IDS.PATIENT_2));
    await placeLegalHold(db, noopLogger, {
      tenantId: CHAIN_IDS.ORG,
      subjectPersonId: pt2!.person,
      name: 'hold',
      reason: 'litigation',
      initiatedBy: CHAIN_IDS.OWNER_PERSON,
    });

    // A pre-existing audit row in the same tenant — retention must NOT purge it.
    await db.insert(dentalAuditLog).values({
      tenantId: CHAIN_IDS.ORG,
      actorId: CHAIN_IDS.OWNER_PERSON,
      action: 'visit_note.signed',
      targetType: 'visit_note',
      eventType: 'data-modification',
    });

    // A real, enabled, tenant-wide attachment retention policy.
    await db.insert(dentalRetentionPolicies).values({
      id: POLICY_ID,
      tenantId: CHAIN_IDS.ORG,
      branchId: null,
      entityType: 'attachment',
      retentionPeriodDays: RETENTION_DAYS,
      action: 'archive',
      enabled: true,
    });
  });

  afterEach(() => teardown());

  test('archives the eligible attachment, spares the legally-held one, and audits the run', async () => {
    // Exact production seam: load enabled policies, run enforced through the
    // DEFAULT registry + DEFAULT audit writer (no targets/audit injection).
    const repo = new RetentionPolicyRepository(db, noopLogger);
    const policies = await repo.findEnabled(CHAIN_IDS.ORG);
    expect(policies.map((p) => p.id)).toContain(POLICY_ID);

    const results = await evaluateRetention(db, noopLogger, policies, { dryRun: false, now: NOW });

    // Engine reported a real enforcement of exactly the one non-held record.
    const attResult = results.find((r) => r.entityType === 'attachment');
    expect(attResult).toBeDefined();
    expect(attResult!.dryRun).toBe(false);
    expect(attResult!.outcome).toBe('enforced');
    expect(attResult!.eligibleCount).toBe(1);
    expect(attResult!.legalHeldCount).toBe(1);
    expect(attResult!.actionedCount).toBe(1);
    expect(attResult!.effectiveAction).toBe('archive');

    // (1) Eligible attachment really soft-archived (deletedAt set) — real facade write.
    const [eligibleRow] = await db
      .select({ deletedAt: dentalAttachments.deletedAt })
      .from(dentalAttachments)
      .where(eq(dentalAttachments.id, ATT_ELIGIBLE));
    expect(eligibleRow!.deletedAt).not.toBeNull();

    // (2) Legally-held attachment untouched — no code path actions a held record.
    const [heldRow] = await db
      .select({ deletedAt: dentalAttachments.deletedAt })
      .from(dentalAttachments)
      .where(eq(dentalAttachments.id, ATT_HELD));
    expect(heldRow!.deletedAt).toBeNull();

    // (3) retention.enforced audit row actually written (default logAuditEvent).
    const enforcedRows = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.tenantId, CHAIN_IDS.ORG), eq(dentalAuditLog.action, 'retention.enforced')));
    expect(enforcedRows).toHaveLength(1);
    expect(enforcedRows[0]!.actorId).toBe(RETENTION_SYSTEM_ACTOR);
    expect(enforcedRows[0]!.targetType).toBe('retention_policy');
    expect(enforcedRows[0]!.targetId).toBe(POLICY_ID);
    const meta = enforcedRows[0]!.metadata as Record<string, unknown>;
    expect(meta['actionedCount']).toBe(1);
    expect(meta['legalHeldCount']).toBe(1);
    expect(meta['dryRun']).toBe(false);

    // (4) The audit trail itself is untouched — the pre-existing row survives.
    const preExisting = await db
      .select()
      .from(dentalAuditLog)
      .where(and(eq(dentalAuditLog.tenantId, CHAIN_IDS.ORG), eq(dentalAuditLog.action, 'visit_note.signed')));
    expect(preExisting).toHaveLength(1);
  });
});
