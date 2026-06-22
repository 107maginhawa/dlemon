/**
 * dental-imaging cross-tenant pin for ImagingMgmt_finalizeCbctStudy.
 *
 * The CBCT-finalize endpoint ships a handler + SDK with no FE consumer
 * (sensitive mutating orphan). It gates on assertBranchRole against the study's
 * branch — a caller without a dentist_owner/dentist_associate membership in that
 * branch must be DENIED (403). The imaging repo is mocked so the study exists;
 * the role gate runs against the real dental_membership table (attacker has no
 * row).
 *
 * The sibling ceph-superimposition write uses the identical assertBranchRole
 * mechanic; it stays allowlisted with a source-verified reason (its deny test
 * needs a heavier report->image->study repo mock).
 */

import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const ATTACKER = { id: 'cf020000-0000-1000-8000-000000000002', email: 'attacker@test.com' };
const BRANCH_A_ID = 'cf010000-0000-1000-8000-000000000020';

// Study/image/report exist (in branch A) — only assertBranchRole should reject.
mock.module('@/handlers/dental-imaging/repos/imaging.repo', () => ({
  ImagingRepository: class {
    findStudyById = () => Promise.resolve({ id: 'st', branchId: BRANCH_A_ID, patientId: 'pat' });
    findImageById = () => Promise.resolve({ id: 'img', studyId: 'st' });
  },
}));
function makeErrorHandler() {
  return (err: any, c: any) =>
    err instanceof AppError ? c.json({ error: err.message }, err.statusCode as any) : c.json({ error: String(err?.message) }, 500);
}
function inject(user: any) {
  return async (c: any, next: any) => {
    c.set('database', db);
    c.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) { c.set('user', user); c.set('session', { user }); }
    await next();
  };
}

import { finalizeCbctStudy } from './finalizeCbctStudy';

describe('ImagingMgmt_finalizeCbctStudy — branch-role gate (cross-tenant deny)', () => {
  function makeApp(user: any) {
    const app = new Hono();
    app.onError(makeErrorHandler());
    app.use('*', inject(user));
    app.post('/dental/imaging/studies/:studyId/cbct/finalize', finalizeCbctStudy as any);
    return app;
  }
  test('a non-member of the study’s branch cannot finalize a CBCT study → 403', async () => {
    const res = await makeApp(ATTACKER).request('/dental/imaging/studies/st/cbct/finalize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId: 'img', dicomBase64: 'QUFBQQ==' }),
    });
    expect(res.status).toBe(403);
  });
});
