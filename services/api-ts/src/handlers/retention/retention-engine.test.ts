/**
 * Engine safety tests (V-DG-001 / AC-RET-001..006). The destructive paths are
 * covered hard: dry-run default, legal-hold exemption, audit-never-purged,
 * delete→archive downgrade, period-boundary cutoff, and no-target handling.
 *
 * AC-RET-001..006 hard invariants asserted here (refusals that hold regardless of
 * policy data): DRY-RUN unless dryRun:false; 'audit'/protected target never read
 * or actioned; 'retain' action refused; 'delete' DOWNGRADED to soft-archive (no
 * hard-delete path); legal-held records always excluded — and `legalHoldExempt`
 * is NEVER a bypass (the engine has no exemption escape hatch). The admin-gated
 * negative path (non-admin → 403) for the retention enforcement-status read API
 * lives in getRetentionStatus.test.ts.
 */

import { describe, test, expect } from 'bun:test';
import { evaluateRetention, type RetentionTarget } from './retention-engine';
import type { DentalRetentionPolicy } from './repos/retention-policy.schema';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

function policy(overrides: Partial<DentalRetentionPolicy> = {}): DentalRetentionPolicy {
  return {
    id: 'pol-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: null,
    updatedBy: null,
    tenantId: 'tenant-1',
    branchId: null,
    entityType: 'attachment',
    retentionPeriodDays: 3650,
    action: 'archive',
    enabled: true,
    legalHoldExempt: false,
    notes: null,
    lastEvaluatedAt: null,
    deletedAt: null,
    ...overrides,
  } as DentalRetentionPolicy;
}

function makeTarget(opts: {
  entityType: string;
  candidates?: { id: string; legalHold: boolean }[];
  protected?: boolean;
}) {
  const calls = { findEligible: 0, archive: [] as string[][], anonymize: [] as string[][] };
  const target: RetentionTarget = {
    entityType: opts.entityType,
    protected: opts.protected,
    async findEligible() {
      calls.findEligible++;
      return opts.candidates ?? [];
    },
    async archive(_db, ids) {
      calls.archive.push(ids);
      return ids.length;
    },
    async anonymize(_db, ids) {
      calls.anonymize.push(ids);
      return ids.length;
    },
  };
  return { target, calls };
}

function auditSpy() {
  const events: any[] = [];
  const audit = async (_db: any, _logger: any, event: any) => {
    events.push(event);
  };
  return { audit, events };
}

