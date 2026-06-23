/**
 * Pure-predicate + boot-advisory unit test for the single-clinic RLS trip-wire
 * (plan 014 S5 / plan 015 S1). The DB-querying script
 * (scripts/check-single-clinic-invariant.ts) is the deploy/release gate, not a
 * suite test; this pins the decision logic both it and the boot advisory key off.
 */

import { describe, test, expect, mock } from 'bun:test';
import {
  violatesSingleClinicInvariant,
  RLS_FULLY_ACTIVATED,
  checkSingleClinicInvariantAdvisory,
} from './single-clinic-invariant';
import type { DatabaseInstance } from './database';
import type { Logger } from '@/types/logger';

/** A minimal logger double capturing fatal/warn calls. */
function makeLogger(): Logger & { fatalCalls: unknown[][]; warnCalls: unknown[][] } {
  const fatalCalls: unknown[][] = [];
  const warnCalls: unknown[][] = [];
  return {
    fatal: (...args: unknown[]) => fatalCalls.push(args),
    warn: (...args: unknown[]) => warnCalls.push(args),
    fatalCalls,
    warnCalls,
  } as unknown as Logger & { fatalCalls: unknown[][]; warnCalls: unknown[][] };
}

/** A database double whose execute() returns a fixed org count (or throws). */
function makeDb(orgCount: number | Error): DatabaseInstance {
  return {
    execute: mock(async () => {
      if (orgCount instanceof Error) throw orgCount;
      return { rows: [{ n: orgCount }] };
    }),
  } as unknown as DatabaseInstance;
}

describe('violatesSingleClinicInvariant', () => {
  test('0 or 1 org is always fine (no tenant boundary to cross)', () => {
    expect(violatesSingleClinicInvariant(0, false)).toBe(false);
    expect(violatesSingleClinicInvariant(1, false)).toBe(false);
  });

  test('>1 org while RLS NOT fully activated is a violation', () => {
    expect(violatesSingleClinicInvariant(2, false)).toBe(true);
    expect(violatesSingleClinicInvariant(10, false)).toBe(true);
  });

  test('>1 org is permitted once RLS is fully activated', () => {
    expect(violatesSingleClinicInvariant(2, true)).toBe(false);
    expect(violatesSingleClinicInvariant(50, true)).toBe(false);
  });

  test('the gate currently treats RLS as NOT fully activated (ADR-010 P3b deferred)', () => {
    // Guards the lift: flipping this constant is a deliberate, reviewed event.
    expect(RLS_FULLY_ACTIVATED).toBe(false);
  });
});

describe('checkSingleClinicInvariantAdvisory', () => {
  test('logs CRITICAL (fatal) in production when >1 org and RLS not activated', async () => {
    const logger = makeLogger();
    const db = makeDb(2);
    const violated = await checkSingleClinicInvariantAdvisory({ database: db, logger, isProduction: true });
    expect(violated).toBe(true);
    expect(logger.fatalCalls.length).toBe(1);
  });

  test('stays quiet in production when exactly one org', async () => {
    const logger = makeLogger();
    const db = makeDb(1);
    const violated = await checkSingleClinicInvariantAdvisory({ database: db, logger, isProduction: true });
    expect(violated).toBe(false);
    expect(logger.fatalCalls.length).toBe(0);
  });

  test('is a no-op outside production even with many orgs (dev/test seed many)', async () => {
    const logger = makeLogger();
    const db = makeDb(6);
    const violated = await checkSingleClinicInvariantAdvisory({ database: db, logger, isProduction: false });
    expect(violated).toBe(false);
    expect(logger.fatalCalls.length).toBe(0);
    // Must not even query the DB when not in production.
    expect((db.execute as ReturnType<typeof mock>).mock.calls.length).toBe(0);
  });

  test('never throws on a failed count query — logs a warning and returns false', async () => {
    const logger = makeLogger();
    const db = makeDb(new Error('relation "dental_organization" does not exist'));
    const violated = await checkSingleClinicInvariantAdvisory({ database: db, logger, isProduction: true });
    expect(violated).toBe(false);
    expect(logger.warnCalls.length).toBe(1);
    expect(logger.fatalCalls.length).toBe(0);
  });
});
