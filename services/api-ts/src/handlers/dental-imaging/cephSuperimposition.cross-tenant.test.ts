/**
 * CephMgmt_createCephSuperimposition cross-tenant pin.
 *
 * The ceph-superimposition write ships a handler + SDK with no FE consumer
 * (sensitive mutating orphan). It gates on assertBranchRole against the TO
 * report's study branch. A caller without a dentist_owner/dentist_associate
 * membership in that branch is DENIED — and notably the handler CATCHES the
 * ForbiddenError and rethrows NotFoundError('Ceph report not found') (404), so a
 * cross-tenant caller cannot even confirm the report exists (anti-enumeration).
 * This test pins that deny → 404 mapping.
 *
 * The report->image->study load path is stubbed via spyOn on the repo
 * prototypes (deterministic; no module-replacement timing); the role gate runs
 * against the real dental_membership table (attacker has no row).
 *
 * Discharges the CephMgmt_createCephSuperimposition allowlist entry.
 */

import { describe, test, expect, spyOn, afterAll } from 'bun:test';
import { z } from 'zod';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { ImagingRepository } from './repos/imaging.repo';
import { ImagingCephRepository } from './repos/imaging_ceph.repo';
import { createCephSuperimposition } from './cephSuperimposition';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const ATTACKER = { id: 'ca020000-0000-1000-8000-000000000002', email: 'attacker@test.com' };
const BRANCH_A_ID = 'ca010000-0000-1000-8000-000000000020';

// Stub the load path so the report/image/study all "exist" in branch A — only
// the assertBranchRole gate (real dental_membership lookup) should reject.
const spies = [
  spyOn(ImagingCephRepository.prototype, 'getReportById').mockResolvedValue({ id: 'rep', imageId: 'img' } as any),
  spyOn(ImagingRepository.prototype, 'findImageById').mockResolvedValue({ id: 'img', studyId: 'st' } as any),
  spyOn(ImagingRepository.prototype, 'findStudyById').mockResolvedValue({ id: 'st', branchId: BRANCH_A_ID, patientId: 'pat' } as any),
];
afterAll(() => spies.forEach((s) => s.mockRestore()));

function makeErrorHandler() {
  return (err: any, c: any) =>
    err instanceof AppError ? c.json({ error: err.message }, err.statusCode as any) : c.json({ error: String(err?.message) }, 500);
}
function veh(result: any, c: any) { if (!result.success) return c.json({ error: 'validation' }, 400); }

function makeApp(user: any) {
  const app = new Hono();
  app.onError(makeErrorHandler());
  app.use('*', async (c: any, next: any) => {
    c.set('database', db);
    c.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) { c.set('user', user); c.set('session', { user }); }
    await next();
  });
  app.post('/dental/imaging/ceph/superimpositions',
    zValidator('json', z.object({ reportFromId: z.string(), reportToId: z.string(), reference: z.string() }), veh),
    createCephSuperimposition as any);
  return app;
}

describe('CephMgmt_createCephSuperimposition — branch-role gate (cross-tenant deny)', () => {
  test('a non-member of the report’s branch is denied (404 — anti-enumeration mapping of the 403)', async () => {
    const res = await makeApp(ATTACKER).request('/dental/imaging/ceph/superimpositions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFromId: 'rep', reportToId: 'rep', reference: 'cranial_base' }),
    });
    expect(res.status).toBe(404);
  });
});
