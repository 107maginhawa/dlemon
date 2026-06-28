/**
 * PgBossScheduler fast-interval runtime tests (#39).
 *
 * The scheduler's sub-minute interval path drives handlers via plain setInterval
 * (not pg-boss) — it's the execution path the contract suite and any sub-minute
 * job depend on, and it runs WITHOUT start()/pg-boss. The existing jobs.test.ts
 * only covers pure helpers + types; this exercises the live handler-dispatch path.
 *
 * Real DB only for the $client pool the PgBossScheduler constructor extracts;
 * pg-boss itself is never started.
 */
import { describe, test, expect } from 'bun:test';
import { createDatabase } from '@/core/database';
import type { Logger } from '@/types/logger';
import type { JobContext } from './jobs';
import { createJobScheduler } from './jobs';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });
const noop = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('PgBossScheduler fast-interval path', () => {
  test('a sub-minute interval job fires its handler with a full JobContext', async () => {
    const sched = createJobScheduler(db, noop);
    let count = 0;
    let captured: JobContext | undefined;
    sched.registerInterval('fast-ctx', 25, async (c) => { count++; captured = c; });

    await wait(90);

    expect(count).toBeGreaterThanOrEqual(1);
    expect(captured?.jobName).toBe('fast-ctx');
    expect(captured?.db).toBe(db);
    expect(typeof captured?.jobId).toBe('string');
  });

  test('a throwing fast-interval handler is caught and logged, not crashed', async () => {
    const calls: unknown[][] = [];
    const logger = { debug() {}, info() {}, warn() {}, error: (...a: unknown[]) => { calls.push(a); } } as unknown as Logger;
    const sched = createJobScheduler(db, logger);
    sched.registerInterval('fast-throw', 25, async () => { throw new Error('boom'); });

    await wait(90);

    expect(calls.some((a) => a[1] === 'Fast-interval job handler threw')).toBe(true);
  });
});
