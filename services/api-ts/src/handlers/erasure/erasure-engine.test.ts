/**
 * Erasure engine safety tests (V-DG-002). PURE: db is opaque, targets are fakes
 * with call spies, audit writer injected. Covers the destructive-path invariants:
 * dry-run default, legal-hold block, anonymize-not-delete, idempotent no-op, and
 * that every run APPENDS an audit event (the engine never mutates/purges audit).
 */

import { describe, test, expect } from 'bun:test';
import { anonymizeSubject, type ErasureTarget } from './erasure-engine';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

const SUBJECT = {
  subjectPersonId: 'p0000000-0000-4000-8000-000000000001',
  tenantId: 't0000000-0000-4000-8000-000000000001',
};

function makeTarget(entityType: string, count = 1) {
  const calls = { anonymize: 0 };
  const target: ErasureTarget = {
    entityType,
    async anonymize() {
      calls.anonymize++;
      return count;
    },
  };
  return { target, calls };
}

function auditSpy() {
  const events: any[] = [];
  const audit = async (_db: any, _logger: any, e: any) => {
    events.push(e);
  };
  return { audit, events };
}

describe('anonymizeSubject — safety invariants', () => {
  test('DRY-RUN by default: targets are never called; reports an audit event', async () => {
    const person = makeTarget('person');
    const patient = makeTarget('patient');
    const { audit, events } = auditSpy();

    const res = await anonymizeSubject({} as any, noopLogger, SUBJECT, {
      targets: { person: person.target, patient: patient.target },
      audit,
    });

    expect(res.dryRun).toBe(true);
    expect(res.outcome).toBe('dry-run');
    expect(res.totalAnonymized).toBe(0);
    expect(person.calls.anonymize).toBe(0);
    expect(patient.calls.anonymize).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('erasure.dry_run');
  });

  test('live run anonymizes via every target and audits the action', async () => {
    const person = makeTarget('person', 1);
    const patient = makeTarget('patient', 2);
    const { audit, events } = auditSpy();

    const res = await anonymizeSubject({} as any, noopLogger, SUBJECT, {
      dryRun: false,
      targets: { person: person.target, patient: patient.target },
      audit,
    });

    expect(res.outcome).toBe('anonymized');
    expect(res.totalAnonymized).toBe(3);
    expect(person.calls.anonymize).toBe(1);
    expect(patient.calls.anonymize).toBe(1);
    expect(events[0].action).toBe('erasure.anonymized');
    expect(events[0].metadata.totalAnonymized).toBe(3);
  });

  test('LEGAL-HOLD blocks erasure: no target is touched, refusal is audited', async () => {
    const person = makeTarget('person');
    const { audit, events } = auditSpy();

    const res = await anonymizeSubject({} as any, noopLogger, SUBJECT, {
      dryRun: false,
      legalHold: true,
      targets: { person: person.target },
      audit,
    });

    expect(res.outcome).toBe('legal-hold-blocked');
    expect(res.blockedByLegalHold).toBe(true);
    expect(res.totalAnonymized).toBe(0);
    expect(person.calls.anonymize).toBe(0); // never anonymizes a held subject
    expect(events[0].action).toBe('erasure.blocked_legal_hold');
  });

  test('idempotent: targets reporting 0 (already anonymized) → noop, still audited', async () => {
    const person = makeTarget('person', 0);
    const { audit, events } = auditSpy();

    const res = await anonymizeSubject({} as any, noopLogger, SUBJECT, {
      dryRun: false,
      targets: { person: person.target },
      audit,
    });

    expect(res.outcome).toBe('noop');
    expect(res.totalAnonymized).toBe(0);
    expect(person.calls.anonymize).toBe(1);
    expect(events).toHaveLength(1); // the audit trail is always appended to
  });

  test('per-target counts are reported', async () => {
    const person = makeTarget('person', 1);
    const patient = makeTarget('patient', 1);
    const { audit } = auditSpy();

    const res = await anonymizeSubject({} as any, noopLogger, SUBJECT, {
      dryRun: false,
      targets: { person: person.target, patient: patient.target },
      audit,
    });

    expect(res.targets).toEqual(
      expect.arrayContaining([
        { entityType: 'person', anonymizedCount: 1 },
        { entityType: 'patient', anonymizedCount: 1 },
      ]),
    );
  });
});
