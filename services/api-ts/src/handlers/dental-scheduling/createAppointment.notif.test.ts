/**
 * createAppointment — notification trigger test (AC-NOTIF-01)
 *
 * Verifies that notifs.createNotification is called with type 'booking.created'
 * after a successful appointment creation. Uses mock.module to stub heavy
 * dependencies (DB repos, branch access guard) so no real database is needed.
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { CreateAppointmentBody } from '@/generated/openapi/validators';

// ── Stub assertBranchAccess (no-op for auth check) ──────────────────────────
mock.module('@/handlers/dental-scheduling/utils/assert-branch-access', () => ({
  assertBranchAccess: mock(() => Promise.resolve()),
}));

// ── Stub DentalAppointmentRepository ─────────────────────────────────────────
const mockFindOverlapping = mock(() => Promise.resolve([]));
const mockCreateOne = mock(() =>
  Promise.resolve({
    id: 'appt-001',
    patientId: 'a0000000-0000-0000-0000-000000000001',
    dentistMemberId: 'b0000000-0000-0000-0000-000000000001',
    branchId: 'c0000000-0000-0000-0000-000000000001',
    scheduledAt: new Date('2026-06-01T09:00:00Z'),
    durationMinutes: 30,
    status: 'scheduled',
    serviceType: 'cleaning',
    walkIn: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
);
mock.module('@/handlers/dental-scheduling/repos/dental-appointment.repo', () => ({
  DentalAppointmentRepository: class {
    findOverlapping = mockFindOverlapping;
    createOne = mockCreateOne;
  },
}));

const { createAppointment } = await import('./createAppointment');

const VALID_BODY = {
  patientId:       'a0000000-0000-1000-8000-000000000001',
  dentistMemberId: 'b0000000-0000-1000-8000-000000000001',
  branchId:        'c0000000-0000-1000-8000-000000000001',
  scheduledAt: '2026-06-01T09:00:00.000Z',
  durationMinutes: 30,
  serviceType: 'cleaning',
};

function buildApp(notifs?: object) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    return c.json({ error: String(err) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    // Minimal DB stub — branch lookup returns null (no working hours = no blocking)
    ctx.set('database', {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([null]),
        }),
      }),
    });
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', { id: 'b0000000-0000-0000-0000-000000000001', email: 'dentist@test.com' });
    ctx.set('session', { user: { id: 'b0000000-0000-0000-0000-000000000001' } });
    if (notifs) ctx.set('notifs', notifs);
    await next();
  });

  app.post(
    '/dental/appointments',
    zValidator('json', CreateAppointmentBody),
    createAppointment as any,
  );

  return app;
}

describe('createAppointment — notification trigger (AC-NOTIF-01)', () => {
  beforeEach(() => {
    mockFindOverlapping.mockClear();
    mockCreateOne.mockClear();
  });

  test('calls notifs.createNotification with booking.created on success', async () => {
    const createNotification = mock(() => Promise.resolve({ id: 'notif-1' }));
    const notifs = { createNotification };

    const app = buildApp(notifs);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(201);
    // Give the fire-and-forget microtask a tick to execute
    await Promise.resolve();
    expect(createNotification).toHaveBeenCalledTimes(1);
    const [req] = createNotification.mock.calls[0] as any[];
    expect(req.type).toBe('booking.created');
    expect(req.channel).toBe('in-app');
    expect(req.relatedEntityType).toBe('appointment');
  });

  test('does not throw when notifs service is absent', async () => {
    const app = buildApp(undefined);
    const res = await app.request('/dental/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(201);
  });
});
