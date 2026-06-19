/**
 * Job scheduler interface unit tests
 *
 * Tests the public interface contract of the JobScheduler.
 * We cannot easily unit-test PgBossScheduler without a real DB,
 * so we focus on the interface types, factory constraints, and pure helpers.
 */

import { describe, test, expect } from 'bun:test';
import type { JobScheduler, JobHandler, JobContext, JobHealth } from './jobs';
import { resolvePgBossTuning } from './jobs';

describe('resolvePgBossTuning', () => {
  test('test env uses fast cleanup/expiry', () => {
    const t = resolvePgBossTuning('test');
    expect(t.expireInMinutes).toBe(5);
    expect(t.deleteAfterDays).toBe(1);
  });

  test('production uses long-horizon retention/expiry (regression: slot generator must not be expired at 5 min)', () => {
    const t = resolvePgBossTuning('production');
    expect(t.expireInMinutes).toBeGreaterThanOrEqual(15);
    expect(t.deleteAfterDays).toBeGreaterThanOrEqual(30);
  });

  test('undefined NODE_ENV is treated as non-test (production defaults)', () => {
    const t = resolvePgBossTuning(undefined);
    expect(t.deleteAfterDays).toBeGreaterThanOrEqual(30);
  });
});

describe('JobScheduler interface', () => {
  test('JobHandler type accepts valid async function', () => {
    const handler: JobHandler = async (ctx: JobContext) => {
      // Handler should receive db, logger, jobId, jobName
      expect(ctx.db).toBeDefined();
      expect(ctx.logger).toBeDefined();
      expect(ctx.jobId).toBeDefined();
      expect(ctx.jobName).toBeDefined();
    };
    expect(typeof handler).toBe('function');
  });

  test('JobHealth interface has healthy boolean', () => {
    const health: JobHealth = { healthy: true };
    expect(health.healthy).toBe(true);
  });

  test('JobHealth interface supports optional metrics', () => {
    const health: JobHealth = {
      healthy: true,
      queueSize: 5,
      failedCount: 0,
      completedCount: 42,
    };
    expect(health.queueSize).toBe(5);
    expect(health.failedCount).toBe(0);
    expect(health.completedCount).toBe(42);
  });

  test('JobContext includes data property', () => {
    const ctx: JobContext = {
      db: {} as any,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => ({}) } as any,
      jobId: 'job-123',
      jobName: 'test-job',
      data: { foo: 'bar' },
    };
    expect(ctx.data).toEqual({ foo: 'bar' });
  });

  test('JobScheduler interface defines required methods', () => {
    // Type-level test: verify the interface shape compiles
    const scheduler: JobScheduler = {
      registerCron: (_name: string, _pattern: string, _handler: JobHandler) => {},
      registerInterval: (_name: string, _intervalMs: number, _handler: JobHandler) => {},
      registerDelayed: (_name: string, _delayMs: number, _handler: JobHandler) => {},
      start: async () => {},
      shutdown: async () => {},
      trigger: async (_name: string, _data?: any) => 'job-id',
      cancel: async (_jobId: string) => {},
      getHealth: async () => ({ healthy: true }),
      getQueueSize: async (_name: string) => 0,
    };
    expect(scheduler).toBeDefined();
  });
});
