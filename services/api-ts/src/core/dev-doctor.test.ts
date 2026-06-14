/**
 * dev-doctor diagnosis unit tests.
 *
 * The dev-doctor's value is its DIAGNOSIS logic — given a set of facts gathered
 * from the local stack (DB migration count vs files on disk, app_rls grants, API
 * + FE reachability), it must classify a drifted dev box loudly and hand back the
 * ONE fix command. Those classification rules are pure and live in `./dev-doctor`;
 * the I/O that gathers the facts lives in `scripts/dev-doctor.ts`. These tests pin
 * the rules — especially the exact drift the user hit (DB behind on migrations →
 * RLS writes fail with "permission denied" while CI is green).
 */

import { describe, test, expect } from 'bun:test';
import { diagnose, formatReport, type DoctorFacts } from './dev-doctor';

const HEALTHY: DoctorFacts = {
  dbReachable: true,
  migrationsApplied: 108,
  migrationFilesOnDisk: 108,
  appRlsGrantTables: 104,
  apiLivez: true,
  apiReadyz: true,
  feUp: true,
};

function check(report: ReturnType<typeof diagnose>, name: string) {
  const c = report.checks.find((r) => r.name === name);
  if (!c) throw new Error(`no check named "${name}" in report`);
  return c;
}

describe('diagnose', () => {
  test('a fully-consistent stack is OK with every check passing', () => {
    const report = diagnose(HEALTHY);
    expect(report.ok).toBe(true);
    expect(report.checks.every((c) => c.status === 'pass')).toBe(true);
  });

  test('DB behind on migrations is a FAIL with the migrate fix (the user-hit drift)', () => {
    const report = diagnose({ ...HEALTHY, migrationsApplied: 104, migrationFilesOnDisk: 108 });
    expect(report.ok).toBe(false);
    const c = check(report, 'migrations');
    expect(c.status).toBe('fail');
    // names the gap and the consequence
    expect(c.detail).toContain('104');
    expect(c.detail).toContain('108');
    expect(c.detail.toLowerCase()).toContain('permission denied');
    // hands back the ONE fix command
    expect(c.fix).toContain('drizzle-kit migrate');
  });

  test('DB ahead of code is a WARN, not a hard fail', () => {
    const report = diagnose({ ...HEALTHY, migrationsApplied: 110, migrationFilesOnDisk: 108 });
    const c = check(report, 'migrations');
    expect(c.status).toBe('warn');
    expect(report.ok).toBe(true);
  });

  test('app_rls with zero table grants is a FAIL (DB missing the RLS grant migration)', () => {
    const report = diagnose({ ...HEALTHY, appRlsGrantTables: 0 });
    expect(report.ok).toBe(false);
    const c = check(report, 'app_rls-grants');
    expect(c.status).toBe('fail');
    expect(c.detail.toLowerCase()).toContain('permission denied');
    expect(c.fix).toContain('drizzle-kit migrate');
  });

  test('API not reachable is a FAIL with the bun dev fix', () => {
    const report = diagnose({ ...HEALTHY, apiLivez: false, apiReadyz: false });
    expect(report.ok).toBe(false);
    const c = check(report, 'api');
    expect(c.status).toBe('fail');
    expect(c.fix).toContain('bun dev');
  });

  test('API up but not ready is a WARN, not a fail', () => {
    const report = diagnose({ ...HEALTHY, apiReadyz: false });
    const c = check(report, 'api');
    expect(c.status).toBe('warn');
    expect(report.ok).toBe(true);
  });

  test('FE down is a WARN (only needed for UI work), stack still OK', () => {
    const report = diagnose({ ...HEALTHY, feUp: false });
    const c = check(report, 'frontend');
    expect(c.status).toBe('warn');
    expect(report.ok).toBe(true);
  });

  test('DB unreachable fails the connection check and skips DB-dependent checks as warns', () => {
    const report = diagnose({
      ...HEALTHY,
      dbReachable: false,
      migrationsApplied: null,
      appRlsGrantTables: null,
    });
    expect(report.ok).toBe(false);
    expect(check(report, 'database').status).toBe('fail');
    expect(check(report, 'migrations').status).toBe('warn');
    expect(check(report, 'app_rls-grants').status).toBe('warn');
  });
});

describe('formatReport', () => {
  test('renders a loud failure block carrying the fix command', () => {
    const report = diagnose({ ...HEALTHY, migrationsApplied: 104, migrationFilesOnDisk: 108 });
    const out = formatReport(report);
    expect(out).toContain('❌');
    expect(out).toContain('drizzle-kit migrate');
  });

  test('renders a clean all-pass report with no fix block', () => {
    const out = formatReport(diagnose(HEALTHY));
    expect(out).toContain('✅');
    expect(out).not.toContain('❌');
  });
});