describe('evaluateRetention — safety invariants', () => {
  test('DRY-RUN by default: reports eligible records but never actions them', async () => {
    const { target, calls } = makeTarget({
      entityType: 'attachment',
      candidates: [
        { id: 'a', legalHold: false },
        { id: 'b', legalHold: false },
      ],
    });
    const { audit, events } = auditSpy();

    const res = await evaluateRetention({} as any, noopLogger, [policy()], {
      targets: { attachment: target },
      audit,
    });

    expect(res[0]!.dryRun).toBe(true);
    expect(res[0]!.outcome).toBe('dry-run');
    expect(res[0]!.eligibleCount).toBe(2);
    expect(res[0]!.actionedCount).toBe(0);
    expect(calls.archive.length).toBe(0); // nothing actually mutated
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('retention.dry_run');
    expect(events[0].metadata.dryRun).toBe(true);
    expect(events[0].metadata.eligibleCount).toBe(2);
  });

  test('live mode soft-archives the eligible records and writes an audit event', async () => {
    const { target, calls } = makeTarget({
      entityType: 'attachment',
      candidates: [
        { id: 'a', legalHold: false },
        { id: 'b', legalHold: false },
      ],
    });
    const { audit, events } = auditSpy();

    const res = await evaluateRetention({} as any, noopLogger, [policy()], {
      dryRun: false,
      targets: { attachment: target },
      audit,
    });

    expect(res[0]!.outcome).toBe('enforced');
    expect(res[0]!.actionedCount).toBe(2);
    expect(calls.archive[0]).toEqual(['a', 'b']);
    expect(events[0].action).toBe('retention.enforced');
    expect(events[0].metadata.actionedCount).toBe(2);
  });

  test('AC-RET-001..006 LEGAL-HOLD: held records are always excluded, even in live mode', async () => {
    const { target, calls } = makeTarget({
      entityType: 'attachment',
      candidates: [
        { id: 'a', legalHold: false },
        { id: 'b', legalHold: true },
        { id: 'c', legalHold: true },
      ],
    });
    const { audit, events } = auditSpy();

    const res = await evaluateRetention({} as any, noopLogger, [policy()], {
      dryRun: false,
      targets: { attachment: target },
      audit,
    });

    expect(res[0]!.legalHeldCount).toBe(2);
    expect(res[0]!.eligibleCount).toBe(1);
    expect(res[0]!.actionedCount).toBe(1);
    expect(calls.archive[0]).toEqual(['a']); // held records never passed to archive
    expect(events[0].metadata.legalHeldCount).toBe(2);
  });

  test('AC-RET-001..006: legalHoldExempt is NEVER a bypass — a held record is still excluded even when the policy sets legalHoldExempt:true', async () => {
    // The registry claims `legalHoldExempt` can never be used to action a held
    // record. The engine has NO exemption escape hatch (the legal-hold filter at
    // retention-engine.ts is unconditional), so a malicious/mistaken policy flag
    // must not flip a held candidate into the actioned set.
    const { target, calls } = makeTarget({
      entityType: 'attachment',
      candidates: [
        { id: 'free', legalHold: false },
        { id: 'held', legalHold: true },
      ],
    });
    const { audit, events } = auditSpy();

    const res = await evaluateRetention(
      {} as any,
      noopLogger,
      [policy({ legalHoldExempt: true, action: 'delete' })], // attempt to bypass + hard-delete
      { dryRun: false, targets: { attachment: target }, audit },
    );

    // The held record is excluded regardless of the exempt flag; only the free
    // record is actioned, and the action is the safe soft-archive downgrade.
    expect(res[0]!.legalHeldCount).toBe(1);
    expect(res[0]!.eligibleCount).toBe(1);
    expect(res[0]!.actionedCount).toBe(1);
    expect(res[0]!.effectiveAction).toBe('archive'); // delete DOWNGRADED, never hard-delete
    expect(calls.archive[0]).toEqual(['free']); // 'held' never reaches a write path
    expect(calls.archive[0]).not.toContain('held');
    expect(events[0].action).toBe('retention.enforced');
    expect(events[0].metadata.legalHeldCount).toBe(1);
  });

  test('AUDIT NEVER PURGED: a protected target is refused — never queried or actioned', async () => {
    const { target, calls } = makeTarget({
      entityType: 'audit',
      protected: true,
      candidates: [{ id: 'x', legalHold: false }],
    });
    const { audit, events } = auditSpy();

    const res = await evaluateRetention(
      {} as any,
      noopLogger,
      [policy({ entityType: 'audit', action: 'delete' })],
      { dryRun: false, targets: { audit: target }, audit },
    );

    expect(res[0]!.outcome).toBe('protected-skip');
    expect(res[0]!.actionedCount).toBe(0);
    expect(calls.findEligible).toBe(0); // never even reads the audit trail
    expect(calls.archive.length).toBe(0);
    expect(events[0].action).toBe('retention.protected_skip');
  });

  test("action 'retain' is treated as protected — never actions records", async () => {
    const { target, calls } = makeTarget({
      entityType: 'attachment',
      candidates: [{ id: 'a', legalHold: false }],
    });
    const { audit, events } = auditSpy();

    const res = await evaluateRetention(
      {} as any,
      noopLogger,
      [policy({ action: 'retain' })],
      { dryRun: false, targets: { attachment: target }, audit },
    );

    expect(res[0]!.outcome).toBe('protected-skip');
    expect(calls.archive.length).toBe(0);
    expect(events[0].action).toBe('retention.protected_skip');
  });

  test("DELETE is downgraded to soft-archive — the engine never hard-deletes", async () => {
    const { target, calls } = makeTarget({
      entityType: 'attachment',
      candidates: [{ id: 'a', legalHold: false }],
    });
    const { audit } = auditSpy();

    const res = await evaluateRetention(
      {} as any,
      noopLogger,
      [policy({ action: 'delete' })],
      { dryRun: false, targets: { attachment: target }, audit },
    );

    expect(res[0]!.requestedAction).toBe('delete');
    expect(res[0]!.effectiveAction).toBe('archive');
    expect(calls.archive.length).toBe(1); // soft-archive path, not a hard delete
  });

  test("anonymize action uses the target's anonymize path", async () => {
    const { target, calls } = makeTarget({
      entityType: 'attachment',
      candidates: [{ id: 'a', legalHold: false }],
    });
    const { audit } = auditSpy();

    const res = await evaluateRetention(
      {} as any,
      noopLogger,
      [policy({ action: 'anonymize' })],
      { dryRun: false, targets: { attachment: target }, audit },
    );

    expect(res[0]!.effectiveAction).toBe('anonymize');
    expect(calls.anonymize.length).toBe(1);
    expect(calls.archive.length).toBe(0);
  });

  test('PERIOD BOUNDARY: cutoff = now - retentionPeriodDays', async () => {
    const now = new Date('2026-05-31T00:00:00.000Z');
    let captured: Date | undefined;
    const target: RetentionTarget = {
      entityType: 'attachment',
      async findEligible(_db, opts) {
        captured = opts.cutoff;
        return [];
      },
      async archive() {
        return 0;
      },
    };
    const { audit } = auditSpy();

    await evaluateRetention({} as any, noopLogger, [policy({ retentionPeriodDays: 10 })], {
      targets: { attachment: target },
      audit,
      now,
    });

    const expected = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    expect(captured?.toISOString()).toBe(expected.toISOString());
  });

  test('no registered target → no-target outcome, nothing actioned, no audit', async () => {
    const { audit, events } = auditSpy();
    const res = await evaluateRetention(
      {} as any,
      noopLogger,
      [policy({ entityType: 'something_unmapped' })],
      { dryRun: false, targets: {}, audit },
    );

    expect(res[0]!.outcome).toBe('no-target');
    expect(res[0]!.actionedCount).toBe(0);
    expect(events).toHaveLength(0);
  });

  test('disabled policy is skipped without querying the target', async () => {
    const { target, calls } = makeTarget({
      entityType: 'attachment',
      candidates: [{ id: 'a', legalHold: false }],
    });
    const { audit, events } = auditSpy();

    const res = await evaluateRetention({} as any, noopLogger, [policy({ enabled: false })], {
      dryRun: false,
      targets: { attachment: target },
      audit,
    });

    expect(res[0]!.outcome).toBe('disabled');
    expect(calls.findEligible).toBe(0);
    expect(events).toHaveLength(0);
  });
});
