/**
 * V-AUD-101 / CONF-AUD-001 (P1): the pg-boss audit consumer write path
 * (domain-events.consumer.ts) must NOT bypass PHI sanitization.
 *
 * The consumer calls `AuditLogRepository.insert` directly with caller-supplied
 * before/after snapshots. The audit store is append-only and never deleted
 * (DATA_GOVERNANCE §2/§3), so any PHI persisted here is unremediable
 * (AC-AUD-004 / MODULE_SPEC §5 "No PHI in log body"). These tests mirror
 * `audit.test.ts` V-AUD-NEW-A but drive the event through the registered
 * consumer handler instead of `logAuditEvent`.
 *
 * Each test is isolated in a rolled-back transaction via openTestTx.
 * "da0c" UUID namespace — won't collide with seed data.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { AuditLogRepository } from '../repos/audit-log.repo';
import type { JobScheduler, JobHandler, JobContext } from '@/core/jobs';
import {
  registerAuditDomainEventConsumer,
  DENTAL_AUDIT_EVENTS_QUEUE,
  type DentalAuditDomainEvent,
} from './domain-events.consumer';

const ACTOR_A  = 'da0c0001-0000-0000-0000-000000000001';
const TENANT_A = 'da0c0001-0000-0000-0000-000000000010';
const TARGET_A = 'da0c0001-0000-0000-0000-000000000099';

let teardown: () => Promise<void>;
let repo: AuditLogRepository;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

/**
 * Minimal scheduler stub: captures the handler registered for the audit queue so
 * the test can invoke it directly (no real pg-boss). Mirrors how pg-boss would
 * deliver the job's `data` payload via the JobContext.
 */
class CaptureScheduler implements Partial<JobScheduler> {
  handler?: JobHandler;
  registerDelayed(name: string, _delayMs: number, handler: JobHandler): void {
    if (name === DENTAL_AUDIT_EVENTS_QUEUE) this.handler = handler;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async deliver(event: DentalAuditDomainEvent, database: any): Promise<void> {
    if (!this.handler) throw new Error('consumer not registered');
    const ctx: JobContext = {
      db: database,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: null as any,
      jobId: 'test-job',
      jobName: DENTAL_AUDIT_EVENTS_QUEUE,
      data: event,
    };
    await this.handler(ctx);
  }
}

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  repo = new AuditLogRepository(tx.db);
  teardown = tx.rollback;
});

afterEach(() => teardown());

describe('domain-events.consumer: registration', () => {
  test('registers a handler on the audit queue', () => {
    const sched = new CaptureScheduler();
    registerAuditDomainEventConsumer(sched as unknown as JobScheduler, db);
    expect(sched.handler).toBeDefined();
  });

  test('persists a valid event with spec-correct fields', async () => {
    const sched = new CaptureScheduler();
    registerAuditDomainEventConsumer(sched as unknown as JobScheduler, db);
    await sched.deliver(
      {
        tenantId: TENANT_A,
        actorId: ACTOR_A,
        action: 'visit.complete',
        targetType: 'dental_visit',
        targetId: TARGET_A,
      },
      db,
    );

    const { entries, total } = await repo.list(
      { action: 'visit.complete', tenantId: TENANT_A },
      { limit: 10, offset: 0 },
    );
    expect(total).toBe(1);
    expect(entries[0]?.actorId).toBe(ACTOR_A);
    expect(entries[0]?.targetType).toBe('dental_visit');
  });

  test('drops events missing required fields (no row written)', async () => {
    const sched = new CaptureScheduler();
    registerAuditDomainEventConsumer(sched as unknown as JobScheduler, db);
    await sched.deliver(
      // missing actorId
      { tenantId: TENANT_A, action: 'visit.complete', targetType: 'dental_visit' } as DentalAuditDomainEvent,
      db,
    );

    const { total } = await repo.list(
      { action: 'visit.complete', tenantId: TENANT_A },
      { limit: 10, offset: 0 },
    );
    expect(total).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// V-AUD-101 (P1): the consumer write path must sanitize PHI from snapshots,
// mirroring audit.test.ts V-AUD-NEW-A. The single choke point is
// AuditLogRepository.insert, so the consumer is covered without going through
// logAuditEvent.
// ----------------------------------------------------------------------------
describe('V-AUD-101: consumer write path PHI sanitization', () => {
  test('strips top-level PHI keys from before/after snapshots', async () => {
    const sched = new CaptureScheduler();
    registerAuditDomainEventConsumer(sched as unknown as JobScheduler, db);
    await sched.deliver(
      {
        tenantId: TENANT_A,
        actorId: ACTOR_A,
        action: 'patient.update',
        targetType: 'dental_patient',
        targetId: TARGET_A,
        beforeSnapshot: {
          id: TARGET_A,
          status: 'active',
          displayName: 'Jane Doe',
          dateOfBirth: '1990-01-01',
          email: 'jane@example.com',
          diagnosis: 'caries',
        },
        afterSnapshot: {
          id: TARGET_A,
          status: 'archived',
          displayName: 'Jane Doe',
        },
      },
      db,
    );

    const { entries } = await repo.list(
      { action: 'patient.update', tenantId: TENANT_A },
      { limit: 10, offset: 0 },
    );
    const entry = entries[0]!;
    const before = entry.beforeSnapshot as Record<string, unknown>;
    const after = entry.afterSnapshot as Record<string, unknown>;

    // Non-PHI keys preserved.
    expect(before['id']).toBe(TARGET_A);
    expect(before['status']).toBe('active');
    // PHI keys stripped.
    expect(before).not.toHaveProperty('displayName');
    expect(before).not.toHaveProperty('dateOfBirth');
    expect(before).not.toHaveProperty('email');
    expect(before).not.toHaveProperty('diagnosis');
    expect(after['status']).toBe('archived');
    expect(after).not.toHaveProperty('displayName');

    // No PHI value anywhere in the persisted row.
    expect(JSON.stringify(entry)).not.toContain('Jane Doe');
    expect(JSON.stringify(entry)).not.toContain('jane@example.com');
    expect(JSON.stringify(entry)).not.toContain('caries');
  });

  test('strips PHI keys nested in objects and arrays', async () => {
    const UNIQUE_TENANT = 'da0c0001-0000-0000-0000-000000000013';
    const sched = new CaptureScheduler();
    registerAuditDomainEventConsumer(sched as unknown as JobScheduler, db);
    await sched.deliver(
      {
        tenantId: UNIQUE_TENANT,
        actorId: ACTOR_A,
        action: 'patient.update',
        targetType: 'dental_patient',
        targetId: TARGET_A,
        beforeSnapshot: {
          status: 'active',
          nested: { firstName: 'Jane', lastName: 'Doe', count: 3 },
          contacts: [{ phone: '555-1234', label: 'home' }],
        },
      },
      db,
    );

    const { entries } = await repo.list(
      { action: 'patient.update', tenantId: UNIQUE_TENANT },
      { limit: 10, offset: 0 },
    );
    const before = entries[0]!.beforeSnapshot as Record<string, unknown>;
    const nested = before['nested'] as Record<string, unknown>;
    const contacts = before['contacts'] as Array<Record<string, unknown>>;

    expect(before['status']).toBe('active');
    expect(nested['count']).toBe(3);
    expect(nested).not.toHaveProperty('firstName');
    expect(nested).not.toHaveProperty('lastName');
    expect(contacts[0]).not.toHaveProperty('phone');
    expect(contacts[0]?.['label']).toBe('home');

    expect(JSON.stringify(entries[0]!)).not.toContain('Jane');
    expect(JSON.stringify(entries[0]!)).not.toContain('555-1234');
  });
});
