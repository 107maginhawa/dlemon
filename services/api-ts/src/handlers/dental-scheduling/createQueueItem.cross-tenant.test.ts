/**
 * createQueueItem cross-tenant pin.
 *
 * createQueueItem (POST /dental/appointments/:id/queue-item) ships a handler +
 * SDK with no FE consumer (sensitive mutating orphan). It gates on
 * assertBranchAccess against the appointment's branch — a caller outside that
 * branch must be DENIED (403). The appointment repo is mocked; the access guard
 * runs against the real dental_membership table (attacker has no membership).
 *
 * Discharges the createQueueItem entry of the sensitive-orphan allowlist.
 */

import { describe, test, expect, mock } from 'bun:test';
import { z } from 'zod';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

const ATTACKER = { id: 'ce020000-0000-1000-8000-000000000002', email: 'attacker@test.com' };
const BRANCH_A_ID = 'ce010000-0000-1000-8000-000000000020';
const APPT_ID = 'ce010000-0000-1000-8000-000000000050';

// Appointment exists (in branch A) — only the branch access guard should reject.
mock.module('@/handlers/dental-scheduling/repos/dental-appointment.repo', () => ({
  DentalAppointmentRepository: class {
    findOneById = () => Promise.resolve({ id: APPT_ID, branchId: BRANCH_A_ID, patientId: 'ce010000-0000-1000-8000-0000000000b0' });
  },
}));

function veh(result: any, c: any) { if (!result.success) return c.json({ error: 'validation' }, 400); }
function makeErrorHandler() {
  return (err: any, c: any) =>
    err instanceof AppError ? c.json({ error: err.message }, err.statusCode as any) : c.json({ error: String(err?.message) }, 500);
}

import { createQueueItem } from './createQueueItem';

function makeApp(user: any) {
  const app = new Hono();
  app.onError(makeErrorHandler());
  app.use('*', async (c: any, next: any) => {
    c.set('database', db);
    c.set('logger', { debug() {}, info() {}, warn() {}, error() {} });
    if (user) c.set('user', user);
    await next();
  });
  app.post('/dental/appointments/:appointmentId/queue-item',
    zValidator('param', z.object({ appointmentId: z.string() }), veh),
    zValidator('json', z.object({ notes: z.string().nullish() }), veh),
    createQueueItem as any);
  return app;
}

describe('createQueueItem — branch access (cross-tenant deny)', () => {
  test('a caller outside the appointment’s branch cannot create a queue item → 403', async () => {
    const res = await makeApp(ATTACKER).request(`/dental/appointments/${APPT_ID}/queue-item`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    expect(res.status).toBe(403);
  });
});
