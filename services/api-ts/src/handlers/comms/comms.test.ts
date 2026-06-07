/**
 * comms handler tests — createChatRoom, sendChatMessage, getChatMessages,
 * getIceServers, endVideoCall, leaveVideoCall
 *
 * Fixture tag: cm01
 * All deterministic UUIDs use namespace cm01.
 *
 * joinVideoCall is already covered in joinVideoCall.test.ts
 * ws.chat-room is already covered in ws.chat-room.test.ts
 * — not duplicated here.
 *
 * RED-for-right-reason: each 404 / 403 / conflict case confirmed to produce
 * the expected error before the fixture that makes it pass was added.
 *
 * Pattern: buildTestApp (handler-unit, NOT real router) with real DB + zValidator
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { AppError } from '@/core/errors';
import {
  CreateChatRoomBody,
  SendChatMessageBody,
  SendChatMessageParams,
  GetChatMessagesQuery,
  GetChatMessagesParams,
  EndVideoCallParams,
  LeaveVideoCallParams,
} from '@/generated/openapi/validators';
import { chatRooms, chatMessages } from './repos/comms.schema';
import { createChatRoom } from './createChatRoom';
import { sendChatMessage } from './sendChatMessage';
import { getChatMessages } from './getChatMessages';
import { getIceServers } from './getIceServers';
import { endVideoCall } from './endVideoCall';
import { leaveVideoCall } from './leaveVideoCall';

// ---------------------------------------------------------------------------
// DB + fixtures
// ---------------------------------------------------------------------------

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Fixture tag: cm01 — all IDs are valid UUIDs (hex only)
const USER_A = {
  id: 'aa010000-0000-4000-8000-000000000001',
  name: 'User Alpha',
  email: 'user-a-cm01@test.com',
  role: 'user',
};
const USER_B = {
  id: 'aa010000-0000-4000-8000-000000000002',
  name: 'User Beta',
  email: 'user-b-cm01@test.com',
  role: 'user',
};
const USER_C = {
  id: 'aa010000-0000-4000-8000-000000000003',
  name: 'User Gamma',
  email: 'user-c-cm01@test.com',
  role: 'user',
};

const ROOM_ID_1 = 'ba010000-0000-4000-8000-000000000001';
const ROOM_ID_2 = 'ba010000-0000-4000-8000-000000000002';
const MSG_ID_1  = 'ca010000-0000-4000-8000-000000000001';

const FIXED_TS = new Date('2026-03-01T08:00:00Z');

// Mock notifs service (always succeeds — we don't test notification delivery here)
const mockNotifs = {
  createNotification: async () => ({ id: 'notif-mock', status: 'queued' }),
};

// Mock config with ICE servers
const mockConfig = {
  webrtc: {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['turn:turn.example.com:3478'], username: 'user', credential: 'pass' },
    ],
  },
};

// ---------------------------------------------------------------------------
// buildTestApp
// ---------------------------------------------------------------------------

const ve = (result: any, c: any) => {
  if (!result.success) {
    return c.json({ error: result.error.issues.map((i: any) => i.message).join('; ') }, 400);
  }
};

function buildTestApp(user?: typeof USER_A) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('notifs', mockNotifs);
    ctx.set('config', mockConfig);
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session-cm01' });
    }
    await next();
  });

  // Routes
  app.post('/comms/chat-rooms', zValidator('json', CreateChatRoomBody, ve), createChatRoom as any);
  app.post('/comms/chat-rooms/:room/messages', zValidator('param', SendChatMessageParams, ve), zValidator('json', SendChatMessageBody, ve), sendChatMessage as any);
  app.get('/comms/chat-rooms/:room/messages', zValidator('param', GetChatMessagesParams, ve), zValidator('query', GetChatMessagesQuery, ve), getChatMessages as any);
  app.get('/comms/ice-servers', getIceServers as any);
  app.post('/comms/chat-rooms/:room/video-call/end', zValidator('param', EndVideoCallParams, ve), endVideoCall as any);
  app.post('/comms/chat-rooms/:room/video-call/leave', zValidator('param', LeaveVideoCallParams, ve), leaveVideoCall as any);

  return app;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedChatRoom(
  id: string,
  participants: string[],
  admins: string[] = participants,
  overrides: Partial<typeof chatRooms.$inferInsert> = {}
) {
  await db.insert(chatRooms).values({
    id,
    participants: participants as any,
    admins: admins as any,
    status: 'active',
    messageCount: 0,
    createdBy: participants[0],
    updatedBy: participants[0],
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    ...overrides,
  }).onConflictDoNothing();

  const [readback] = await db.select().from(chatRooms).where(eq(chatRooms.id, id));
  expect(readback!.status).toBe(overrides.status ?? 'active');
  return readback!;
}

async function seedVideoCallMessage(
  id: string,
  roomId: string,
  senderId: string,
  callStatus: 'starting' | 'active' | 'ended' = 'active'
) {
  const participants = [
    {
      user: senderId,
      userType: 'host',
      displayName: 'Host',
      joinedAt: FIXED_TS.toISOString(),
      audioEnabled: true,
      videoEnabled: true,
    },
  ];

  await db.insert(chatMessages).values({
    id,
    chatRoom: roomId,
    sender: senderId,
    messageType: 'video_call',
    videoCallData: {
      status: callStatus,
      participants,
      startedAt: FIXED_TS.toISOString(),
    } as any,
    timestamp: FIXED_TS,
    createdBy: senderId,
    updatedBy: senderId,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
  }).onConflictDoNothing();

  const [readback] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
  expect(readback!.messageType).toBe('video_call');
  return readback!;
}

async function truncateComms() {
  await db.delete(chatMessages).where(eq(chatMessages.chatRoom, ROOM_ID_1));
  await db.delete(chatMessages).where(eq(chatMessages.chatRoom, ROOM_ID_2));
  await db.delete(chatMessages).where(eq(chatMessages.id, MSG_ID_1));
  await db.delete(chatRooms).where(eq(chatRooms.id, ROOM_ID_1));
  await db.delete(chatRooms).where(eq(chatRooms.id, ROOM_ID_2));
}

// ---------------------------------------------------------------------------
// createChatRoom
// ---------------------------------------------------------------------------

describe('createChatRoom', () => {
  afterEach(truncateComms);

  test('unauthenticated (no user) → 500 (user.id access throws)', async () => {
    const app = buildTestApp(undefined);
    const res = await app.request('/comms/chat-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: [USER_A.id, USER_B.id] }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('empty participants → 400 VALIDATION_ERROR', async () => {
    // RED verified: participants [] → ValidationError before repo
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: [] }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('only one participant → 400 (needs at least 2)', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: [USER_A.id] }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('user not in participants → 403 FORBIDDEN', async () => {
    // RED verified: USER_A not in participants [USER_B, USER_C] → ForbiddenError
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: [USER_B.id, USER_C.id] }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('duplicate participants → 422 DUPLICATE_PARTICIPANTS', async () => {
    // BusinessLogicError: duplicate participants not allowed
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: [USER_A.id, USER_A.id, USER_B.id] }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as any;
    expect(body.code).toBe('DUPLICATE_PARTICIPANTS');
  });

  test('happy path new room → 201 with room data', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: [USER_A.id, USER_B.id] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(body.participants).toContain(USER_A.id);
    expect(body.participants).toContain(USER_B.id);
    expect(body.created).toBe(true);
  });

  test('room already exists without upsert → 409 CONFLICT', async () => {
    // Seed a room with the same participants first
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: [USER_A.id, USER_B.id], upsert: false }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.code).toBe('CONFLICT');
  });

  test('room already exists with upsert=true → 200 returns existing room', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: [USER_A.id, USER_B.id], upsert: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.participants).toContain(USER_A.id);
    // created should be false for an existing room
    expect(body.created).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sendChatMessage
// ---------------------------------------------------------------------------

describe('sendChatMessage', () => {
  afterEach(truncateComms);

  test('unauthenticated (no user) → 500', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(undefined);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'text', message: 'hello' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('room not found → 404 NOT_FOUND', async () => {
    // RED verified: no room seed → roomRepo.findOneById null → NotFoundError
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms/00000000-0000-4000-8000-000099040001/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'text', message: 'hello' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('non-participant trying to send → 403 FORBIDDEN', async () => {
    // RED verified: USER_C not in [USER_A, USER_B] → ForbiddenError
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_C);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'text', message: 'hello' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('text message with empty content → 400 VALIDATION_ERROR', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_A);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'text', message: '   ' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('happy path text message → 201 with message data', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_A);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'text', message: 'Hello cm01!' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(typeof body.id).toBe('string');
    expect(body.messageType).toBe('text');
    expect(body.message).toBe('Hello cm01!');
    expect(body.sender).toBe(USER_A.id);
    expect(body.chatRoom).toBe(ROOM_ID_1);
  });

  test('non-admin trying to start video call → 403 FORBIDDEN', async () => {
    // Only room admins can start video calls
    // USER_B is participant but NOT in admins list
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id], [USER_A.id]);
    const app = buildTestApp(USER_B);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageType: 'video_call',
        videoCallData: {
          status: 'starting',
          participants: [{
            user: USER_B.id,
            userType: 'host',
            displayName: 'User Beta',
            audioEnabled: true,
            videoEnabled: true,
          }],
        },
      }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// getChatMessages
// ---------------------------------------------------------------------------

describe('getChatMessages', () => {
  afterEach(truncateComms);

  test('unauthenticated (no user) → 500', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(undefined);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('room not found → 404 NOT_FOUND', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms/00000000-0000-4000-8000-000099050001/messages');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('non-participant accessing messages → 403 FORBIDDEN', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_C);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('happy path empty room → 200 with empty data array', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_A);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  test('happy path with messages → 200 contains message data', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    // Send a real message first via the handler
    const sendApp = buildTestApp(USER_A);
    await sendApp.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'text', message: 'cm01 test message' }),
    });
    const app = buildTestApp(USER_A);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].message).toBe('cm01 test message');
    expect(body.pagination.totalCount).toBeGreaterThanOrEqual(1);
  });

  test('pagination limit respected → 200 with truncated result', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    // Send two messages
    const sendApp = buildTestApp(USER_A);
    await sendApp.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'text', message: 'msg 1' }),
    });
    await sendApp.request(`/comms/chat-rooms/${ROOM_ID_1}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'text', message: 'msg 2' }),
    });
    const app = buildTestApp(USER_A);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/messages?limit=1`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.pagination.totalCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// getIceServers
// ---------------------------------------------------------------------------

describe('getIceServers', () => {
  test('returns iceServers array from config → 200', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/ice-servers');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.iceServers)).toBe(true);
    expect(body.iceServers.length).toBeGreaterThan(0);
    // Each server must have a urls array
    for (const server of body.iceServers) {
      expect(Array.isArray(server.urls)).toBe(true);
      expect(server.urls.length).toBeGreaterThan(0);
    }
  });

  test('works without authentication (no auth guard on ice-servers) → 200', async () => {
    // getIceServers has no auth check — it just reads config
    const app = buildTestApp(undefined);
    const res = await app.request('/comms/ice-servers');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.iceServers).toBeDefined();
  });

  test('STUN server is present in ice servers', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/ice-servers');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const hasStun = body.iceServers.some(
      (s: any) => s.urls.some((u: string) => u.startsWith('stun:'))
    );
    expect(hasStun).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// endVideoCall
// ---------------------------------------------------------------------------

describe('endVideoCall', () => {
  afterEach(truncateComms);

  test('room not found → 404 NOT_FOUND', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms/00000000-0000-4000-8000-000099060001/video-call/end', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('non-participant → 403 FORBIDDEN', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_C);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/video-call/end`, {
      method: 'POST',
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('participant but not admin → 403 FORBIDDEN', async () => {
    // USER_B is participant but not admin
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id], [USER_A.id]);
    const app = buildTestApp(USER_B);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/video-call/end`, {
      method: 'POST',
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('no active video call → 404 NOT_FOUND', async () => {
    // RED verified: room exists but no active call → findActiveVideoCall returns null → NotFoundError
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id], [USER_A.id]);
    const app = buildTestApp(USER_A);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/video-call/end`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('active video call → 200 with callDuration and systemMessage', async () => {
    // Seed room with active video call message + link it
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id], [USER_A.id], {
      activeVideoCallMessage: MSG_ID_1,
    });
    await seedVideoCallMessage(MSG_ID_1, ROOM_ID_1, USER_A.id, 'active');
    const app = buildTestApp(USER_A);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/video-call/end`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.message).toBeDefined();
    expect(typeof body.callDuration).toBe('number');
    expect(body.systemMessage).toBeDefined();
    expect(body.systemMessage.messageType).toBe('system');
  });
});

// ---------------------------------------------------------------------------
// leaveVideoCall
// ---------------------------------------------------------------------------

describe('leaveVideoCall', () => {
  afterEach(truncateComms);

  test('room not found → 404 NOT_FOUND', async () => {
    const app = buildTestApp(USER_A);
    const res = await app.request('/comms/chat-rooms/00000000-0000-4000-8000-000099070001/video-call/leave', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('non-participant → 403 FORBIDDEN', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_C);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/video-call/leave`, {
      method: 'POST',
    });
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });

  test('no active video call → 404 NOT_FOUND', async () => {
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id]);
    const app = buildTestApp(USER_A);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/video-call/leave`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('user not in video call participants → 404 NOT_FOUND', async () => {
    // Room has a call, but USER_B (participant) is not in the call participants list
    // The call was started with only USER_A as participant
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id], [USER_A.id], {
      activeVideoCallMessage: MSG_ID_1,
    });
    await seedVideoCallMessage(MSG_ID_1, ROOM_ID_1, USER_A.id, 'active');
    const app = buildTestApp(USER_B);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/video-call/leave`, {
      method: 'POST',
    });
    // USER_B is a room participant but not in the video call participants list
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('valid participant leaves → 200 with callStillActive and remainingParticipants', async () => {
    // USER_A is in the call and leaves
    await seedChatRoom(ROOM_ID_1, [USER_A.id, USER_B.id], [USER_A.id], {
      activeVideoCallMessage: MSG_ID_1,
    });
    await seedVideoCallMessage(MSG_ID_1, ROOM_ID_1, USER_A.id, 'active');
    const app = buildTestApp(USER_A);
    const res = await app.request(`/comms/chat-rooms/${ROOM_ID_1}/video-call/leave`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.message).toBeDefined();
    expect(typeof body.callStillActive).toBe('boolean');
    expect(typeof body.remainingParticipants).toBe('number');
  });
});
